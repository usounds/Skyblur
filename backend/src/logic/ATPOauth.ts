import {
    CompositeDidDocumentResolver,
    CompositeHandleResolver,
    LocalActorResolver,
    PlcDidDocumentResolver,
    WebDidDocumentResolver,
    WellKnownHandleResolver,
} from '@atcute/identity-resolver';
import { NodeDnsHandleResolver } from '@atcute/identity-resolver-node';
import { OAuthClient, type OAuthSession, type ClientAssertionPrivateJwk } from '@atcute/oauth-node-client';
import type { Env, OAuthStoreDO } from '../index';

const oauthClients = new Map<string, OAuthClient>();
const sessionCache = new Map<string, { session: OAuthSession, expiresAt: number }>();

export const scopeList = [
    "atproto",
    "include:uk.skyblur.permissionSet",
    "rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview",
    "repo:app.bsky.feed.post?action=create&action=delete",
    "repo:app.bsky.feed.generator?action=create&action=update&action=delete",
    "repo:app.bsky.feed.threadgate?action=create&action=update&action=delete",
    "repo:app.bsky.feed.postgate?action=create&action=update&action=delete",
    "rpc:app.bsky.feed.getFeedGenerator?aud=*",
    "rpc:app.bsky.feed.searchPosts?aud=*",
    "blob:*/*",
].join(" ");

/**
 * Durable Object をバックエンドとした OAuth ストレージ
 */

/**
 * Durable Object をバックエンドとした OAuth ストレージ
 */
class DurableObjectStore {
    private aesKey: CryptoKey | null = null;

    constructor(
        private namespace: DurableObjectNamespace<OAuthStoreDO>,
        private name: string,
        private encryptionKeyStr?: string
    ) { }

    private getStub() {
        const id = this.namespace.idFromName('oauth_storage');
        return this.namespace.get(id);
    }

    private async getKey(): Promise<CryptoKey | null> {
        if (this.aesKey) return this.aesKey;
        if (!this.encryptionKeyStr) return null;

        try {
            // base64 decode
            const binaryKey = Uint8Array.from(atob(this.encryptionKeyStr), c => c.charCodeAt(0));
            this.aesKey = await crypto.subtle.importKey(
                "raw",
                binaryKey,
                { name: "AES-GCM" },
                false,
                ["encrypt", "decrypt"]
            );
            return this.aesKey;
        } catch (e) {
            console.error("Failed to import encryption key", e);
            return null;
        }
    }

    async get(key: string): Promise<any> {
        const fullKey = `${this.name}:${key}`;
        const res = await this.getStub().fetch(`http://do/?key=${encodeURIComponent(fullKey)}`, {
            method: 'GET'
        });
        if (res.status === 404) return undefined;

        const data = await res.json();

        // 復号化を試みる
        if (data && typeof data === 'object' && (data as any).__encrypted) {
            try {
                const decrypted = await this.decryptData(data);
                return this.revive(decrypted);
            } catch (e) {
                console.error(`[DurableObjectStore] Failed to decrypt data for ${key}.`);
                console.error(`[DurableObjectStore] Key available: ${!!this.encryptionKeyStr}`);
                if (this.encryptionKeyStr) {
                    console.error(`[DurableObjectStore] Key length: ${this.encryptionKeyStr.length}`);
                }
                console.error(`[DurableObjectStore] Error details:`, e);
                // 復号できない場合は読めないものとして扱う
                return undefined;
            }
        }

        return this.revive(data);
    }

