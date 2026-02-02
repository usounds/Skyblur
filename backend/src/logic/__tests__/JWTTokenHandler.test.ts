import { describe, it, expect, vi } from 'vitest';
import { verifyJWT, fetchDidDocument, fetchServiceEndpoint, resolverInstance } from '../JWTTokenHandler';
import * as didJWT from 'did-jwt';

// Mock dependecies
vi.mock('did-jwt');

describe('JWTTokenHandler', () => {
    describe('verifyJWT', () => {
        it('should verify a valid JWT', async () => {
            const mockVerify = vi.spyOn(didJWT, 'verifyJWT').mockResolvedValue({
                payload: { iss: 'did:example:123', aud: 'did:web:api' },
                didResolutionResult: {},
                issuer: 'did:example:123',
                signer: {},
                jwt: 'valid.token.here'
            } as any);

            const authHeader = 'Bearer valid.token.here';
            const audience = 'did:web:api';

            const result = await verifyJWT(authHeader, audience);

            expect(mockVerify).toHaveBeenCalledWith('valid.token.here', expect.objectContaining({
                audience: 'did:web:api'
            }));
            expect(result.payload.iss).toBe('did:example:123');
        });
    });

    describe('DID Resolution (Mocked)', () => {
        const mockDid = 'did:example:123';
        const mockDoc = { id: mockDid, service: [] };

        it('should resolve local test DID correctly using real resolver logic', async () => {
            // Do NOT mock resolverInstance.resolve here to test the specific local resolver function logic
            // We can't really "unspy" easily if we set spy on prototype or instance in other tests
            // but here we are spying on the instance method.
            // If other tests used spyOn(resolverInstance, 'resolve'), we need to ensure they restore it.

            // The local resolver is part of the Resolver constructor config. 
            // We can call `resolverInstance.resolve('did:local:test')` directly.

            // To be safe, ensure no active spy
            vi.restoreAllMocks();

            const result = await resolverInstance.resolve('did:local:test');
            expect(result.didDocument?.id).toBe('did:local:test');
            expect(result.didDocument?.verificationMethod?.[0].id).toBe('did:local:test#key-1');
        });

        it('should return notFound for other local DIDs', async () => {
            vi.restoreAllMocks();
            const result = await resolverInstance.resolve('did:local:other');
            expect(result.didResolutionMetadata.error).toBe('notFound');
        });

        it('fetchDidDocument should return document if resolved', async () => {
            // Mock resolverInstance.resolve
            const spy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: mockDoc,
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const doc = await fetchDidDocument(mockDid);
            expect(doc).toEqual(mockDoc);
            spy.mockRestore();
        });

        it('fetchDidDocument should throw if resolution fails', async () => {
            const spy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: null,
                didDocumentMetadata: {},
                didResolutionMetadata: { error: 'notFound' }
            });

            await expect(fetchDidDocument('did:fail')).rejects.toThrow('Failed to resolve DID');
            spy.mockRestore();
        });
    });

    describe('fetchServiceEndpoint', () => {
        const mockDid = 'did:example:123';

        it('should return service endpoint strings', async () => {
            const spy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: {
                    id: mockDid,
                    service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds' }]
                },
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            const endpoint = await fetchServiceEndpoint(mockDid);
            expect(endpoint).toBe('https://pds');
            spy.mockRestore();
        });

        it('should throw if #atproto_pds service not found', async () => {
            const spy = vi.spyOn(resolverInstance, 'resolve').mockResolvedValue({
                didDocument: {
                    id: mockDid,
                    service: [{ id: '#other', type: 'Other', serviceEndpoint: 'https://other' }]
                },
                didDocumentMetadata: {},
                didResolutionMetadata: {}
            });

            await expect(fetchServiceEndpoint(mockDid)).rejects.toThrow('Service #atproto_pds not found');
            spy.mockRestore();
        });
    });
});
