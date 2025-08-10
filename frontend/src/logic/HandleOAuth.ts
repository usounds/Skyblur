"use client"
import { fetchServiceEndpointWithCache } from "@/logic/HandleBluesky";
import { AppBskyActorDefs } from '@atcute/bluesky';
import { Client, simpleFetchHandler } from '@atcute/client';
import { ClientMetadata, OAuthUserAgent, configureOAuth, finalizeAuthorization, getSession } from '@atcute/oauth-browser-client';

export async function handleOAuth(
  getClientMetadata: () => ClientMetadata | null | undefined,
  setAgent: (agent: Client) => void,
  setUserProf: (profile: AppBskyActorDefs.ProfileViewDetailed | null) => void,
  setIsLoginProcess: (isLoginProcess: boolean) => void,
  setOauthUserAgent: (oauthUserAgent: OAuthUserAgent) => void,
  setDid: (did: string) => void,
  setBlueskyLoginMessage: (message: string) => void,
  setServiceUrl: (serviceUrl: string) => void,
): Promise<boolean> {
  const serverMetadata = getClientMetadata();
  if (!serverMetadata) return false

  const did = window.localStorage.getItem('oauth.did')

  configureOAuth({
    metadata: {
      client_id: serverMetadata.client_id || '',
      redirect_uri: serverMetadata.redirect_uris[0],
    },
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
      const session = await finalizeAuthorization(params);

      // now you can start making requests!
      const agent = new OAuthUserAgent(session);
      setOauthUserAgent(agent)
      const rpc = new Client({ handler: agent });
      setAgent(rpc)

      // ログイン時はKVキャッシュをクリアする
      const endPoint = await fetchServiceEndpointWithCache(agent.sub, true)
      setServiceUrl(endPoint || '')
      console.log(`${agent.sub} was successfully authenticated from ${endPoint}.`)
      const publicAgent = new Client({
        handler: simpleFetchHandler({
          service: 'https://public.api.bsky.app',
        }),
      })
      const userProfile = await publicAgent.get(`app.bsky.actor.getProfile`, {
        params: {
          actor: agent.sub,
        },
      })

      window.localStorage.setItem('oauth.did', agent.sub)

      if (!userProfile.ok) {
        setBlueskyLoginMessage("Negative Navigate")
        return false

      }

      setUserProf(userProfile.data)
      setIsLoginProcess(false)
      setDid(agent.sub)
      return true
    } catch (e) {
      console.error(e)
      setBlueskyLoginMessage("Negative Navigate")
      return false

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
      const publicAgent = new Client({
        handler: simpleFetchHandler({
          service: 'https://public.api.bsky.app',
        }),
      })
      const userProfile = await publicAgent.get(`app.bsky.actor.getProfile`, {
        params: {
          actor: agent.sub,
        },
      })
      if (!userProfile.ok) {
        setBlueskyLoginMessage("Negative Navigate")
        return false

      }

      setUserProf(userProfile.data)
      setIsLoginProcess(false)
      setDid(agent.sub)
      return true
    } catch (e) {
      console.log(`OAuth未認証です:${e}`)
      setIsLoginProcess(false)
      return false
    }
  }

  //それでもダメなら
  console.log(`OAuth未認証です`)
  setIsLoginProcess(false)
  return false


}