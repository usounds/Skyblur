
import { UkSkyblurPost } from '@/lexicon/UkSkyblur';
import { AppBskyActorDefs, AppBskyEmbedExternal, AppBskyEmbedImages, AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo } from '@atcute/bluesky';

export type DIDDocument = {
    '@context': string[];
    id: string;
    alsoKnownAs?: string[];
    verificationMethod?: VerificationMethod[];  // verificationMethodの型を配列に変更
    service?: Service[];
}

export type  AuthorizationServerMetadata = {
  issuer: string;
  request_parameter_supported: boolean;
  request_uri_parameter_supported: boolean;
  require_request_uri_registration: boolean;
  scopes_supported: string[];
  subject_types_supported: string[];
  response_types_supported: string[];
  response_modes_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  ui_locales_supported: string[];
  display_values_supported: string[];
  request_object_signing_alg_values_supported: string[];
  authorization_response_iss_parameter_supported: boolean;
  request_object_encryption_alg_values_supported: string[];
  request_object_encryption_enc_values_supported: string[];
  jwks_uri: string;
  authorization_endpoint: string;
  token_endpoint: string;
  token_endpoint_auth_methods_supported: string[];
  token_endpoint_auth_signing_alg_values_supported: string[];
  revocation_endpoint: string;
  introspection_endpoint: string;
  pushed_authorization_request_endpoint: string;
  require_pushed_authorization_requests: boolean;
  dpop_signing_alg_values_supported: string[];
  client_id_metadata_document_supported: boolean;
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

export const jwks = {
    keys: [
        {
            kty: "EC",
            use: "sig",
            alg: "ES256",
            kid: "d92ba95d-5f71-4d16-9fc4-e683979ecb41",
            crv: "P-256",
            x: "mJHhd--984RgWd7fHI14jcDNQS6bKjFvQYddBaIQmhY",
            y: "u7MGN3U41MYXHZx6Lxny77SI8uLImAF-ulsEN15kPG0"
        }
    ]
}