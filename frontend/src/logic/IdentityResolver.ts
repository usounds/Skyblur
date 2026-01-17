import {
    LocalActorResolver,
    CompositeHandleResolver,
    CompositeDidDocumentResolver,
    DohJsonHandleResolver,
    PlcDidDocumentResolver,
    WebDidDocumentResolver,
    type HandleResolver,
} from '@atcute/identity-resolver';

// カスタムハンドルリゾルバー: API route経由でCORSを回避
class ProxyHandleResolver implements HandleResolver {
    async resolve(handle: `${string}.${string}`): Promise<`did:plc:${string}` | `did:web:${string}`> {
        const res = await fetch(`/api/resolve-handle?handle=${encodeURIComponent(handle)}`);
        if (!res.ok) {
            throw new Error(`Failed to resolve handle: ${handle}`);
        }
        const data = await res.json() as { did: string };
        if (!data.did) {
            throw new Error(`Invalid response for handle: ${handle}`);
        }
        return data.did as `did:plc:${string}` | `did:web:${string}`;
    }
}

const handleResolver = new CompositeHandleResolver({
    strategy: 'race',
    methods: {
        http: new ProxyHandleResolver(),
        dns: new DohJsonHandleResolver({ dohUrl: 'https://cloudflare-dns.com/dns-query' }),
    },
});

const didDocumentResolver = new CompositeDidDocumentResolver({
    methods: {
        plc: new PlcDidDocumentResolver({}),
        web: new WebDidDocumentResolver({}),
    },
});

export const IdentityResolver = new LocalActorResolver({
    handleResolver,
    didDocumentResolver,
});
