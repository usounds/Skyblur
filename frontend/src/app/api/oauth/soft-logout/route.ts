import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { revokeBrowserSession } from '@/logic/oauth/browser-session';
import { getOAuthClient, restoreSession } from '@/logic/oauth/client';
import { getRequestOrigin, isAllowedOrigin } from '@/logic/oauth/origin';

import { OAUTH_DID_COOKIE } from "@/logic/oauth/cookies";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { error: "Forbidden", message: "Cross-origin request forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  await revokeBrowserSession((await cookies()).get(OAUTH_DID_COOKIE)?.value, undefined,
    async (did) => restoreSession(await getOAuthClient(getRequestOrigin(request)), did));
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
