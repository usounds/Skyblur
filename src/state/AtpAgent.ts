import { create } from 'zustand';
import { Agent, AtpAgent, AppBskyActorDefs } from '@atproto/api';

type State = {
  agent: Agent | null;
  publicAgent: AtpAgent;
  userProf: AppBskyActorDefs.ProfileViewDetailed | null;
  did: string;
  isLoginProcess: boolean; // isLoginProcess プロパティを追加
  blueskyLoginMessage:string;
};

type Action = {
  setAgent: (agent: Agent | null) => void;
  setUserProf: (userProf: AppBskyActorDefs.ProfileViewDetailed | null) => void;
  setDid: (did: string) => void;
  setIsLoginProcess: (isLoginProcess: boolean) => void; // setIsLoginProcess メソッドを追加
  setBlueskyLoginMessage: (blueskyLoginMessage: string) => void;
};

export const useAtpAgentStore = create<State & Action>((set) => ({
  agent: null,
  publicAgent: new AtpAgent({
    service: "https://api.bsky.app"
  }),
  did: "", 
  userProf: null,
  isLoginProcess: true, // isLoginProcessの初期値をtrueに設定
  blueskyLoginMessage:'',
  setAgent: (agent) => set(() => ({ agent: agent })),
  setUserProf: (userProf) => set(() => ({ userProf: userProf })),
  setDid: (did) => set(() => ({ did: did })),
  setIsLoginProcess: (isLoginProcess) => set(() => ({ isLoginProcess: isLoginProcess })), // メソッドを追加
  setBlueskyLoginMessage : (blueskyLoginMessage) => set(() => ({ blueskyLoginMessage: blueskyLoginMessage })), // メソッドを追加

}));