import { NextResponse } from "next/server";

import { getPublicJwks } from "@/logic/oauth/client";

export async function GET() {
  try {
    return NextResponse.json(getPublicJwks(), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("JWKS error:", error);
    return NextResponse.json({ error: "OAUTH_PRIVATE_KEY_JWK is not set" }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
