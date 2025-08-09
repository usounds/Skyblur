
import { getResolver } from "@/logic/DidPlcResolver";
import { DIDDocument, Service, SKYBLUR_PREFERENCE_COLLECTION } from '@/types/types';
import { Client, simpleFetchHandler } from '@atcute/client';
import { DIDResolver, Resolver, ResolverRegistry } from 'did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { UkSkyblurPreference } from '@/lexicon/UkSkyblur';
import { isHandle, isDid, ActorIdentifier, ResourceUri } from '@atcute/lexicons/syntax';

const myResolver = getResolver()
const web = getWebResolver()
const resolver: ResolverRegistry = {
    'plc': myResolver.DidPlcResolver as unknown as DIDResolver,
    'web': web as unknown as DIDResolver,
}
const resolverInstance = new Resolver(resolver)

export const fetchServiceEndpoint = async (did: string) => {
    try {
        const response = await fetchDiDDocument(did);
        if (!response) {
            throw new Error('Invalid DID document response');
        }

        const didDocument = response as unknown as DIDDocument;

        // didDocument.serviceが存在するかチェック
        const service = didDocument.service?.find((s: Service) => s.id === '#atproto_pds');

        if (service && service.serviceEndpoint) {
            return service.serviceEndpoint;
        } else {
            throw new Error('Service with id #atproto_pds not found or no service endpoint available');
        }
    } catch (error) {
        console.error('Error fetching service endpoint:', error);
    }
};

export const fetchDiDDocument = async (did: string) => {
    try {
        const didDocument = await resolverInstance.resolve(did)
        return didDocument
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

export const getPreference = async (agent: Client, did: string): Promise<UkSkyblurPreference.Record|null> => {
    const preference = await agent.get('com.atproto.repo.getRecord', {
        params: {
            repo: did as ActorIdentifier,
            collection: SKYBLUR_PREFERENCE_COLLECTION,
            rkey: 'self',
        }
    });

    if(!preference.ok) return null

    const value = preference.data.value as unknown as UkSkyblurPreference.Record;
    console.log(value)
    return value
};