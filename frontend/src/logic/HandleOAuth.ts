"use client"
import en from "@/locales/en";
import { fetchServiceEndpointWithCache } from "@/logic/HandleBluesky";
import { AppBskyActorDefs } from '@atcute/bluesky';
import { Client } from '@atcute/client';
import { ClientMetadata, OAuthUserAgent, configureOAuth, finalizeAuthorization, getSession } from '@atcute/oauth-browser-client';
import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  XrpcHandleResolver
} from '@atcute/identity-resolver';
import { defaultIdentityResolver } from '@atcute/oauth-browser-client';

export async function handleOAuth(
  getClientMetadata: () => ClientMetadata | null | undefined,
  setAgent: (agent: Client) => void,
  setUserProf: (profile: AppBskyActorDefs.ProfileViewDetailed | null) => void,
  setIsLoginProcess: (isLoginProcess: boolean) => void,
  setOauthUserAgent: (oauthUserAgent: OAuthUserAgent) => void,
  setDid: (did: string) => void,
  setServiceUrl: (serviceUrl: string) => void,
  locale: typeof en
): Promise<{ success: boolean; message: string }> {
  const serverMetadata = getClientMetadata();
  if (!serverMetadata) return { success: false, message: 'System Error : Cannot get serverMetadata' }

  const did = window.localStorage.getItem('oauth.did')

  configureOAuth({
    metadata: {
      client_id: serverMetadata.client_id || '',
      redirect_uri: serverMetadata.redirect_uris[0],
    },
    identityResolver: defaultIdentityResolver({
      handleResolver: new XrpcHandleResolver({ serviceUrl: 'https://public.api.bsky.app' }),

      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver(),
          web: new WebDidDocumentResolver(),
        },
      }),
    }),
  });

  const params = new URLSearchParams(location.hash.slice(1))

  //コールバック
  if (params.size === 3 || params.size === 4) {

    try {
      // this is optional, but after retrieving the parameters, we should ideally
      // scrub it from history to prevent this authorization state to be replayed,
      // just for good measure.
      history.replaceState(null, '', location.pathname + location.search);

      // you'd be given a session object that you can then pass to OAuthUserAgent!
      const result = await finalizeAuthorization(params);

      // now you can start making requests!
      const agent = new OAuthUserAgent(result.session);
      setOauthUserAgent(agent)
      const rpc = new Client({ handler: agent });
      setAgent(rpc)

      // ログイン時はKVキャッシュをクリアする
      const endPoint = await fetchServiceEndpointWithCache(agent.sub, true)
      setServiceUrl(endPoint || '')
      console.log(`${agent.sub} was successfully authenticated from ${endPoint}.`)

      const userProfile = await rpc.get(`app.bsky.actor.getProfile`, {
        params: {
          actor: agent.sub,
        },
      })
      if (!userProfile.ok) {
        return { success: false, message: 'System Error : Cannot get userProfile:' + agent.sub }

      }

      window.localStorage.setItem('oauth.did', agent.sub)
      window.localStorage.setItem('oauth.handle', userProfile.data.handle)

      setUserProf(userProfile.data)
      setIsLoginProcess(false)
      setDid(agent.sub)
      return { success: true, message: '' }
    } catch (e) {
      console.error(e)
      return { success: false, message: locale.Login_BackOperation }

    }
  }

  //失敗したらレストア
  if (did) {
    console.log(did)
    try {
      const session = await getSession(did as `did:${string}:${string}`, { allowStale: true });

      const agent = new OAuthUserAgent(session);
      setOauthUserAgent(agent)
      const rpc = new Client({ handler: agent });
      setAgent(rpc)
      //レストア時はKVキャッシュを更新しない
      const endPoint = await fetchServiceEndpointWithCache(agent.sub, false)
      setServiceUrl(endPoint || '')
      console.log(`${agent.sub} was restored (last active session) from ${endPoint}.`)
      const userProfile = await rpc.get(`app.bsky.actor.getProfile`, {
        params: {
          actor: agent.sub,
        },
      })
      if (!userProfile.ok) {

        return { success: false, message: 'System Error : Cannot get userProfile:' + agent.sub }

      }

      setUserProf(userProfile.data)
      setIsLoginProcess(false)
      setDid(agent.sub)
      return { success: true, message: '' }
    } catch (e) {
      console.log(`OAuth未認証です:${e}`)
      setIsLoginProcess(false)
      return { success: false, message: '' }
    }
  }

  //それでもダメなら
  console.log(`OAuth未認証です`)
  setIsLoginProcess(false)
  return { success: false, message: '' }


}