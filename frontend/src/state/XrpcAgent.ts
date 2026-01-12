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

type Action = {
  setUserProf: (userProf: AppBskyActorDefs.ProfileViewDetailed | null) => void;
  setDid: (did: string) => void;
  setBlueskyLoginMessage: (blueskyLoginMessage: string) => void;
  setServiceUrl: (setServiceUrl: string) => void;
  setIsLoginModalOpened: (isLoginModalOpened: boolean) => void;
  setIsSessionChecked: (isSessionChecked: boolean) => void;
  checkSession: () => Promise<{ authenticated: boolean; did: string; pds: string }>;
  fetchUserProf: () => Promise<void>;
};
const host = typeof window !== 'undefined' ? new URL(window.location.origin).host : '';

let sessionCheckPromise: Promise<{ authenticated: boolean; did: string; pds: string }> | null = null;
let profFetchPromise: Promise<void> | null = null;

export const useXrpcAgentStore = create<State & Action>((set, get) => {
  const apiEndpoint = typeof window !== 'undefined'
    ? (window.location.host.includes('dev.skyblur.uk') || window.location.host.includes('localhost')
      ? 'devapi.skyblur.uk'
      : 'api.skyblur.uk')
    : '';

  return ({
    agent: new Client({
      handler: simpleFetchHandler({
        service: apiEndpoint ? `https://${apiEndpoint}` : '',
        // @ts-ignore
        fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
      }),
    }),
    apiProxyAgent: new Client({
      handler: simpleFetchHandler({
        service: apiEndpoint ? `https://${apiEndpoint}` : '',
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
    setIsSessionChecked: (isSessionChecked) => set({ isSessionChecked }),
    checkSession: async () => {
      if (get().isSessionChecked) {
        return { authenticated: !!get().did, did: get().did, pds: get().serviceUrl };
      }
      if (sessionCheckPromise) return sessionCheckPromise;

      sessionCheckPromise = (async () => {
        try {
          const res = await fetch(`https://${apiEndpoint}/oauth/session`, {
            credentials: 'include'
          });
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
            return { authenticated: true, did: data.did, pds: pdsUrl };
          } else {
            if (get().did !== "" || get().isSessionChecked !== true) {
              set({ did: "", serviceUrl: "", isSessionChecked: true, userProf: null, scope: "" });
            }
            return { authenticated: false, did: "", pds: "" };
          }
        } catch (e) {
          console.error('Session check failed:', e);
          set({ isSessionChecked: true });
          return { authenticated: false, did: "", pds: "" };
        } finally {
          sessionCheckPromise = null;
        }
      })();

      return sessionCheckPromise;
    },
    fetchUserProf: async () => {
      const { did, apiProxyAgent, userProf, setUserProf, isSessionChecked } = get();
      if (!did || !isSessionChecked) return;

      // 取得済み、かつ同じ DID ならスキップ
      if (userProf && userProf.did === did) return;

      if (profFetchPromise) return profFetchPromise;

      profFetchPromise = (async () => {
        try {
          console.log(`Fetching profile for ${did}...`);
          const res = await apiProxyAgent.get('app.bsky.actor.getProfile', { params: { actor: did as any } });
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
    }
  });
});