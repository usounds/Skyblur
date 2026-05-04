import { AppBskyActorDefs } from '@atcute/bluesky';
import { Client, simpleFetchHandler } from '@atcute/client';
import { create } from 'zustand';

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
};

type SessionCheckResult = {
  authenticated: boolean;
  did: string;
  pds: string;
  timedOut?: boolean;
};

type Action = {
  setUserProf: (userProf: AppBskyActorDefs.ProfileViewDetailed | null) => void;
  setDid: (did: string) => void;
  setBlueskyLoginMessage: (blueskyLoginMessage: string) => void;
  setServiceUrl: (setServiceUrl: string) => void;
  setIsLoginModalOpened: (isLoginModalOpened: boolean) => void;
  setIsSessionChecked: (isSessionChecked: boolean) => void;
  checkSession: () => Promise<SessionCheckResult>;
  fetchUserProf: () => Promise<void>;
  logout: (mode: 'soft' | 'hard') => Promise<void>;
};
const host = typeof window !== 'undefined' ? new URL(window.location.origin).host : '';
const xrpcService = typeof window !== 'undefined' ? window.location.origin : '';
let sessionCheckPromise: Promise<SessionCheckResult> | null = null;
let lastSessionResult: SessionCheckResult | null = null;
let profFetchPromise: Promise<void> | null = null;

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
    setUserProf: (userProf) => set({ userProf }),
    setDid: (did) => set({ did }),
    setBlueskyLoginMessage: (blueskyLoginMessage) => set({ blueskyLoginMessage }),
    setServiceUrl: (serviceUrl) => set({ serviceUrl }),
    setIsLoginModalOpened: (isLoginModalOpened) => set({ isLoginModalOpened }),
    setIsSessionChecked: (isSessionChecked) => {
      if (!isSessionChecked) lastSessionResult = null;
      set({ isSessionChecked });
    },
    checkSession: async () => {
      if (get().isSessionChecked) {
        return { authenticated: !!get().did, did: get().did, pds: get().serviceUrl };
      }
      if (lastSessionResult && !lastSessionResult.timedOut) return lastSessionResult;
      if (sessionCheckPromise) return sessionCheckPromise;

      sessionCheckPromise = (async () => {
        try {
          const res = await fetchWithTimeout('/api/oauth/session', {
            credentials: 'include'
          }, 10_000);
          const data = await res.json() as any;
          if (data.authenticated) {
            const pdsUrl = data.pds || 'https://bsky.social';
            // 変更がある場合のみ更新
            const updates: any = { did: data.did, serviceUrl: pdsUrl, isSessionChecked: true };
            if (data.userProf) {
              updates.userProf = data.userProf;
            }

            if (get().did !== data.did || get().serviceUrl !== pdsUrl || data.userProf || get().scope !== (data.scope || '')) {
              set({ ...updates, scope: data.scope || '' });
            } else {
              set({ isSessionChecked: true });
            }
            lastSessionResult = { authenticated: true, did: data.did, pds: pdsUrl };
            return lastSessionResult;
          } else {
            if (get().did !== "" || get().isSessionChecked !== true) {
              set({ did: "", serviceUrl: "", isSessionChecked: true, userProf: null, scope: "" });
            }
            lastSessionResult = { authenticated: false, did: "", pds: "" };
            return lastSessionResult;
          }
        } catch (e) {
          if (!isAbortError(e)) {
            console.error('Session check failed:', e);
          }
          set({ isSessionChecked: !isAbortError(e) });
          const result = { authenticated: false, did: "", pds: "", timedOut: isAbortError(e) };
          if (!result.timedOut) lastSessionResult = result;
          return result;
        } finally {
          sessionCheckPromise = null;
        }
      })();

      return sessionCheckPromise;
    },
    fetchUserProf: async () => {
      const { did, publicAgent, userProf, setUserProf, isSessionChecked } = get();
      if (!did || !isSessionChecked) return;

      // 取得済み、かつ同じ DID ならスキップ
      if (userProf && userProf.did === did) return;

      if (profFetchPromise) return profFetchPromise;

      profFetchPromise = (async () => {
        try {
          console.log(`Fetching profile for ${did}...`);
          const res = await publicAgent.get('app.bsky.actor.getProfile', { params: { actor: did as any } });
          if (res.ok) {
            setUserProf(res.data);
          }
        } catch (e) {
          console.error('Failed to fetch user profile:', e);
        } finally {
          profFetchPromise = null;
        }
      })();

      return profFetchPromise;
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
        lastSessionResult = null;
        set({
          did: "",
          userProf: null,
          serviceUrl: "",
          isSessionChecked: true,
          scope: ""
        });
        window.localStorage.removeItem('oauth.did');
      }
    }
  });
});
