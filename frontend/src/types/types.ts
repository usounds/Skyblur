
import { UkSkyblurPost } from '@/lexicon/UkSkyblur';
import { AppBskyActorDefs, AppBskyEmbedExternal, AppBskyEmbedImages, AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo } from '@atcute/bluesky';

export type DIDDocument = {
    '@context': string[];
    id: string;
    alsoKnownAs?: string[];
    verificationMethod?: VerificationMethod[];  // verificationMethodの型を配列に変更
    service?: Service[];
}

// VerificationMethodの型を定義
export type VerificationMethod = {
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase: string;
}

export type Service = {
    id: string;
    type: string;
    serviceEndpoint: string;
}

export type EncryptBody = {
    text: string;
    additional: string;
}

export const SKYBLUR_POST_COLLECTION = 'uk.skyblur.post';
export const SKYBLUR_PREFERENCE_COLLECTION = 'uk.skyblur.preference';
export const MODAL_TIME = 600;
export const VISIBILITY_PUBLIC = 'public' as string;
export const VISIBILITY_PASSWORD = 'password' as string;
export const VISIBILITY_LOGIN = 'login' as string;
export const THREADGATE_MENTION = 'mention' as string;
export const THREADGATE_FOLLOWING = 'following' as string;
export const THREADGATE_FOLLOWERS = 'followers' as string;
export const THREADGATE_QUOTE_ALLOW = 'quote' as string;

export type PostListItem = {
    blur: UkSkyblurPost.Record;
    blurATUri: string;
    postURL?: string;
    blurURL?: string;
    modal: boolean;
    isDetailDisplay: boolean;
    isDecrypt: boolean;
    encryptKey?: string;
}

export interface PostView {
    uri: string
    cid: string
    author: AppBskyActorDefs.ProfileViewBasic
    record: {
        text: string
        createdAt: string
        reply?: {
            parent: {
                cid: string,
                uri: string
            },
            root: {
                cid: string,
                uri: string

            }

        }
    }
    embed?:
    | AppBskyEmbedImages.View
    | AppBskyEmbedVideo.View
    | AppBskyEmbedExternal.View
    | AppBskyEmbedExternal.View
    | AppBskyEmbedRecordWithMedia.View
    | { $type: string;[k: string]: unknown }
    replyCount?: number
    repostCount?: number
    likeCount?: number
    quoteCount?: number
    indexedAt: string
    [k: string]: unknown
}

export const MENTION_REGEX = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g
export const TAG_REGEX =
    // eslint-disable-next-line no-misleading-character-class
    /(^|\s)[#＃]((?!\ufe0f)[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*[^\d\s\p{P}\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]+[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*)?/gu
export const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu