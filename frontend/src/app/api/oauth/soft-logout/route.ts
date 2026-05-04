import { NextResponse } from "next/server";

import { OAUTH_DID_COOKIE } from "@/logic/oauth/cookies";
import { getCookieDomain, getRequestOrigin } from "@/logic/oauth/origin";

export async function POST(request: Request) {
  const origin = getRequestOrigin(request);
  const response = NextResponse.json({ success: true }, {
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set(OAUTH_DID_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 0,
    domain: getCookieDomain(request),
  });
  return response;
}
