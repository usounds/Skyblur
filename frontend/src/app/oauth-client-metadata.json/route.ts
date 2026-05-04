import { NextResponse } from "next/server";

import { getClientMetadata } from "@/logic/oauth/metadata";
import { getRequestOrigin } from "@/logic/oauth/origin";

export async function GET(request: Request) {
  return NextResponse.json(getClientMetadata(getRequestOrigin(request)), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
