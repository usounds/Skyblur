import { AppBskyActorDefs } from '@atcute/bluesky';
import { Client, simpleFetchHandler } from '@atcute/client';
import { scopeList } from '../logic/oauth/constants';
import { create } from 'zustand';
import { clearSensitiveDraft } from './SensitiveDraft';

type State = {
  agent: Client;
  apiProxyAgent: Client;
  publicAgent: Client;
  userProf: AppBskyActorDefs.ProfileViewDetailed | null;
  did: string;
  blueskyLoginMessage: string;
  serviceUrl: string;
  isLoginModalOpened: boolean;
  isSessionChecked: boolean;
  scope: string;
  missingAppBskyRpcScopes: string[];
};

type SessionCheckResult = {
  authenticated: boolean;
  did: string;
  pds: string;
  timedOut?: boolean;
  scope?: string;
  missingAppBskyRpcScopes?: string[];
};

type XrpcAgentCache = {
  sessionCheckPromise: Promise<SessionCheckResult> | null;
  lastSessionResult: SessionCheckResult | null;
  profFetchPromise: Promise<void> | null;
};

type Action = {
  setUserProf: (userProf: AppBskyActorDefs.ProfileViewDetailed | null) => void;
  setDid: (did: string) => void;
  setBlueskyLoginMessage: (blueskyLoginMessage: string) => void;
  setServiceUrl: (setServiceUrl: string) => void;
  setIsLoginModalOpened: (isLoginModalOpened: boolean) => void;
  setIsSessionChecked: (isSessionChecked: boolean) => void;
  getReloginUrl: (redirectUrl?: string) => string;
  checkSession: () => Promise<SessionCheckResult>;
  fetchUserProf: () => Promise<void>;
  logout: (mode: 'soft' | 'hard') => Promise<void>;
};
const host = typeof window !== 'undefined' ? new URL(window.location.origin).host : '';
const xrpcService = typeof window !== 'undefined' ? window.location.origin : '';
const moduleCache: XrpcAgentCache = {
  sessionCheckPromise: null,
  lastSessionResult: null,
  profFetchPromise: null,
};

declare global {
  interface Window {
    __skyblurXrpcAgentCache?: XrpcAgentCache;
  }
}

function getXrpcAgentCache() {
  if (typeof window === 'undefined') return moduleCache;

  window.__skyblurXrpcAgentCache ??= {
    sessionCheckPromise: null,
    lastSessionResult: null,
    profFetchPromise: null,
  };
  return window.__skyblurXrpcAgentCache;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function parseScopes(scope: string) {
  return new Set(scope.split(/\s+/).map((item) => item.trim()).filter(Boolean));
}

export function getRequiredAppBskyRpcScopes() {
  return scopeList
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.startsWith('rpc:app.bsky.'));
}

export function getMissingAppBskyRpcScopes(sessionScope: string) {
  const sessionScopes = parseScopes(sessionScope);
  return getRequiredAppBskyRpcScopes().filter((requiredScope) => !sessionScopes.has(requiredScope));
}

