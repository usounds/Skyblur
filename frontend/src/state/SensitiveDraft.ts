import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SensitiveDraftData = {
  text: string;
  additional: string;
  password: string;
  encryptKey: string;
  unlockedBlurUri: string;
  unlockedText: string;
  unlockedAdditional: string;
  unlockedPassword: string;
  updatedAt?: number;
  unlockedUpdatedAt?: number;
};

type SensitiveDraftAction = {
  setSensitiveText: (text: string) => void;
  setSensitiveAdditional: (additional: string) => void;
  setSensitivePassword: (password: string) => void;
  setSensitiveDraft: (draft: Partial<SensitiveDraftData>) => void;
  setUnlockedPasswordPost: (draft: {
    blurUri: string;
    text: string;
    additional: string;
    password: string;
  }) => void;
  clearSensitiveDraft: () => void;
  clearUnlockedPasswordPost: () => void;
};

const emptySensitiveDraft: SensitiveDraftData = {
  text: '',
  additional: '',
  password: '',
  encryptKey: '',
  unlockedBlurUri: '',
  unlockedText: '',
  unlockedAdditional: '',
  unlockedPassword: '',
};

export const useSensitiveDraftStore = create(
  persist<SensitiveDraftData & SensitiveDraftAction, [], [], SensitiveDraftData>(
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
      setUnlockedPasswordPost: (draft) => set({
        unlockedBlurUri: draft.blurUri,
        unlockedText: draft.text,
        unlockedAdditional: draft.additional,
        unlockedPassword: draft.password,
        unlockedUpdatedAt: Date.now(),
      }),
      clearUnlockedPasswordPost: () => set({
        unlockedBlurUri: '',
        unlockedText: '',
        unlockedAdditional: '',
        unlockedPassword: '',
        unlockedUpdatedAt: undefined,
      }),
      clearSensitiveDraft: () => set({ ...emptySensitiveDraft, updatedAt: undefined }),
    }),
    {
      name: 'zustand.sensitive-post-draft',
      partialize: (state) => ({
        text: state.text,
        additional: state.additional,
        password: state.password,
        encryptKey: state.encryptKey,
        unlockedBlurUri: state.unlockedBlurUri,
        unlockedText: state.unlockedText,
        unlockedAdditional: state.unlockedAdditional,
        unlockedPassword: state.unlockedPassword,
        updatedAt: state.updatedAt,
        unlockedUpdatedAt: state.unlockedUpdatedAt,
      }),
    },
  ),
);

export function clearSensitiveDraft() {
  useSensitiveDraftStore.getState().clearSensitiveDraft();
}
