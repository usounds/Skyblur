
import { DIDResponse, Service, VerificationMethod } from '@/types/types';
import { Agent, AtpAgent } from '@atproto/api';
import { Preference, SKYBLUR_PREFERENCE_COLLECTION, DIDDocument } from '@/types/types';
import { getResolver } from "@/logic/DidPlcResolver"
import { Resolver, ResolverRegistry, DIDResolver } from 'did-resolver'
import { getResolver as getWebResolver } from 'web-did-resolver'

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

export const getPreference = async (agent: Agent | AtpAgent, did: string): Promise<Preference> => {
    const preference = await agent.com.atproto.repo.getRecord({
        repo: did,
        collection: SKYBLUR_PREFERENCE_COLLECTION,
        rkey: 'self'
    });

    const value = preference.data.value as Preference;
    return value
};