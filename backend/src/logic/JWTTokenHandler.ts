import * as didJWT from 'did-jwt';
import {
  Resolver,
  DIDDocument,
  DIDResolutionResult,
} from 'did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { getResolver as getPlcResolver } from '@/logic/DidPlcResolver';

/* =========================
   Resolver インスタンス
   ========================= */

export const resolverInstance = new Resolver({
  ...getPlcResolver(),
  ...getWebResolver(),
});

/* =========================
   型定義
   ========================= */

export type Service = {
  id: string;
  type: string;
  serviceEndpoint:
    | string
    | Record<string, any>
    | Array<Record<string, any>>;
};

/* =========================
   JWT 検証
   ========================= */

export const verifyJWT = async (
  auth: string,
  audience: string
) => {
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  return didJWT.verifyJWT(token, {
    resolver: resolverInstance,
    audience,
  });
};

/* =========================
   DID Document 取得
   ========================= */

export const fetchDidDocument = async (
  did: string
): Promise<DIDDocument> => {
  const result: DIDResolutionResult =
    await resolverInstance.resolve(did);

  if (!result.didDocument) {
    throw new Error(
      `Failed to resolve DID: ${did}`
    );
  }

  return result.didDocument;
};

/* =========================
   Service Endpoint 取得
   ========================= */

export const fetchServiceEndpoint = async (
  did: string
) => {
  const didDocument = await fetchDidDocument(did);

  const service = didDocument.service?.find(
    (s: Service) => s.id === '#atproto_pds'
  );

  if (!service?.serviceEndpoint) {
    throw new Error(
      'Service #atproto_pds not found'
    );
  }

  return service.serviceEndpoint;
};
