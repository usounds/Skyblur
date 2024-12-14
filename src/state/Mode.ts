"use client";
import { create } from 'zustand';

// ステートの型定義
type State = {
  mode: string;
};

// アクションの型定義
type Action = {
  setMode: (mode: string) => void;
};

export const useModeStore = create<State & Action>((set) => ({
  mode: 'login',
  setMode: (mode: string) => set({ mode }), // ここでsetModeを定義
}));