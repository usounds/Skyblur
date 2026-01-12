import {
    CompositeDidDocumentResolver,
    CompositeHandleResolver,
    LocalActorResolver,
    PlcDidDocumentResolver,
    WebDidDocumentResolver,
    WellKnownHandleResolver,
} from '@atcute/identity-resolver';
import { NodeDnsHandleResolver } from '@atcute/identity-resolver-node';
import { OAuthClient, importJwkKey, type OAuthSession } from '@atcute/oauth-node-client';
import type { Env, OAuthStoreDO } from '../index';

const oauthClients = new Map<string, OAuthClient>();
const sessionCache = new Map<string, { session: OAuthSession, expiresAt: number }>();

/**
 * Durable Object をバックエンドとした OAuth ストレージ
 */
class DurableObjectStore {
    constructor(private namespace: DurableObjectNamespace<OAuthStoreDO>, private name: string) { }

    private getStub() {
        const id = this.namespace.idFromName('oauth_storage');
        return this.namespace.get(id);
    }

    async get(key: string): Promise<any> {
        const res = await this.getStub().fetch(`http://do/?key=${this.name}:${key}`, {
            method: 'GET'
        });
        if (res.status === 404) return undefined;
        return await res.json();
    }

    async set(key: string, value: any): Promise<void> {
        await this.getStub().fetch(`http://do/?key=${this.name}:${key}`, {
            method: 'PUT',
            body: JSON.stringify(value)
        });
    }

    async delete(key: string): Promise<void> {
        await this.getStub().fetch(`http://do/?key=${this.name}:${key}`, {
            method: 'DELETE'
        });
    }

    async clear(): Promise<void> {
    }
}

/**
 * キャッシュからセッションを削除する
 */
export function clearSessionCache(did: string) {
    sessionCache.delete(did);
}

/**
 * リクエストからオリジンを取得する
 * 開発時はホスト名を使い、不明な場合は本番ドメインを返す
 */
export function getRequestOrigin(request: Request, env: Env) {
    const url = new URL(request.url);
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;

    let proto = 'https';
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
        proto = url.protocol.replace(':', '') || 'http';
    }

    return `${proto}://${host}`;
}

export async function getOAuthClient(env: Env, apiOrigin: string) {
    // effectiveOrigin はこの API サーバー自身のオリジン（Client ID のベース）
    const effectiveOrigin = apiOrigin;

    if (oauthClients.has(effectiveOrigin)) {
        return oauthClients.get(effectiveOrigin)!;
    }

    // AppView (フロントエンド) のオリジン
    const appViewOrigin = env.APPVIEW_HOST ? `https://${env.APPVIEW_HOST}` : 'https://skyblur.uk';

    const clientId = `${effectiveOrigin}/api/client-metadata.json`;
    const jwksUri = `${effectiveOrigin}/api/jwks.json`;

    const sessionStore = new DurableObjectStore(env.SKYBLUR_DO, 'session') as any;
    const stateStore = new DurableObjectStore(env.SKYBLUR_DO, 'state') as any;

    const privateKeyRaw = env.OAUTH_PRIVATE_KEY_JWK;
    if (!privateKeyRaw) {
        console.error('Environment keys available:', Object.keys(env));
        throw new Error('OAUTH_PRIVATE_KEY_JWK is not set. For local dev, please ensure it is defined in .dev.vars or wrestler.jsonc vars.');
    }

    const privateKey = JSON.parse(privateKeyRaw);
    const importedKey = await importJwkKey(privateKey, { kid: 'k1', alg: 'ES256' });

    // Cloudflare Workers では redirect: 'error' や cache: 'no-cache' が使えないためラップする
    const safeFetch: typeof fetch = (input, init) => {
        const nextInit = { ...init } as any;
        if (nextInit.redirect === 'error') {
            nextInit.redirect = 'manual';
        }
        if (nextInit.cache && nextInit.cache !== 'default') {
            delete nextInit.cache;
        }
        return fetch(input, nextInit);
    };

    const client = new OAuthClient({
        metadata: {
            client_id: clientId,
            redirect_uris: [`${effectiveOrigin}/oauth/callback`],
            jwks_uri: jwksUri,
            scope: "atproto include:uk.skyblur.permissionSet rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview repo:app.bsky.feed.post?action=create&action=delete repo:app.bsky.feed.generator?action=create&action=update&action=delete repo:app.bsky.feed.threadgate?action=create&action=update&action=delete repo:app.bsky.feed.postgate?action=create&action=update&action=delete rpc:app.bsky.feed.getFeedGenerator?aud=* rpc:app.bsky.feed.searchPosts?aud=* blob:*/*",
        },
        keyset: [importedKey],
        stores: {
            sessions: sessionStore,
            states: stateStore,
        },
        fetch: safeFetch,
        actorResolver: new LocalActorResolver({
            handleResolver: new CompositeHandleResolver({
                methods: {
                    dns: new NodeDnsHandleResolver(),
                    http: new WellKnownHandleResolver({ fetch: safeFetch }),
                },
            }),
            didDocumentResolver: new CompositeDidDocumentResolver({
                methods: {
                    plc: new PlcDidDocumentResolver({ fetch: safeFetch }),
                    web: new WebDidDocumentResolver({ fetch: safeFetch }),
                },
            }),
        }),
    });

    oauthClients.set(effectiveOrigin, client);
    return client;
}

/**
 * キャッシュを利用してセッションを復元する。
 */
export async function restoreSession(oauth: OAuthClient, did: string): Promise<OAuthSession> {
    const now = Date.now();
    const cached = sessionCache.get(did);

    if (cached && cached.expiresAt > now) {
        return cached.session;
    }

    try {
        const session = await oauth.restore(did as any);

        sessionCache.set(did, {
            session,
            expiresAt: now + 5 * 60 * 1000,
        });

        return session;
    } catch (error: any) {
        // ログアウト後のセッション復元エラーは静かに処理
        if (error?.name === 'TokenRefreshError' || error?.message?.includes('session was deleted')) {
            // セッションが削除されている場合はキャッシュもクリア
            sessionCache.delete(did);
        }
        // エラーを再スロー（呼び出し元で処理）
        throw error;
    }
}
