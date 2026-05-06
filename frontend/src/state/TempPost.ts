import { VISIBILITY_LIST, VISIBILITY_PASSWORD, VISIBILITY_PUBLIC } from '@/types/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearSensitiveDraft, useSensitiveDraftStore } from './SensitiveDraft';

type State = {
  text: string;
  additional: string;
  simpleMode: boolean;
  reply?: string;
  encryptKey?: string;
  visibility?: string;
  listUri?: string;
  limitConsecutive?: boolean;
};

type Action = {
  setText: (text: string) => void;
  setAdditional: (additional: string) => void;
  setSimpleMode: (simpleMode: boolean) => void;
  setReply: (reply: string) => void;
  setEncryptKey: (encryptKey: string) => void;
  setVisibility: (visibility: string) => void;
  setListUri: (listUri?: string) => void;
  setLimitConsecutive: (limit: boolean) => void;
  clearTempPost: () => void;
};

export const useTempPostStore = create(
  persist<State & Action, [], [], State>(
    (set) => ({
      text: '',
      additional: '',
      simpleMode: false,
      visibility: VISIBILITY_PUBLIC,
      limitConsecutive: false,
      setText: (text: string) => set((state) => {
        if (state.visibility === VISIBILITY_PASSWORD) {
          useSensitiveDraftStore.getState().setSensitiveText(text);
          return { text: '' };
        }
        return { text };
      }),
      setAdditional: (additional: string) => set((state) => {
        if (state.visibility === VISIBILITY_PASSWORD) {
          useSensitiveDraftStore.getState().setSensitiveAdditional(additional);
          return { additional: '' };
        }
        return { additional };
      }),
      setSimpleMode: (simpleMode: boolean) => set({ simpleMode }),
      setReply: (reply: string) => set({ reply }),
      setEncryptKey: (encryptKey: string) => set((state) => {
        if (state.visibility === VISIBILITY_PASSWORD) {
          useSensitiveDraftStore.getState().setSensitivePassword(encryptKey);
        }
        return { encryptKey };
      }),
      setVisibility: (visibility: string) => set((state) => {
        if (visibility === VISIBILITY_PASSWORD && state.visibility !== VISIBILITY_PASSWORD) {
          useSensitiveDraftStore.getState().setSensitiveDraft({
            text: state.text,
            additional: state.additional,
            password: state.encryptKey || '',
            encryptKey: state.encryptKey || '',
          });
          return {
            visibility,
            text: '',
            additional: '',
            encryptKey: '',
            listUri: undefined,
          };
        }

        if (visibility !== VISIBILITY_PASSWORD && state.visibility === VISIBILITY_PASSWORD) {
          const sensitiveDraft = useSensitiveDraftStore.getState();
          clearSensitiveDraft();
          return {
            visibility,
            text: sensitiveDraft.text,
            additional: sensitiveDraft.additional,
            encryptKey: '',
            listUri: visibility === VISIBILITY_LIST ? state.listUri : undefined,
          };
        }

        return {
          visibility,
          listUri: visibility === VISIBILITY_LIST ? state.listUri : undefined,
        };
      }),
      setListUri: (listUri?: string) => set({ listUri }),
      setLimitConsecutive: (limit: boolean) => set({ limitConsecutive: limit }),
      clearTempPost: () => {
        clearSensitiveDraft();
        set({
          text: '',
          additional: '',
          simpleMode: false,
          reply: '',
          encryptKey: '',
          visibility: VISIBILITY_PUBLIC,
          listUri: undefined,
          limitConsecutive: false,
        });
      },
    }),
    {
      name: 'zustand.temptext', // name of the item in the storage
      partialize: (state) => ({
        text: state.visibility === VISIBILITY_PASSWORD ? '' : state.text,
        additional: state.visibility === VISIBILITY_PASSWORD ? '' : state.additional,
        simpleMode: state.simpleMode,
        reply: state.reply,
        visibility: state.visibility,
        listUri: state.listUri,
        limitConsecutive: state.limitConsecutive,
      }),
    }
  )
);
