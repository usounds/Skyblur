import { DIDDocument, DIDResolutionOptions, ParsedDID, Resolver, } from 'did-resolver';

export function getResolver() {
    async function resolve(
        did: string,
        parsed: ParsedDID,
        didResolver: Resolver,
        options: DIDResolutionOptions
    ): Promise<DIDDocument> {
        const encodedDid = encodeURIComponent(did);
        const didUrl = `https://plc.directory/${encodedDid}`;
        const response = await fetch(didUrl);
        const didDoc = await response.json() as DIDDocument
        return didDoc
    }

    return { DidPlcResolver: resolve }
}