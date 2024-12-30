import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { XRPC, CredentialManager } from '@atcute/client';
import type { AppBskyActorDefs } from '@atcute/client/lexicons';

type State = {
    apiXrpc: XRPC;
    loginXrpc: XRPC | undefined;
    did: string;
    handle: string;
    userProf: AppBskyActorDefs.ProfileViewDetailed | null;
    isLoginProcess: boolean;
    blueskyLoginMessage: string;
};

type Action = {
    setLoginXrpc: (loginXrpc: XRPC | undefined) => void;
    setDid: (did: string) => void;
    setHandle: (handle: string) => void;
    setUserProf: (userProf: AppBskyActorDefs.ProfileViewDetailed | null) => void;
    setIsLoginProcess: (isLoginProcess: boolean) => void;
    setBlueskyLoginMessage: (blueskyLoginMessage: string) => void;
};

const apiManager = new CredentialManager({ service: 'https://api.bsky.app' });
const apiXrpcInstance = new XRPC({ handler: apiManager });

export const useXrpcStore = create<State & Action>()(
    persist(
        (set) => ({
            apiXrpc: apiXrpcInstance,
            loginXrpc: undefined,
            did: "",
            handle:"",
            userProf: null,
            isLoginProcess: false,
            blueskyLoginMessage: '',
            setUserProf: (userProf) => set(() => ({ userProf: userProf })),
            setLoginXrpc: (loginXrpc: XRPC | undefined) => set({ loginXrpc }),
            setDid: (did: string) => set({ did }),
            setHandle: (handle: string) => set({ handle }),
            setIsLoginProcess: (isLoginProcess) => set(() => ({ isLoginProcess: isLoginProcess })),
            setBlueskyLoginMessage: (blueskyLoginMessage) => set(() => ({ blueskyLoginMessage: blueskyLoginMessage })),
        }),
        {
            name: 'zustand.xrpc',
            partialize: (state) => ({ did: state.did, handle: state.handle } as Partial<State & Action>),
        }
    )
);