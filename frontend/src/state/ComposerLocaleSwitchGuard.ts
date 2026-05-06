import { create } from "zustand";

type ComposerLocaleSwitchGuardState = {
  hasUnsavedComposerChanges: boolean;
  setHasUnsavedComposerChanges: (hasUnsavedComposerChanges: boolean) => void;
  clearHasUnsavedComposerChanges: () => void;
};

export const useComposerLocaleSwitchGuardStore = create<ComposerLocaleSwitchGuardState>((set) => ({
  hasUnsavedComposerChanges: false,
  setHasUnsavedComposerChanges: (hasUnsavedComposerChanges) => set({ hasUnsavedComposerChanges }),
  clearHasUnsavedComposerChanges: () => set({ hasUnsavedComposerChanges: false }),
}));
