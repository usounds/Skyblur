"use client"
//import { useAtpAgentStore } from "@/state/AtpAgent";
import { useXrpcAgentStore } from "@/state/XrpcAgent";
import { useLocaleStore } from "@/state/Locale";
import { getClientMetadata } from '@/types/ClientMetadataContext';
//import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { resolveFromIdentity } from '@atcute/oauth-browser-client';
import { createAuthorizationUrl } from '@atcute/oauth-browser-client';
import { Button } from 'reablocks';
import { useEffect, useState } from "react";
import LanguageSelect from "./LanguageSelect";
import { configureOAuth } from '@atcute/oauth-browser-client';

export const LoginForm: React.FC = ({
}) => {
  const [blueskyLoginMessage, setBlueskyLoginMessage] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [handle, setHandle] = useState("");
  const locale = useLocaleStore((state) => state.localeData);

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  const blueskyOAuthLogin = async (): Promise<void> => {
    setBlueskyLoginMessage("")
    setIsLoading(true)

    if (!handle) {
      setBlueskyLoginMessage(locale.Login_InputHandle)
      setIsLoading(false)
      return
    }

    if (!handle.includes('.')) {
      setBlueskyLoginMessage(locale.Login_NotDomain)
      setIsLoading(false)
      return
    }

    if (handle.startsWith('@')) {
      setBlueskyLoginMessage(locale.Login_WithAt)
      setIsLoading(false)
      return
    }

    let obj
    let pds
    let host

    try {
      setBlueskyLoginMessage(locale.Login_DidResolve)

      const serverMetadata = getClientMetadata();

      if(serverMetadata === undefined) {
        return
      }

      configureOAuth({
        metadata: {
          client_id: serverMetadata.client_id||'',
          redirect_uri: serverMetadata.redirect_uris[0]||'',
        },
      });

      const { identity, metadata } = await resolveFromIdentity(handle);

      let host

      if (identity.pds.host.endsWith('.bsky.network')) {
        host = 'bsky.social'
      } else {
        host = identity.pds.host

      }

      setBlueskyLoginMessage(locale.Login_Redirect.replace("{1}", host))
      window.localStorage.setItem('oauth.handle', handle)

      const authUrl = await createAuthorizationUrl({
        metadata: metadata,
        identity: identity,
        scope: 'atproto transition:generic',
      });

      // recommended to wait for the browser to persist local storage before proceeding
      await sleep(200);

      // redirect the user to sign in and authorize the app
      window.location.assign(authUrl);

      // if this is on an async function, ideally the function should never ever resolve.
      // the only way it should resolve at this point is if the user aborted the authorization
      // by returning back to this page (thanks to back-forward page caching)
      await new Promise((_resolve, reject) => {
        const listener = () => {
          reject(new Error(`user aborted the login request`));
        };

        window.addEventListener('pageshow', listener, { once: true });
      });
    } catch (e) {
      console.error(e)
      setBlueskyLoginMessage(locale.Login_InvalidHandle)
      setIsLoading(false)
      return

    }

    //      if (!obj.success) {
    //        setBlueskyLoginMessage(locale.Login_InvalidHandle)
    //        setIsLoading(false)
    //        return

    //      }
    //setBlueskyLoginMessage(locale.Login_PDSResolve)
    //pds = await fetchServiceEndpoint(obj.data.did) || ""

    //const match = pds.match(/https?:\/\/([^/]+)/);
    //if (!match) {
    //  throw new Error("Invalid URL");
    //}

    //host = match[1];

    // "bsky.network" を "bsky.social" に置き換え
    //if (host.endsWith("bsky.network")) {
    //  host = "bsky.social";
    //}


    setIsLoading(false)
  }

  useEffect(() => {
    setHandle(window.localStorage.getItem('oauth.handle') || '');
  }, [])

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

      <Button color="primary" size="large" className="text-white text-base font-normal w-full disabled:bg-blue-500" onClick={blueskyOAuthLogin} disabled={isLoading} >
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
      </Button>

      {(!isLoading && blueskyLoginMessage) &&

        <div className="mt-4 text-red-500">{blueskyLoginMessage}
        </div>
      }

      <div className="mt-2">
        <div className="text-gray-500 mb-1">Language</div>
        <LanguageSelect />
      </div>

    </div>
  );
};
