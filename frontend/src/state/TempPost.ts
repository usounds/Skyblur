import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type State = {
  text: string;
  additional: string;
  simpleMode: boolean;
  reply?: string;
  encryptKey?: string;
  visibility?: string;
};

type Action = {
  setText: (text: string) => void;
  setAdditional: (additional: string) => void;
  setSimpleMode: (simpleMode: boolean) => void;
  setReply: (reply: string) => void;
  setEncryptKey: (encryptKey: string) => void;
  setVisibility: (visibility: string) => void;
};

export const useTempPostStore = create(
  persist<State & Action>(
    (set) => ({
      text: '',
      additional: '',
      simpleMode: false,
      visibility: 'public',
      setText: (text: string) => set({ text }),
      setAdditional: (additional: string) => set({ additional }),
      setSimpleMode: (simpleMode: boolean) => set({ simpleMode }),
      setReply: (reply: string) => set({ reply }),
      setEncryptKey: (encryptKey: string) => set({ encryptKey }),
      setVisibility: (visibility: string) => set({ visibility }),
    }),
    {
      name: 'zustand.temptext', // name of the item in the storage
    }
  )
);