import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getOAuthClient, restoreSession, isDeletedSessionError, isUnsafeOAuthResourceError } from "@/logic/oauth/client";
import { OAUTH_DID_COOKIE } from "@/logic/oauth/cookies";
import { revokeBrowserSession } from '@/logic/oauth/browser-session';
import { getRequestOrigin } from "@/logic/oauth/origin";

export async function POST(request: Request) {
  const origin = getRequestOrigin(request);
  const rawDid = (await cookies()).get(OAUTH_DID_COOKIE)?.value;
  try {
    await revokeBrowserSession(rawDid, async (did) => {
      const oauth = await getOAuthClient(origin);
      await oauth.revoke(did as never);
    }, async (did) => restoreSession(await getOAuthClient(origin), did));
  } catch (error) {
    if (!isDeletedSessionError(error) && !isUnsafeOAuthResourceError(error)) {
      console.error("OAuth revoke error:", error);
      return NextResponse.json({ success: false, error: 'LogoutFailed' }, {
        status: 503, headers: { 'Cache-Control': 'no-store' },
      });
    }
  }

  const response = NextResponse.json({ success: true }, {
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set(OAUTH_DID_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return response;
}
