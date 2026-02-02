import { Client, CredentialManager } from '@atcute/client';

export interface TestClientConfig {
    service?: string;
    identifier?: string;
    password?: string;
    proxyDid?: string;
    proxyServiceId?: string;
}

export class SkyblurTestClient {
    public manager: CredentialManager;
    public client: Client;
    public proxyClient: Client | null = null;

    private config: TestClientConfig;

    constructor(config: TestClientConfig = {}) {
        this.config = {
            service: 'https://bsky.social',
            proxyDid: 'did:web:dev.skyblur.uk',
            proxyServiceId: '#skyblur_api',
            ...config
        };
        this.manager = new CredentialManager({ service: this.config.service! });
        this.client = new Client({ handler: this.manager });
    }

    async login(identifier?: string, password?: string) {
        const id = identifier || this.config.identifier;
        const pwd = password || this.config.password;

        if (!id || !pwd) {
            throw new Error("Identifier and password are required for login.");
        }

        await this.manager.login({ identifier: id, password: pwd });

        // Setup proxy client after login
        if (this.config.proxyDid && this.config.proxyServiceId) {
            this.proxyClient = new Client({
                handler: this.manager,
                proxy: {
                    did: this.config.proxyDid as `did:${string}:${string}`,
                    serviceId: this.config.proxyServiceId as `#${string}`
                }
            });
        }
    }

    async getPost(uri: string, password?: string) {
        if (!this.proxyClient) {
            throw new Error("Proxy client is not initialized. Call login() first or ensure proxy config is correct.");
        }

        const nsid = 'uk.skyblur.post.getPost';
        const { data } = await this.proxyClient.post(nsid, {
            input: {
                uri: uri as any,
                password
            }
        });
        return data;
    }

    async storePost(payload: any) {
        if (!this.proxyClient) {
            throw new Error("Proxy client is not initialized.");
        }

        const nsid = 'uk.skyblur.post.store';
        const { data } = await this.proxyClient.post(nsid, {
            input: payload
        });
        return data;
    }

    // Add other methods as needed: decrypt, etc.
}