    async set(key: string, value: any): Promise<void> {
        const fullKey = `${this.name}:${key}`;
        // データ変換: replace -> 暗号化 (optional)
        const replaced = this.replace(value);
        let payload = replaced;

        if (this.encryptionKeyStr) {
            try {
                payload = await this.encryptData(replaced);
            } catch (e) {
                console.error(`Failed to encrypt data for ${key}`, e);
                throw e;
            }
        }

        const res = await this.getStub().fetch(`http://do/?key=${encodeURIComponent(fullKey)}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            throw new Error(`Failed to store ${this.name}:${key}: ${res.statusText}`);
        }
    }

    private async encryptData(data: any): Promise<any> {
        const key = await this.getKey();
        if (!key) return data;

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedData = new TextEncoder().encode(JSON.stringify(data));

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            encodedData
        );

        return {
            __encrypted: true,
            iv: btoa(String.fromCharCode(...iv)),
            data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
        };
    }

    private async decryptData(encryptedWrapper: any): Promise<any> {
        const key = await this.getKey();
        if (!key) throw new Error("No encryption key available");

        const iv = Uint8Array.from(atob(encryptedWrapper.iv), c => c.charCodeAt(0));
        const data = Uint8Array.from(atob(encryptedWrapper.data), c => c.charCodeAt(0));

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            data
        );

        const decoded = new TextDecoder().decode(decrypted);
        return JSON.parse(decoded);
    }

    private replace(obj: any): any {
        if (obj instanceof Uint8Array) {
            return { __type: 'Uint8Array', data: Array.from(obj) };
        }
        if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
                return obj.map(item => this.replace(item));
            }
            const next: any = {};
            for (const [k, v] of Object.entries(obj)) {
                next[k] = this.replace(v);
            }
            return next;
        }
        return obj;
    }

    private revive(obj: any): any {
        if (obj && typeof obj === 'object') {
            if (obj.__type === 'Uint8Array' && Array.isArray(obj.data)) {
                return new Uint8Array(obj.data);
            }
            if (Array.isArray(obj)) {
                return obj.map(item => this.revive(item));
            }
            const next: any = {};
            for (const [k, v] of Object.entries(obj)) {
                next[k] = this.revive(v);
            }
            return next;
        }
        return obj;
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
    if (env.API_HOST) {
        const host = env.API_HOST;
        let proto = 'https';
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
            proto = 'http'; // ローカル時は http 固定（必要に応じて）
        }
        return `${proto}://${host}`;
    }

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

    const clientId = `${effectiveOrigin}/oauth/client-metadata.json`;
    const jwksUri = `${effectiveOrigin}/oauth/jwks.json`;

    // 暗号化キーを渡す
    const encryptionKey = env.DATA_ENCRYPTION_KEY;
    // console.log(`[ATPOauth] Initializing client for ${effectiveOrigin}. Encryption key stored: ${!!encryptionKey}, length: ${encryptionKey?.length}`);

    const sessionStore = new DurableObjectStore(env.SKYBLUR_DO, 'session', encryptionKey) as any;
    const stateStore = new DurableObjectStore(env.SKYBLUR_DO, 'state', encryptionKey) as any;

    const privateKeyRaw = env.OAUTH_PRIVATE_KEY_JWK;
    if (!privateKeyRaw) {
        console.error('Environment keys available:', Object.keys(env));
        throw new Error('OAUTH_PRIVATE_KEY_JWK is not set. For local dev, please ensure it is defined in .dev.vars or wrestler.jsonc vars.');
    }

    const privateKey = JSON.parse(privateKeyRaw);
    const importedKey: ClientAssertionPrivateJwk = {
        ...privateKey,
        kid: 'k1',
        alg: 'ES256',
    };

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
            scope: scopeList,
        },
        keyset: [importedKey],
        stores: {
            sessions: sessionStore,
            states: stateStore,
        },
        async requestLock(name, fn) {
            const id = env.SKYBLUR_DO.idFromName('oauth_storage');
            const stub = env.SKYBLUR_DO.get(id);
            const lockKey = `lock:${name}`;
            const maxAttempts = 20; // 最大10秒程度待つ

            for (let i = 0; i < maxAttempts; i++) {
                const res = await stub.fetch(`http://do/lock?key=${encodeURIComponent(lockKey)}`, {
                    method: 'POST'
                });

                if (res.ok) {
                    try {
                        return await fn();
                    } finally {
                        // 処理が終わったら必ずロック解除
                        await stub.fetch(`http://do/unlock?key=${encodeURIComponent(lockKey)} `, {
                            method: 'POST'
                        });
                    }
                }

                if (res.status === 423) {
                    // ロック中の場合は少し待って再試行
                    // ランダムなバックオフ (200ms - 800ms)
                    const wait = 200 + Math.floor(Math.random() * 600);
                    await new Promise(resolve => setTimeout(resolve, wait));
                    continue;
                }

                throw new Error(`Failed to acquire lock: ${res.status} ${res.statusText}`);
            }

            throw new Error(`Lock acquisition timed out for ${name}`);
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
            expiresAt: now + 30 * 60 * 1000, // 30分キャッシュ
        });

        return session;
    } catch (error: any) {
        console.error(`[OAuth] Failed to restore session for DID: ${did}`, error);
        if (error instanceof Error) {
            console.error(error.stack);
        }
        // ログアウト後のセッション復元エラーは静かに処理
        if (error?.name === 'TokenRefreshError' || error?.message?.includes('session was deleted')) {
            // セッションが削除されている場合はキャッシュもクリア
            sessionCache.delete(did);
        }
        // エラーを再スロー（呼び出し元で処理）
        throw error;
    }
}
