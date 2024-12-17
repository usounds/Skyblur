import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type State = {
  text: string;
  additional: string;
  simpleMode: boolean;
  reply?: string;
};

type Action = {
  setText: (text: string) => void;
  setAdditional: (additional: string) => void;
  setSimpleMode: (simpleMode: boolean) => void;
  setReply: (reply: string) => void;
};

export const useTempPostStore = create(
  persist<State & Action>(
    (set) => ({
      text: '',
      additional: '',
      simpleMode: false,
      setText: (text: string) => set({ text }),
      setAdditional: (additional: string) => set({ additional }),
      setSimpleMode: (simpleMode: boolean) => set({ simpleMode }),
      setReply: (reply: string) => set({ reply }),
    }),
    {
      name: 'zustand.temptext', // name of the item in the storage
    }
  )
);