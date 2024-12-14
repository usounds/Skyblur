"use client"
import { fetchServiceEndpoint } from "@/logic/HandleGetBlurRecord";
import { getClientMetadata } from '@/types/ClientMetadataContext';
import { AtpAgent } from '@atproto/api';
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { useState } from "react";

type LoginFormProps = {
  handle: string;
  setHandle: (value: string) => void;
  publicAgent: AtpAgent
  locale: any,
  browserClient?: BrowserOAuthClient | undefined
};

export const LoginForm: React.FC<LoginFormProps> = ({
  handle,
  setHandle,
  publicAgent,
  locale,
  browserClient
}) => {


  const [blueskyLoginMessage, setBlueskyLoginMessage] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const metadata = getClientMetadata();

  function generateRandomState(length: number = 32): string {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    // バイナリデータを Base64 にエンコードし、URL 安全な形式に変換
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-') // Base64 の + を - に置換
      .replace(/\//g, '_') // Base64 の / を _ に置換
      .replace(/=+$/, ''); // Base64 の末尾の = を削除
  }

  const blueskyOAuthLogin = async (): Promise<void> => {
    setBlueskyLoginMessage("")
    setIsLoading(true)

    if (!handle) {
      setBlueskyLoginMessage(locale.Login_InputHandle)
      setIsLoading(false)
      return
    }

    let obj
    let pds
    let host
    if (!handle.endsWith('bsky.social')) {
      try {
        setBlueskyLoginMessage(locale.Login_DidResolve)
        obj = await publicAgent.getProfile({ actor: handle })
      } catch (e) {
        setBlueskyLoginMessage(locale.Login_InvalidHandle)
        setIsLoading(false)
        return

      }

      if (!obj.success) {
        setBlueskyLoginMessage(locale.Login_InvalidHandle)
        setIsLoading(false)
        return

      }
      setBlueskyLoginMessage(locale.Login_PDSResolve)
      pds = await fetchServiceEndpoint(obj.data.did) || ""

      const match = pds.match(/https?:\/\/([^/]+)/);
      if (!match) {
        throw new Error("Invalid URL");
      }

      host = match[1];

      // "bsky.network" を "bsky.social" に置き換え
      if (host.endsWith("bsky.network")) {
        host = "bsky.social";
      }
    } else {
      pds = 'https://bsky.social/'
      host = "bsky.social";
    }

    browserClient = new BrowserOAuthClient({
      clientMetadata: metadata,
      handleResolver: pds || ''
    })

    //認証用ランダム値生成
    const state = generateRandomState()

    //ランダム値を保存
    window.localStorage.setItem('oauth.code_verifier', state)
    window.localStorage.setItem('oauth.pdsUrl', pds || '')
    window.localStorage.setItem('oauth.handle', handle)

    try {

      setBlueskyLoginMessage(locale.Login_Redirect.replace("{1}", host))
      await browserClient.signIn(handle, {
        state: state,
        prompt: 'consent', // Attempt to sign in without user interaction (SSO)
        ui_locales: 'ja-JP', // Only supported by some OAuth servers (requires OpenID Connect support + i18n support)
        signal: new AbortController().signal, // Optional, allows to cancel the sign in (and destroy the pending authorization, for better security)
      }
      )

    } catch (err) {
      console.log(err)
      setBlueskyLoginMessage(locale.Login_RedirectFailed + err)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
  }

  return (
    <div className="w-[350px]">
      <label htmlFor="handle" className="sr-only text-gray-500">
        Handle
      </label>
      <div className="text-gray-500">{locale.Login_Title}</div>
      <div className="flex items-center mt-2 mb-3">
        <p className="py-2.5 px-3 text-gray-500 bg-gray-200 border border-r-0 rounded-l-lg">
          @
        </p>
        <input
          id="handle"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          type="text"
          placeholder="alice.bsky.social"
          className="block w-full rounded-l-none rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-40"
        />
      </div>

      <button
        disabled={isLoading}
        onClick={blueskyOAuthLogin}
        className="rounded-lg w-full bg-blue-500 px-8 py-3 text-center text-sm text-white outline-none ring-blue-300 transition duration-100 hover:bg-blue-700 focus-visible:ring active:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-600 md:text-base flex items-center justify-center"
      >
        {isLoading ? <>
          <span className="animate-spin inline-block size-4 mr-2 border-[3px] border-current border-t-transparent text-gray-700 rounded-full" role="status" aria-label="loading">
            <span className="sr-only">Loading...</span>
          </span>
          {blueskyLoginMessage}</> :
          <>
            <svg
              className="h-5 w-5 mr-2"
              width="24"
              height="24"
              viewBox="0 0 1452 1452"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M725.669,684.169c85.954,-174.908 196.522,-329.297 331.704,-463.171c45.917,-43.253 98.131,-74.732 156.638,-94.443c80.779,-23.002 127.157,10.154 139.131,99.467c-2.122,144.025 -12.566,287.365 -31.327,430.015c-29.111,113.446 -96.987,180.762 -203.629,201.947c-36.024,5.837 -72.266,8.516 -108.726,8.038c49.745,11.389 95.815,32.154 138.21,62.292c77.217,64.765 90.425,142.799 39.62,234.097c-37.567,57.717 -83.945,104.938 -139.131,141.664c-82.806,48.116 -154.983,33.716 -216.529,-43.202c-28.935,-38.951 -52.278,-81.818 -70.026,-128.603c-12.177,-34.148 -24.156,-68.309 -35.935,-102.481c-11.779,34.172 -23.757,68.333 -35.934,102.481c-17.748,46.785 -41.091,89.652 -70.027,128.603c-61.545,76.918 -133.722,91.318 -216.529,43.202c-55.186,-36.726 -101.564,-83.947 -139.131,-141.664c-50.804,-91.298 -37.597,-169.332 39.62,-234.097c42.396,-30.138 88.466,-50.903 138.21,-62.292c-36.46,0.478 -72.702,-2.201 -108.725,-8.038c-106.643,-21.185 -174.519,-88.501 -203.629,-201.947c-18.762,-142.65 -29.205,-285.99 -31.328,-430.015c11.975,-89.313 58.352,-122.469 139.132,-99.467c58.507,19.711 110.72,51.19 156.637,94.443c135.183,133.874 245.751,288.263 331.704,463.171Z"
                fill="currentColor"
              />
            </svg>
            {locale.Login_Login}
          </>}
      </button>


      {(!isLoading && blueskyLoginMessage) &&

        <p>
          <a href={"https://bsky.app/profile/" + handle} target="_blank" className="mt-4">{blueskyLoginMessage}
            {locale.Login_TapToLinkProfile}
          </a>
        </p>
      }

    </div>
  );
};
