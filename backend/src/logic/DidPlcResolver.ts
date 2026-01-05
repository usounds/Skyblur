import type {
  DIDDocument,
  DIDResolutionOptions,
  ParsedDID,
  DIDResolver,
  Resolvable,
  DIDResolutionResult,
} from 'did-resolver';

export function getResolver() {
  const plcResolver: DIDResolver = async (
    did: string,
    parsed: ParsedDID,
    resolver: Resolvable,
    options: DIDResolutionOptions
  ): Promise<DIDResolutionResult> => {
    const encodedDid = encodeURIComponent(did);
    const didUrl = `https://plc.directory/${encodedDid}`;

    const response = await fetch(didUrl);

    if (!response.ok) {
      return {
        didResolutionMetadata: {
          error: 'notFound',
          status: response.status,
        },
        didDocument: null,
        didDocumentMetadata: {},
      };
    }

    const didDocument = (await response.json()) as DIDDocument;

    return {
      didResolutionMetadata: {},
      didDocument,
      didDocumentMetadata: {},
    };
  };

  return {
    plc: plcResolver,
  };
}
