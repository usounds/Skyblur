import { VISIBILITY_LIST, VISIBILITY_PASSWORD, VISIBILITY_PUBLIC } from '@/types/types';
import type { PostView } from '@/types/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearSensitiveDraft, useSensitiveDraftStore } from './SensitiveDraft';

export type ReplyPostSnapshot = {
  uri: string;
  cid: string;
  text: string;
  createdAt: string;
  indexedAt: string;
  reply?: {
    parent: {
      cid: string;
      uri: string;
    };
    root: {
      cid: string;
      uri: string;
    };
  };
};

export function toReplyPostSnapshot(replyPost?: PostView): ReplyPostSnapshot | undefined {
  if (!replyPost) return undefined;

  return {
    uri: replyPost.uri,
    cid: replyPost.cid,
    text: replyPost.record.text,
    createdAt: replyPost.record.createdAt,
    indexedAt: replyPost.indexedAt,
    reply: replyPost.record.reply ? {
      parent: {
        cid: replyPost.record.reply.parent.cid,
        uri: replyPost.record.reply.parent.uri,
      },
      root: {
        cid: replyPost.record.reply.root.cid,
        uri: replyPost.record.reply.root.uri,
      },
    } : undefined,
  };
}

export function fromReplyPostSnapshot(replyPost?: ReplyPostSnapshot): PostView | undefined {
  if (!replyPost) return undefined;

  return {
    uri: replyPost.uri,
    cid: replyPost.cid,
    author: {} as PostView['author'],
    record: {
      text: replyPost.text,
      createdAt: replyPost.createdAt,
      ...(replyPost.reply ? { reply: replyPost.reply } : {}),
    },
    indexedAt: replyPost.indexedAt,
  };
}

function isSameReplyPostSnapshot(
  current: ReplyPostSnapshot | undefined,
  next: ReplyPostSnapshot | undefined,
) {
  return current?.uri === next?.uri
    && current?.cid === next?.cid
    && current?.text === next?.text
    && current?.createdAt === next?.createdAt
    && current?.indexedAt === next?.indexedAt
    && current?.reply?.parent.cid === next?.reply?.parent.cid
    && current?.reply?.parent.uri === next?.reply?.parent.uri
    && current?.reply?.root.cid === next?.reply?.root.cid
    && current?.reply?.root.uri === next?.reply?.root.uri;
}

type State = {
  text: string;
  additional: string;
  simpleMode: boolean;
  reply?: string;
  replyPostSnapshot?: ReplyPostSnapshot;
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
  setReplyPost: (replyPost?: PostView) => void;
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
      reply: '',
      replyPostSnapshot: undefined,
      encryptKey: '',
      visibility: VISIBILITY_PUBLIC,
      listUri: undefined,
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
      setReplyPost: (replyPost?: PostView) => set((state) => {
        const next = toReplyPostSnapshot(replyPost);
        if (isSameReplyPostSnapshot(state.replyPostSnapshot, next) && state.reply === (replyPost?.uri ?? "")) {
          return {};
        }
        return { replyPostSnapshot: next, reply: replyPost?.uri ?? "" };
      }),
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
          replyPostSnapshot: undefined,
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
        replyPostSnapshot: state.replyPostSnapshot,
        visibility: state.visibility,
        listUri: state.listUri,
        limitConsecutive: state.limitConsecutive,
      }),
    }
  )
);