export const useXrpcAgentStore = create<State & Action>((set, get) => {
  return ({
    agent: new Client({
      handler: simpleFetchHandler({
        service: xrpcService,
        // @ts-ignore
        fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
      }),
    }),
    apiProxyAgent: new Client({
      handler: simpleFetchHandler({
        service: xrpcService,
        // @ts-ignore
        fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
      }),
      proxy: {
        did: `did:web:${host}`,
        serviceId: '#skyblur_api'
      }
    }),
    publicAgent: new Client({
      handler: simpleFetchHandler({
        service: 'https://public.api.bsky.app',
      }),
    }),
    did: "",
    userProf: null,
    blueskyLoginMessage: '',
    serviceUrl: "",
    isLoginModalOpened: false,
    isSessionChecked: false,
    scope: '',
    missingAppBskyRpcScopes: [],
    setUserProf: (userProf) => set({ userProf }),
    setDid: (did) => set({ did }),
    setBlueskyLoginMessage: (blueskyLoginMessage) => set({ blueskyLoginMessage }),
    setServiceUrl: (serviceUrl) => set({ serviceUrl }),
    setIsLoginModalOpened: (isLoginModalOpened) => set({ isLoginModalOpened }),
    getReloginUrl: (redirectUrl?: string) => {
      const redirect = redirectUrl || (typeof window !== 'undefined' ? window.location.href : '/console');
      return `${xrpcService}/api/oauth/login?redirect_uri=${encodeURIComponent(redirect)}`;
    },
    setIsSessionChecked: (isSessionChecked) => {
      if (!isSessionChecked) {
        const cache = getXrpcAgentCache();
        cache.lastSessionResult = null;
        cache.sessionCheckPromise = null;
      }
      set({ isSessionChecked });
    },
    checkSession: async () => {
      if (get().isSessionChecked) {
        return { authenticated: !!get().did, did: get().did, pds: get().serviceUrl };
      }
      const cache = getXrpcAgentCache();
      if (cache.lastSessionResult && !cache.lastSessionResult.timedOut) {
        if (cache.lastSessionResult.authenticated) {
          set({
            did: cache.lastSessionResult.did,
            serviceUrl: cache.lastSessionResult.pds,
            isSessionChecked: true,
            scope: cache.lastSessionResult.scope || '',
            missingAppBskyRpcScopes: cache.lastSessionResult.missingAppBskyRpcScopes || [],
          });
          void get().fetchUserProf();
        } else {
          set({ did: "", serviceUrl: "", isSessionChecked: true, userProf: null, scope: "", missingAppBskyRpcScopes: [] });
        }
        return cache.lastSessionResult;
      }
      if (cache.sessionCheckPromise) return cache.sessionCheckPromise;

      cache.sessionCheckPromise = (async () => {
        try {
          const res = await fetchWithTimeout('/api/oauth/session', {
            credentials: 'include'
          }, 10_000);
          const data = await res.json() as any;
          if (data.authenticated) {
            const pdsUrl = data.pds || 'https://bsky.social';
            const nextScope = data.scope || '';
            const missingAppBskyRpcScopes = getMissingAppBskyRpcScopes(nextScope);

            if (get().did && get().did !== data.did) {
              clearSensitiveDraft();
            }

            if (get().did !== data.did || get().serviceUrl !== pdsUrl || get().scope !== nextScope) {
              set({ did: data.did, serviceUrl: pdsUrl, isSessionChecked: true, scope: nextScope, missingAppBskyRpcScopes });
            } else {
              set({ isSessionChecked: true, missingAppBskyRpcScopes });
            }
            cache.lastSessionResult = { authenticated: true, did: data.did, pds: pdsUrl, scope: nextScope, missingAppBskyRpcScopes };
            void get().fetchUserProf();
            return cache.lastSessionResult;
          } else {
            if (get().did !== "" || get().isSessionChecked !== true) {
              if (get().did !== "") {
                clearSensitiveDraft();
              }
              set({ did: "", serviceUrl: "", isSessionChecked: true, userProf: null, scope: "", missingAppBskyRpcScopes: [] });
            }
            cache.lastSessionResult = { authenticated: false, did: "", pds: "" };
            return cache.lastSessionResult;
          }
        } catch (e) {
          if (!isAbortError(e)) {
            console.error('Session check failed:', e);
          }
          set({ isSessionChecked: !isAbortError(e) });
          const result = { authenticated: false, did: "", pds: "", timedOut: isAbortError(e) };
          if (!result.timedOut) cache.lastSessionResult = result;
          return result;
        } finally {
          cache.sessionCheckPromise = null;
        }
      })();

      return cache.sessionCheckPromise;
    },
    fetchUserProf: async () => {
      const { did, agent, publicAgent, userProf, setUserProf, isSessionChecked } = get();
      if (!did || !isSessionChecked) return;

      // 取得済み、かつ同じ DID ならスキップ
      if (userProf && userProf.did === did) return;

      const cache = getXrpcAgentCache();
      if (cache.profFetchPromise) return cache.profFetchPromise;

      cache.profFetchPromise = (async () => {
        try {
          console.log(`Fetching profile for ${did} via public AppView...`);
          const res = await publicAgent.get('app.bsky.actor.getProfile', { params: { actor: did as any } });
          if (res.ok) {
            setUserProf(res.data);
          }
        } catch (e) {
          console.error('Failed to fetch user profile:', e);
        } finally {
          cache.profFetchPromise = null;
        }
      })();

      return cache.profFetchPromise;
    },
    logout: async (mode: 'soft' | 'hard') => {
      try {
        const endpoint = mode === 'hard' ? '/api/oauth/logout' : '/api/oauth/soft-logout';
        await fetch(endpoint, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error(`Logout (${mode}) error:`, error);
      } finally {
        getXrpcAgentCache().lastSessionResult = null;
        clearSensitiveDraft();
        set({
          did: "",
          userProf: null,
          serviceUrl: "",
          isSessionChecked: true,
          scope: "",
          missingAppBskyRpcScopes: []
        });
        window.localStorage.removeItem('oauth.did');
      }
    }
  });
});
