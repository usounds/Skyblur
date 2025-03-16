
import * as didJWT from 'did-jwt';
import { DIDDocument, DIDResolver, Resolver, ResolverRegistry } from 'did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { getResolver } from '../logic/DidPlcResolver';

const myResolver = getResolver()
const web = getWebResolver()
const resolver: ResolverRegistry = {
    'plc': myResolver.DidPlcResolver as unknown as DIDResolver,
    'web': web as unknown as DIDResolver,
}
export const resolverInstance = new Resolver(resolver)
export type Service = {
    id: string;
    type: string;
    serviceEndpoint: string | Record<string, any> | Array<Record<string, any>>;
}

export const verifyJWT = async (auth: string, audience:string) => {
    const authorization = auth.replace('Bearer ', '').trim()
    const decodedJWT = authorization.replace('Bearer ', '').trim()

    const result = await didJWT.verifyJWT(decodedJWT, {
        resolver: resolverInstance,
        audience: audience
    })

    return result

}
export const fetchDiDDocument = async (did: string) => {
    try {
        const didDocument = await resolverInstance.resolve(did)
        return didDocument
    } catch (error) {
        console.error('Error fetching service endpoint:', error);
    }

    
};

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