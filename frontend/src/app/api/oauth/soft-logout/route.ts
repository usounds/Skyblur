import { NextResponse } from "next/server";

import { OAUTH_DID_COOKIE } from "@/logic/oauth/cookies";

export async function POST() {
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
