import { UkSkyblurPreference } from '@/lexicon/UkSkyblur';
import { SKYBLUR_PREFERENCE_COLLECTION } from '@/types/types';
import { Client, simpleFetchHandler } from '@atcute/client';
import { ActorIdentifier } from '@atcute/lexicons/syntax';

export const transformUrl = (inputUrl: string): string => {

    const parts = inputUrl.split('/');

    if (parts[3] === 'app.bsky.feed.post') {
        return `https://bsky.app/profile/${parts[2]}/post/${parts[4]}`;
    }

    if (parts[3] === 'uk.skyblur.post') {
        const host = typeof window !== 'undefined' ? window.location.host : 'skyblur.uk';
        return `https://${host}/post/${parts[2]}/${parts[4]}`;
    }

    return ''
};

export const resolvePdsEndpoint = async (did: string): Promise<string | null> => {
    let didDoc: any = null;

    if (did.startsWith('did:plc:')) {
        const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`, {
            cache: 'no-store',
        });
        if (res.ok) didDoc = await res.json();
    } else if (did.startsWith('did:web:')) {
        const host = did.slice('did:web:'.length).replace(/:/g, '/');
        const res = await fetch(`https://${host}/.well-known/did.json`, {
            cache: 'no-store',
        });
        if (res.ok) didDoc = await res.json();
    }

    const service = didDoc?.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer');
    const endpoint = service?.serviceEndpoint;

    if (typeof endpoint === 'string') return endpoint;
    if (Array.isArray(endpoint) && typeof endpoint[0] === 'string') return endpoint[0];

    return null;
};

export const getPreference = async (did: string, serviceUrl?: string): Promise<UkSkyblurPreference.Record | null> => {
    const pdsUrl = serviceUrl || await resolvePdsEndpoint(did);
    if (!pdsUrl) return null;

    const agent = new Client({ handler: simpleFetchHandler({ service: pdsUrl }) });
    const preference = await agent.get('com.atproto.repo.getRecord', {
        params: {
            repo: did as ActorIdentifier,
            collection: SKYBLUR_PREFERENCE_COLLECTION,
            rkey: 'self',
        }
    });

    if (!preference.ok) return null

    const value = preference.data.value as unknown as UkSkyblurPreference.Record;
    console.log(value)
    return value
};
