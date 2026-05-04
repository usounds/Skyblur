import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getOAuthClient } from "@/logic/oauth/client";
import { OAUTH_CALLBACK_COOKIE, OAUTH_DID_COOKIE, signDid } from "@/logic/oauth/cookies";
import { SESSION_TTL_SECONDS } from "@/logic/oauth/constants";
import { getCookieDomain, getRequestOrigin } from "@/logic/oauth/origin";

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  const client = await getOAuthClient(origin);
  const url = new URL(request.url);
  const callbackCookie = (await cookies()).get(OAUTH_CALLBACK_COOKIE)?.value;
  const redirectTo = callbackCookie ? decodeURIComponent(callbackCookie) : `${origin}/`;
  const domain = getCookieDomain(request);

  try {
    const { session } = await client.callback(url.searchParams);
    const response = NextResponse.redirect(redirectTo);
    response.headers.set("Cache-Control", "no-store");

    response.cookies.set(OAUTH_DID_COOKIE, signDid(session.did), {
      path: "/",
      httpOnly: true,
      secure: origin.startsWith("https"),
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      domain,
    });
    response.cookies.delete({ name: OAUTH_CALLBACK_COOKIE, path: "/", domain });
    return response;
  } catch (error: unknown) {
    console.error("OAuth Callback Error:", error);
    const redirectUrl = new URL(redirectTo);
    redirectUrl.searchParams.set("loginError", "callback_failed");

    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.delete({ name: OAUTH_CALLBACK_COOKIE, path: "/", domain });
    return response;
  }
}
