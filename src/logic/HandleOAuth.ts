import { XRPC } from '@atcute/client';
import { OAuthUserAgent, finalizeAuthorization, getSession } from '@atcute/oauth-browser-client';
import { configureOAuth } from '@atcute/oauth-browser-client';
import { getClientMetadata } from '@/types/ClientMetadataContext';

export function isDidString(value: string): value is `did:${string}` {
    return value.startsWith('did:');
}

export async function handleAtCuteOauth(
    setUserProf: (profile: any) => void,
    setLoginXrpc: (loginXrpc: XRPC) => void,
    did: string,
    setBlueskyLoginMessage: (message: string) => void
): Promise<boolean> {


    const metadata = getClientMetadata();

    configureOAuth({
        metadata: {
            client_id: metadata?.client_id || '',
            redirect_uri: metadata?.redirect_uris[0] || '',
        },
    });

    let session

    try {

        const params = new URLSearchParams(location.hash.slice(1));
        console.log(params)
        if (params.size === 3) {
            console.log(`認証`)
            history.replaceState(null, '', location.pathname + location.search);
            session = await finalizeAuthorization(params);


        } else if (did && isDidString(did)) {
            console.log(`復元`)
            session = await getSession(did, { allowStale: true });

        } else {
            console.log(`OAuth未認証です`)
            return false

        }

        const agent = new OAuthUserAgent(session);

        if (agent) {
            const xrpc = new XRPC({ handler: agent });

            setLoginXrpc(xrpc)

            const ret = await xrpc.get("app.bsky.actor.getProfile", { params: { actor: agent.sub } })
            setUserProf(ret.data)

            return true
        }
    } catch (e) {
        console.error(`OAuth未認証です:${e}`)
        setBlueskyLoginMessage("Error:"+e)
        return false

    }

    console.error(`OAuth未認証です`)
    return false

}