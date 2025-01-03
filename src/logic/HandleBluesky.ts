
import { Action, State } from '@/state/Xrpc';
import { configureOAuth, getSession, OAuthUserAgent } from '@atcute/oauth-browser-client';
import { XRPC } from '@atcute/client';

export function isDidString(value: string): value is `did:${string}` {
    return value.startsWith('did:');
}

export const transformUrl = (inputUrl: string): string => {

    const parts = inputUrl.split('/');

    if (parts[3] === 'app.bsky.feed.post') {
        return `https://bsky.app/profile/${parts[2]}/post/${parts[4]}`;
    }

    if (parts[3] === 'uk.skyblur.post') {
        return `https://${window.location.hostname}/post/${parts[2]}/${parts[4]}`;
    }
    if (parts[3] === 'app.bsky.feed.generator') {
        return `https://bsky.app/profile/${parts[2]}/feed/${parts[4]}`;
    }

    return ''
};

export const fetchSession = async (
    loginXrpc:State['loginXrpc'],
    did:State['did'],
    setBlueskyLoginMessage:Action['setBlueskyLoginMessage'],
    setIsLoginProcess:Action['setIsLoginProcess'],
    setLoginXrpc:Action['setLoginXrpc'],
    setUserProf:Action['setUserProf'],
): Promise<State['loginXrpc']> => {
    console.log('fetchSession')
    if (!loginXrpc && did && isDidString(did)) {
        setBlueskyLoginMessage('');
        setIsLoginProcess(true);
        try {
            configureOAuth({
                metadata: {
                    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
                    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
                },
            });

            const session = await getSession(did, { allowStale: true });
            const agent = new OAuthUserAgent(session);
            const xrpc = new XRPC({ handler: agent });
            const ret = await xrpc.get("app.bsky.actor.getProfile", { params: { actor: agent.sub } });
            if (agent.session.token.expires_at && agent.session.token.expires_at > Date.now()) {
                if (ret.headers.status !== '401') {
                    setLoginXrpc(xrpc);
                    setUserProf(ret.data);
                    setIsLoginProcess(false);
                    return xrpc;
                }
            } else {
                setBlueskyLoginMessage('7日間経過したので、再ログインしてください');
                return undefined
            }
        } catch (error) {
            console.error('Failed to fetch session:', error);
            return undefined
        }
    }
    setIsLoginProcess(false);
    return undefined
};