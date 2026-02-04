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

export const getPreference = async (did: string): Promise<UkSkyblurPreference.Record | null> => {
    const agent = new Client({ handler: simpleFetchHandler({ service: 'https://slingshot.microcosm.blue' }) });
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