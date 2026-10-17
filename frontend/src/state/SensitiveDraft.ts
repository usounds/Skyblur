import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SensitiveDraftData = {
  text: string;
  additional: string;
  password: string;
  encryptKey: string;
  updatedAt?: number;
  ownerDid?: string;
};

type PersistedSensitiveDraftData = Pick<
  SensitiveDraftData,
  'text' | 'additional' | 'password' | 'encryptKey' | 'updatedAt' | 'ownerDid'
>;

type SensitiveDraftAction = {
  setSensitiveText: (text: string) => void;
  setSensitiveAdditional: (additional: string) => void;
  setSensitivePassword: (password: string) => void;
  setSensitiveDraft: (draft: Partial<SensitiveDraftData>) => void;
  clearSensitiveDraft: () => void;
};

const emptySensitiveDraft: SensitiveDraftData = {
  text: '',
  additional: '',
  password: '',
  encryptKey: '',
  ownerDid: undefined,
};

export const useSensitiveDraftStore = create(
  persist<SensitiveDraftData & SensitiveDraftAction, [], [], PersistedSensitiveDraftData>(
    (set) => ({
      ...emptySensitiveDraft,
      setSensitiveText: (text) => set({ text, updatedAt: Date.now() }),
      setSensitiveAdditional: (additional) => set({ additional, updatedAt: Date.now() }),
      setSensitivePassword: (password) => set({ password, encryptKey: password, updatedAt: Date.now() }),
      setSensitiveDraft: (draft) => set((state) => ({
        ...state,
        ...draft,
        encryptKey: draft.encryptKey ?? draft.password ?? state.encryptKey,
        password: draft.password ?? draft.encryptKey ?? state.password,
        updatedAt: Date.now(),
      })),
      clearSensitiveDraft: () => set({ ...emptySensitiveDraft, updatedAt: undefined }),
    }),
    {
      name: 'zustand.sensitive-post-draft',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SensitiveDraftData> | undefined;
        return {
          ...currentState,
          text: persisted?.text ?? '',
          additional: persisted?.additional ?? '',
          password: persisted?.password ?? '',
          encryptKey: persisted?.encryptKey ?? persisted?.password ?? '',
          updatedAt: persisted?.updatedAt,
          ownerDid: persisted?.ownerDid,
        };
      },
      partialize: (state) => ({
        text: state.text,
        additional: state.additional,
        password: state.password,
        encryptKey: state.encryptKey,
        updatedAt: state.updatedAt,
        ownerDid: state.ownerDid,
      }),
    },
  ),
);

export function clearSensitiveDraft() {
  useSensitiveDraftStore.getState().clearSensitiveDraft();
}
