import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type State = {
  isHideReactions: boolean;
};

type Action = {
  setIsHideReactions: (isHideReactions: boolean) => void;
};

export const useViewerStore = create<State & Action>()(
  persist(
    (set) => ({
      isHideReactions: false,

      setIsHideReactions: (isHideReactions) => {
        set({ isHideReactions });
      },
    }),
    {
      name: 'zustand.preference.viewer',
      partialize: (state) => ({ isHideReactions: state.isHideReactions }),
    }
  )
);
