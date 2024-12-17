
import { PartialReablocksTheme } from 'reablocks';

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

export const COLLECTION = 'uk.skyblur.post';
export const MODAL_TIME = 600;


export type PostListItem = {
    blur: PostData;
    blurATUri: string;
    postURL?: string;
    blurURL?: string;
}


export const customTheme: PartialReablocksTheme = {
    components: {
        button: {
            base:"inline-flex whitespace-no-wrap select-none items-center justify-center px-2.5 py-1 rounded-lg font-sans text-primary font-semibold",
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
        divider:{
            variant:{
                secondary: "bg-gradient-to-r from-transparent to-transparent via-gray-300"
            }

        },
        textarea:{
            base:"flex relative flex-row items-center flex-nowrap box-border transition-colors rounded-lg bg-panel border border-gray-300 text-text-primary hover:border-gray-300 hover:after:bg-[radial-gradient(circle,_#105EFF_0%,_#105EFF_36%,_#D1D5DB_100%)] hover:after:content-[\"\"] hover:after:absolute hover:after:mx-1 hover:after:h-px after:z-[2] hover:after:rounded hover:after:-bottom-[1px] hover:after:inset-x-0.5 disabled-within:hover:after:content-none",
            disabled: "border-gray-300"
        }
    },
};
