
import { DIDResponse, Service } from '@/types/types';
 
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