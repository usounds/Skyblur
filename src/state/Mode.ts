import { create } from 'zustand';

type State = {
  mode: string;
};

type Action = {
  setMode: (mode: string) => void;
};

export const useModeStore = create<State & Action>((set) => ({
  mode: 'login',
  setMode: (mode: string) => set({ mode }),
}));