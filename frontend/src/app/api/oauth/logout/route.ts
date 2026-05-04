import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getOAuthClient, isDeletedSessionError } from "@/logic/oauth/client";
import { OAUTH_DID_COOKIE, verifySignedDid } from "@/logic/oauth/cookies";
import { getRequestOrigin } from "@/logic/oauth/origin";

export async function POST(request: Request) {
  const origin = getRequestOrigin(request);
  const rawDid = (await cookies()).get(OAUTH_DID_COOKIE)?.value;
  const did = verifySignedDid(rawDid ? decodeURIComponent(rawDid) : rawDid);

  if (did) {
    try {
      const oauth = await getOAuthClient(origin);
      await oauth.revoke(did as never);
    } catch (error) {
      if (!isDeletedSessionError(error)) console.error("OAuth revoke error:", error);
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
