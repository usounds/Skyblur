
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
            colors: {
                primary: {
                },
            }
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
                secondary: "bg-gradient-to-r from-transparent to-transparent via-gray-400"
            }

        }
    },
};
