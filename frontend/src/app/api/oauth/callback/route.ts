import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getOAuthClient, restoreSession } from "@/logic/oauth/client";
import { OAUTH_CALLBACK_COOKIE, OAUTH_DID_COOKIE } from "@/logic/oauth/cookies";
import { getBrowserSession, issueBrowserSession } from '@/logic/oauth/browser-session';
import { SESSION_TTL_SECONDS } from "@/logic/oauth/constants";
import { isInvalidGrantInvalidCodeError } from "@/logic/oauth/errors";
import { getRequestOrigin } from "@/logic/oauth/origin";

function isSafeRedirectUrl(url: string, origin: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(String(url).replace(/[\t\n\r]/g, ""), origin);
    return parsed.origin === origin && (parsed.protocol === "http:" || parsed.protocol === "https:");
  } catch {
    return false;
  }
}

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
  const cookieStore = await cookies();
  const callbackCookie = cookieStore.get(OAUTH_CALLBACK_COOKIE)?.value;
  const existingDid = (await getBrowserSession(cookieStore.get(OAUTH_DID_COOKIE)?.value,
    (did) => restoreSession(client, did)))?.did;
  const requestedRedirect = callbackCookie ? decodeURIComponent(callbackCookie) : null;
  const redirectTo =
    requestedRedirect && isSafeRedirectUrl(requestedRedirect, origin) ? requestedRedirect : `${origin}/console`;

  try {
    const { session } = await client.callback(url.searchParams);
    const response = NextResponse.redirect(redirectTo);
    response.headers.set("Cache-Control", "no-store");

    const sessionCookie = await issueBrowserSession(session.did, () => restoreSession(client, session.did));
    response.cookies.set(OAUTH_DID_COOKIE, sessionCookie, {
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
    } else if (existingDid && isInvalidGrantInvalidCodeError(error)) {
      console.warn("OAuth Callback reused or expired after an active session was established.");
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
