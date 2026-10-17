import * as didJWT from 'did-jwt';
import {
  Resolver,
  DIDDocument,
  DIDResolutionResult,
} from 'did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { getResolver as getPlcResolver } from '@/logic/DidPlcResolver';
import type { Env } from '@/index';

const DID_DOCUMENT_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const DID_DOCUMENT_CACHE_PREFIX = 'diddoc_';

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
  audience: string,
  resolver = resolverInstance,
) => {
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  return didJWT.verifyJWT(token, {
    resolver,
    audience,
  });
};

type CachedDidDocument = {
  document: DIDDocument;
  cachedAt: number;
};

function isDidDocument(value: unknown): value is DIDDocument {
  return !!value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string';
}

function getDidDocumentCacheStub(env: Pick<Env, 'SKYBLUR_DO'>) {
  const namespace = env.SKYBLUR_DO;
  const id = namespace.idFromName('global_cache');
  return namespace.get(id);
}

/**
 * Resolve issuer DIDs through the existing global DO cache. The cached
 * document is only suitable for non-authentication uses; credential
 * verification must pass forceRefresh so that rotated or revoked signing keys
 * are never accepted from a stale document.
 */
export function createCachedResolver(
  env: Pick<Env, 'SKYBLUR_DO'>,
  forceRefresh = false,
) {
  // Per-resolver memoisation of forced resolutions, so that verifying one
  // token against several audiences resolves each DID only once.
  const forcedResolutions = new Map<string, Promise<DIDResolutionResult>>();

  const resolveFresh = async (did: string): Promise<DIDResolutionResult> => {
    const stub = getDidDocumentCacheStub(env);
    const cacheKey = `${DID_DOCUMENT_CACHE_PREFIX}${did}`;
    const resolved = await resolverInstance.resolve(did);
    if (resolved.didDocument) {
      await stub.fetch(
        new Request(`http://do/cache?key=${encodeURIComponent(cacheKey)}`, {
          method: 'PUT',
          body: JSON.stringify({ document: resolved.didDocument, cachedAt: Date.now() } satisfies CachedDidDocument),
        }),
      );
    }
    return resolved;
  };

  return {
    resolve: async (did: string) => {
      if (forceRefresh) {
        let pending = forcedResolutions.get(did);
        if (!pending) {
          pending = resolveFresh(did);
          forcedResolutions.set(did, pending);
          pending.catch(() => forcedResolutions.delete(did));
        }
        return pending;
      }

      const stub = getDidDocumentCacheStub(env);
      const cacheKey = `${DID_DOCUMENT_CACHE_PREFIX}${did}`;

      {
        const cachedResponse = await stub.fetch(
          new Request(`http://do/cache?key=${encodeURIComponent(cacheKey)}`),
        );
        if (cachedResponse.ok) {
          const cached = await cachedResponse.json() as CachedDidDocument | DIDDocument;
          if (cached && typeof cached === 'object' && 'document' in cached
            && isDidDocument(cached.document)
            && Number.isFinite(cached.cachedAt)
            && Date.now() - cached.cachedAt < DID_DOCUMENT_CACHE_TTL_MS) {
            return { didDocument: cached.document, didDocumentMetadata: {}, didResolutionMetadata: {} };
          }
        }
      }

      const resolved = await resolverInstance.resolve(did);
      if (resolved.didDocument) {
        await stub.fetch(
          new Request(`http://do/cache?key=${encodeURIComponent(cacheKey)}`, {
            method: 'PUT',
            body: JSON.stringify({ document: resolved.didDocument, cachedAt: Date.now() } satisfies CachedDidDocument),
          }),
        );
      }
      return resolved;
    },
  };
}

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
