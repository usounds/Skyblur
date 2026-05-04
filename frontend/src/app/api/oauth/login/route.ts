import { NextResponse } from "next/server";

import { getOAuthClient } from "@/logic/oauth/client";
import { OAUTH_CALLBACK_COOKIE } from "@/logic/oauth/cookies";
import { SESSION_TTL_SECONDS } from "@/logic/oauth/constants";
import { getCookieDomain, getRequestOrigin } from "@/logic/oauth/origin";

function sanitizeRedirect(value: string | null, request: Request, origin: string) {
  const allowedHost = new URL(origin).host;

  if (!value) return `${origin}/console`;

  try {
    const url = new URL(value, origin);
    url.searchParams.delete("loginError");

    if (url.host === allowedHost || /\.skyblur\.uk$/.test(url.host)) {
      return url.toString();
    }
  } catch {
    return `${origin}/console`;
  }

  return `${origin}/console`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const client = await getOAuthClient(origin);
  const handle = url.searchParams.get("handle");
  const redirectTo = sanitizeRedirect(url.searchParams.get("redirect_uri"), request, origin);

  try {
    const authorizeTarget = handle
      ? { type: "account" as const, identifier: handle as `${string}.${string}` }
      : { type: "pds" as const, serviceUrl: "https://bsky.social" };

    const result = await client.authorize({
      target: authorizeTarget,
      state: { timestamp: Date.now() },
      prompt: url.searchParams.get("prompt") || undefined,
    });

    const response = NextResponse.redirect(result.url);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(OAUTH_CALLBACK_COOKIE, redirectTo, {
      path: "/",
      httpOnly: true,
      secure: origin.startsWith("https"),
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      domain: getCookieDomain(request),
    });
    return response;
  } catch (error) {
    console.error("OAuth Login Error:", error);
    const redirectUrl = new URL(redirectTo);
    redirectUrl.searchParams.set("loginError", "invalid_handle");
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
