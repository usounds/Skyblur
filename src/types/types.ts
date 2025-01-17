
import { PartialReablocksTheme } from 'reablocks';
import { AppBskyEmbedImages, AppBskyActorDefs, AppBskyEmbedVideo, AppBskyEmbedExternal, AppBskyEmbedRecordWithMedia, ComAtprotoLabelDefs, } from '@atproto/api';

export type DIDDocument = {
    '@context': string[];
    id: string;
    alsoKnownAs?: string[];
    verificationMethod?: any[];
    service?: Service[]; 
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

export type Preference = {
    myPage:{
        isUseMyPage: boolean
        description: string
    }
}

export const POST_COLLECTION = 'uk.skyblur.post';
export const PREFERENCE_COLLECTION = 'uk.skyblur.preference';
export const MODAL_TIME = 600;

export type PostListItem = {
    blur: PostData;
    blurATUri: string;
    postURL?: string;
    blurURL?: string;
    modal:boolean;
    isDetailDisplay:boolean;
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

export const customTheme: PartialReablocksTheme = {
    components: {
        button: {
            base: "inline-flex whitespace-no-wrap select-none items-center justify-center px-2.5 py-1 rounded-lg font-sans text-text-primary font-semibold",
        },
        input: {
            base:"flex relative flex-row items-center flex-nowrap box-border transition-colors rounded-lg bg-panel border border-gray-300 text-text-primary hover:border-gray-300 hover:after:bg-[radial-gradient(circle,_#105EFF_0%,_#105EFF_55%,_#D1D5DB_90%)]  hover:after:content-[\"\"] hover:after:absolute hover:after:mx-1 hover:after:h-px after:z-[2] hover:after:rounded hover:after:-bottom-[1px] hover:after:inset-x-0.5",
            focused:
                'rounded-lg focus-within:after:bg-[radial-gradient(circle,_#105EFF_10%,_#105EFF_12%,_#D1D5DB_100%)] focus-within:after:content-[""] focus-within:after:absolute focus-within:after:mx-0 focus-within:after:h-px after:z-[2] focus-within:after:rounded focus-within:after:-bottom-[1px] focus-within:after:inset-x-1.5'
            
        },
        textarea: {
            base:"flex relative flex-row items-center flex-nowrap box-border transition-colors rounded-lg bg-panel border border-gray-300 text-text-primary hover:border-gray-300 hover:after:bg-[radial-gradient(circle,_#105EFF_0%,_#105EFF_55%,_#D1D5DB_90%)]  hover:after:content-[\"\"] hover:after:absolute hover:after:mx-1 hover:after:h-px after:z-[2] hover:after:rounded hover:after:-bottom-[1px] hover:after:inset-x-0.5",
        },
        checkbox: {
            label: {
                base: "text-gray-600",
                checked: "checked"
            }
        },
        callout: {
            base: {
                variant: {
                    error: "bg-red-100 border-error"
                }

            }

        },
        divider: {
            variant: {
                secondary: "bg-gradient-to-r from-transparent to-transparent via-gray-300"
            }

        },
        stepper: {
            base:"grid grid-cols-[min-content_1fr] gap-x-4 bg-white",
            step: {
                    base: "border-l translate-x-1/2 bg-white",
                    marker:{
                        base:"rounded-full w-[9px] h-[9px] bg-secondary"
                    }
            }
        },
        toggle:{
            base:"flex items-center justify-start cursor-pointer bg-secondary box-border border border-panel-accent rounded-full hover:bg-primary-hover transition-[background-color] ease-in-out duration-300"


        },
        dotsLoader:{
            dot:"rounded-[50%] bg-gray-900"

        },
        notification:{
            positions:"fixed z-[9998] h-auto -translate-x-2/4 mb-1 px-24 py-0 left-2/4 top-[80px]",
            notification:{
                base:"flex relative text-base w-[350px] rounded-sm mb-2.5 py-2 px-4 bg-panel text-text-primary border-panel-accent border mx-3",
                variants:{
                    success:{
                        base : "mx-4 bg-white border border-success"
                    }
                }
            }
        }
    },
};
