"use client"
import { BrowserOAuthClient, OAuthSession } from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';
import { fetchServiceEndpoint } from "@/logic/HandleBluesky";

export async function handleOAuth(
    getClientMetadata: () => any,
    setAgent: (agent: Agent) => void,
    setUserProf: (profile: any) => void,
    setIsLoginProcess: (isLoginProcess: boolean) => void,
    setDid: (did: string) => void,
    setBlueskyLoginMessage: (message: string) => void,
    setServiceUrl: (serviceUrl: string) => void,
    
): Promise<boolean> {
    let result;

    const localState = window.localStorage.getItem('oauth.code_verifier');
    const localPdsUrl = window.localStorage.getItem('oauth.pdsUrl');

    try {
        if (localState && localPdsUrl) {
            const browserClient = new BrowserOAuthClient({
                clientMetadata: getClientMetadata(),
                handleResolver: localPdsUrl,
            });

            result = await browserClient.init() as undefined | { session: OAuthSession; state?: string | undefined };
        }
    } catch (e) {
        console.error(e);

        // エラーメッセージ取得の処理
        let errorMessage = "Unexpected Error";
        if (typeof e === 'string') {
            errorMessage = e;
        } else if (e instanceof Error) {
            errorMessage = e.message;
        }

        setBlueskyLoginMessage(errorMessage);
        return false
    }

    if (result) {
        const { session, state } = result
        //OAuth認証から戻ってきた場合
        if (state != null) {
          //stateがズレている場合はエラー
          if (state !== localState) {
            setBlueskyLoginMessage("stateが一致しません")
            return false

          }
          const agent = new Agent(session)
          setAgent(agent)

          const endPoint = await fetchServiceEndpoint(session.sub)
          console.log(endPoint)
          setServiceUrl(endPoint||'')
          console.log(`${agent.assertDid} was successfully authenticated (state: ${state})`)
          const userProfile = await agent.getProfile({ actor: agent.assertDid })
          setUserProf(userProfile.data)
          setIsLoginProcess(false)
          setDid(agent.assertDid)
          return true

          //セッションのレストア
        } else {
          const endPoint = await fetchServiceEndpoint(session.sub)
          console.log(endPoint)
          setServiceUrl(endPoint||'')
          console.log(`${session.sub} was restored (last active session)`)
          const agent = new Agent(session)
          setAgent(agent)
          const userProfile = await agent.getProfile({ actor: agent.assertDid })
          setUserProf(userProfile.data)
          setIsLoginProcess(false)
          setDid(agent.assertDid)
          return true

        }

      } else {
        console.log(`OAuth未認証です`)
        setIsLoginProcess(false)
        return false
      }

}