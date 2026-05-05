import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getOAuthClient } from "@/logic/oauth/client";
import { OAUTH_CALLBACK_COOKIE, OAUTH_DID_COOKIE, signDid } from "@/logic/oauth/cookies";
import { SESSION_TTL_SECONDS } from "@/logic/oauth/constants";
import { getRequestOrigin } from "@/logic/oauth/origin";

function clearOAuthCallbackCookie(response: NextResponse) {
  response.cookies.set(OAUTH_CALLBACK_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
}

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  const client = await getOAuthClient(origin);
  const url = new URL(request.url);
  const callbackCookie = (await cookies()).get(OAUTH_CALLBACK_COOKIE)?.value;
  const redirectTo = callbackCookie ? decodeURIComponent(callbackCookie) : `${origin}/`;

  try {
    const { session } = await client.callback(url.searchParams);
    const response = NextResponse.redirect(redirectTo);
    response.headers.set("Cache-Control", "no-store");

    response.cookies.set(OAUTH_DID_COOKIE, signDid(session.did), {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
    });
    clearOAuthCallbackCookie(response);
    return response;
  } catch (error: unknown) {
    const redirectUrl = new URL(redirectTo);
    const callbackError = url.searchParams.get("error");

    if (callbackError === "access_denied") {
      redirectUrl.searchParams.set("loginError", "rejected");
    } else {
      console.error("OAuth Callback Error:", error);
      redirectUrl.searchParams.set("loginError", "callback_failed");
    }

    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Cache-Control", "no-store");
    clearOAuthCallbackCookie(response);
    return response;
  }
}
