import { UkSkyblurPreference } from '@/lexicon/UkSkyblur';
import { SKYBLUR_PREFERENCE_COLLECTION, DIDDocument,Service } from '@/types/types';
import { Client } from '@atcute/client';
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import { resolveFromIdentity } from '@atcute/oauth-browser-client';

export const fetchServiceEndpoint = async (did: string) => {
    try {

        const resolved = await resolveFromIdentity(did);

        return resolved.identity.pds.toString()

    } catch (error) {
        console.error('Error fetching service endpoint:', error);
    }
};

export const fetchServiceEndpointWithCache = async (did: string, forceRefresh: boolean) => {
    try {

        const host = new URL(origin).host;
        let apiHost = 'api.skyblur.uk'
        if (host?.endsWith('dev.skyblur.uk')) {
            apiHost = 'skyblurapi.usounds.work'
        }

        const ret = await fetch(`https://${apiHost}/xrpc/uk.skyblur.admin.getDidDocument?actor=${did}&forceRefresh=${forceRefresh}`)
        const didDoc = await ret.json() as DIDDocument;
        const endpoint =
            didDoc.service?.find((svc: Service) => svc.id === '#atproto_pds')
                ?.serviceEndpoint || '';

        return endpoint

    } catch (error) {
        console.error('Error fetching service endpoint:', error);
    }
};

export const transformUrl = (inputUrl: string): string => {

    const parts = inputUrl.split('/');

    if (parts[3] === 'app.bsky.feed.post') {
        return `https://bsky.app/profile/${parts[2]}/post/${parts[4]}`;
    }

    if (parts[3] === 'uk.skyblur.post') {
        return `https://skyblur.uk/post/${parts[2]}/${parts[4]}`;
    }

    return ''
};

export const getPreference = async (agent: Client, did: string): Promise<UkSkyblurPreference.Record | null> => {
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