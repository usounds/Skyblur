import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getOAuthClient,
  getSafeTokenInfo,
  isDeletedSessionError,
  isUnsafeOAuthResourceError,
  restoreSession,
} from "@/logic/oauth/client";
import { OAUTH_DID_COOKIE, verifySignedDid } from "@/logic/oauth/cookies";
import { getRequestOrigin } from "@/logic/oauth/origin";

export async function GET(request: Request) {
  const rawDid = (await cookies()).get(OAUTH_DID_COOKIE)?.value;
  const did = verifySignedDid(rawDid ? decodeURIComponent(rawDid) : rawDid);

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
    return NextResponse.json({
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
