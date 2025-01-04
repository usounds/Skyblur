
import { AppBskyEmbedImages, AppBskyActorDefs, AppBskyEmbedVideo, AppBskyEmbedExternal, AppBskyEmbedRecordWithMedia, ComAtprotoLabelDefs, } from '@atcute/client/lexicons';

import { AppBskyFeedGenerator, } from '@atcute/client/lexicons';

export type DIDDocument = {
    '@context': string[];
    id: string;
    alsoKnownAs?: string[];
    verificationMethod?: any[];
    service?: Service[]; // serviceはundefinedの可能性がある
}

export type DIDResponse = {
    didDocument: DIDDocument;
    didResolutionMetadata: any;
    didDocumentMetadata: any;
}

export type Service = {
    id: string;
    type: string;
    serviceEndpoint: string;
}

export type PostData = {
    text: string;
    additional: string;
    $type: string;
    createdAt: string;
    uri: string;
}

export type MatchInfo = {
    detectedString: string;
    startIndex: number;
    endIndex: number;
    did: string;
}

export const COLLECTION = 'uk.skyblur.post';
export const MODAL_TIME = 600;


export type PostListItem = {
    blur: PostData;
    blurATUri: string;
    postURL?: string;
    blurURL?: string;
    modal:boolean
}


export type FeedList = {
    uri: string;
    cid:string;
    value:AppBskyFeedGenerator.Record;
    avatar?:string;
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
    labels?: ComAtprotoLabelDefs.Label[]
    [k: string]: unknown
}
