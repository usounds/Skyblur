import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import twitterText from 'twitter-text';
import { MatchInfo } from "@/type/types";

export type State = {
  text: string;
  blurredText: string;
  additional: string;
  simpleMode: boolean;
  reply?: string;
  mention?: MatchInfo[]|undefined;
  hashtag?: twitterText.HashtagWithIndices[]|undefined;
};

export type Action = {
  setText: (text: string) => void;
  setBlurredText: (blurredText: string) => void;
  setAdditional: (additional: string) => void;
  setSimpleMode: (simpleMode: boolean) => void;
  setReply: (reply: string) => void;
  setMention: (mention: MatchInfo[]) => void;
  setHashtag: (hashtag: twitterText.HashtagWithIndices[]) => void;
};

export const useTempPostStore = create(
  persist<State & Action>(
    (set) => ({
      text: '',
      blurredText: '',
      additional: '',
      simpleMode: false,
      mention:[],
      hashtag:[],
      setText: (text: string) => set({ text }),
      setBlurredText: (blurredText: string) => set({ blurredText }),
      setAdditional: (additional: string) => set({ additional }),
      setSimpleMode: (simpleMode: boolean) => set({ simpleMode }),
      setReply: (reply: string) => set({ reply }),
      setMention: (mention: MatchInfo[]) => set({ mention }),
      setHashtag: (hashtag: twitterText.HashtagWithIndices[]) => set({ hashtag }),
    }),
    {
      name: 'zustand.temptext', // name of the item in the storage
    }
  )
);