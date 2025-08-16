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

export type DIDDocument = {
    '@context': string[];
    id: string;
    alsoKnownAs?: string[];
    verificationMethod?: VerificationMethod[];  // verificationMethodの型を配列に変更

  service?: PDSService[]; // ここを Service → PDSService に変更
}

export type VerificationMethod = {
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase: string;
}

export type PDSService = {
    id: string;
    type: string;
    serviceEndpoint: string;
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