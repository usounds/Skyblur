
import { DIDResponse, Service } from '@/types/types';
import { Agent, AtpAgent } from '@atproto/api';
import { Preference, PREFERENCE_COLLECTION } from '@/types/types';

export const fetchServiceEndpoint = async (did: string) => {
    const encodedDid = encodeURIComponent(did); // URLエンコード
    const didUrl = `https://dev.uniresolver.io/1.0/identifiers/${encodedDid}`;

    try {
        const response = await fetch(didUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch DID document');
        }

        const data: DIDResponse = await response.json(); // レスポンスの全体を型定義
        const didDocument = data.didDocument; // didDocument部分を取り出す

        // didDocument.serviceが存在するかチェック
        const service = didDocument.service?.find((s: Service) => s.id === '#atproto_pds');

        if (service && service.serviceEndpoint) {
            console.log('Service Endpoint:', service.serviceEndpoint);
            return service.serviceEndpoint;
        } else {
            throw new Error('Service with id #atproto_pds not found or no service endpoint available');
        }
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
        return `https://${window.location.hostname}/post/${parts[2]}/${parts[4]}`;
    }

    return ''
};

export const getPreference = async (agent: Agent | AtpAgent, did: string): Promise<Preference> => {
    const preference = await agent.com.atproto.repo.getRecord({
        repo: did,
        collection: PREFERENCE_COLLECTION,
        rkey: 'self'
    });

    const value = preference.data.value as Preference;
    return value
};