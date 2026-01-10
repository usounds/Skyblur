import {
    LocalActorResolver,
    CompositeHandleResolver,
    CompositeDidDocumentResolver,
    WellKnownHandleResolver,
    DohJsonHandleResolver,
    PlcDidDocumentResolver,
    WebDidDocumentResolver,
} from '@atcute/identity-resolver';

const handleResolver = new CompositeHandleResolver({
    strategy: 'race',
    methods: {
        http: new WellKnownHandleResolver({}),
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
