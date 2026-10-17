import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getOAuthClient,
  getSafeTokenInfo,
  isDeletedSessionError,
  isUnsafeOAuthResourceError,
  restoreSession,
} from "@/logic/oauth/client";
import { OAUTH_DID_COOKIE } from "@/logic/oauth/cookies";
import { getBrowserSession } from '@/logic/oauth/browser-session';
import { getRequestOrigin } from "@/logic/oauth/origin";

export async function GET(request: Request) {
  const rawDid = (await cookies()).get(OAUTH_DID_COOKIE)?.value;
  const browser = await getBrowserSession(rawDid, async (did) => {
    return restoreSession(await getOAuthClient(getRequestOrigin(request)), did);
  }, true);
  const did = browser?.did;

  if (!did) {
    return NextResponse.json({ authenticated: false }, {
      headers: {
        "Cache-Control": "no-store",
        "Vary": "Cookie",
      },
    });
  }

  try {
    const oauth = await getOAuthClient(getRequestOrigin(request));
    const session = await restoreSession(oauth, did);
    const tokenInfo = await getSafeTokenInfo(session);
    const response = NextResponse.json({
      authenticated: true,
      did: session.did,
      pds: tokenInfo.aud,
      scope: tokenInfo.scope,
    }, {
      headers: {
        "Cache-Control": "no-store",
        "Vary": "Cookie",
      },
    });
    if (browser?.replacementCookie) {
      response.cookies.set(OAUTH_DID_COOKIE, browser.replacementCookie, {
        path: '/', httpOnly: true, secure: true, sameSite: 'lax',
        maxAge: Math.max(0, browser.expiresAt - Math.floor(Date.now() / 1000)),
      });
    }
    return response;
  } catch (error) {
    if (isDeletedSessionError(error) || isUnsafeOAuthResourceError(error)) {
      return NextResponse.json({ authenticated: false }, {
        headers: {
          "Cache-Control": "no-store",
          "Vary": "Cookie",
        },
      });
    }
    console.error("Session Restore Error:", error);
    return NextResponse.json({ authenticated: false }, {
      headers: {
        "Cache-Control": "no-store",
        "Vary": "Cookie",
      },
    });
  }
}
