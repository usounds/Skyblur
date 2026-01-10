import { AppBskyActorDefs } from '@atcute/bluesky';
import { Client, simpleFetchHandler } from '@atcute/client';
import { OAuthUserAgent } from '@atcute/oauth-browser-client';
import { create } from 'zustand';

type State = {
  agent: Client | null;
  oauthUserAgent: OAuthUserAgent | null;
  publicAgent: Client;
  userProf: AppBskyActorDefs.ProfileViewDetailed | null;
  did: string;
  isLoginProcess: boolean;
  blueskyLoginMessage: string;
  serviceUrl: string;
  isLoginModalOpened: boolean;
};

type Action = {
  setAgent: (agent: Client | null) => void;
  setOauthUserAgent: (oauthUserAgent: OAuthUserAgent | null) => void;
  setUserProf: (userProf: AppBskyActorDefs.ProfileViewDetailed | null) => void;
  setDid: (did: string) => void;
  setIsLoginProcess: (isLoginProcess: boolean) => void;
  setBlueskyLoginMessage: (blueskyLoginMessage: string) => void;
  setServiceUrl: (setServiceUrl: string) => void;
  setIsLoginModalOpened: (isLoginModalOpened: boolean) => void;
};

export const useXrpcAgentStore = create<State & Action>((set) => ({
  agent: null,
  oauthUserAgent: null,
  publicAgent: new Client({
    handler: simpleFetchHandler({
      service: 'https://public.api.bsky.app',
    }),
  }),
  did: "",
  userProf: null,
  isLoginProcess: false,
  blueskyLoginMessage: '',
  serviceUrl: "",
  isLoginModalOpened: false,
  setAgent: (agent) => set(() => ({ agent: agent })),
  setOauthUserAgent: (oauthUserAgent) => set(() => ({ oauthUserAgent: oauthUserAgent })),
  setUserProf: (userProf) => set(() => ({ userProf: userProf })),
  setDid: (did) => set(() => ({ did: did })),
  setIsLoginProcess: (isLoginProcess) => set(() => ({ isLoginProcess: isLoginProcess })),
  setBlueskyLoginMessage: (blueskyLoginMessage) => set(() => ({ blueskyLoginMessage: blueskyLoginMessage })),
  setServiceUrl: (serviceUrl) => set(() => ({ serviceUrl: serviceUrl })),
  setIsLoginModalOpened: (isLoginModalOpened) => set(() => ({ isLoginModalOpened: isLoginModalOpened })),
}));