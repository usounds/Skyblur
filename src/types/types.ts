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

export type  PostData = {
    text: string; 
    additional: string; 
    $type: string; 
    createdAt: string; 
    uri: string; 
}

export const COLLECTION = 'uk.skyblur.post';


export type PostForDelete = {
    text: string; 
    postATUri: string; 
    blurATUri: string; 
    createdAt: string; 
}