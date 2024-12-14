import { create } from 'zustand';
import { Agent, AtpAgent } from '@atproto/api';

type State = {
  agent: Agent | null;
  publicAgent: AtpAgent;
  did: string;  // did の型を string に変更
};

type Action = {
    setAgent: (agent: Agent | null) => void;
    setDid: (did: string) => void;
  };

export const useAtpAgentStore = create<State & Action>((set) => ({
  agent: null,
  publicAgent: new AtpAgent({
    service: "https://api.bsky.app"
  }),
  did: "",  // did の初期値を "" に設定
  setAgent: (agent) => set(() => ({ agent: agent })),
  setDid: (did) => set(() => ({ did: did })),  // did を設定するアクション
}));