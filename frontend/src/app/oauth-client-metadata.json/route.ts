import { NextResponse } from "next/server";

import { getClientMetadata } from "@/logic/oauth/metadata";
import { getRequestOrigin } from "@/logic/oauth/origin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  return NextResponse.json(getClientMetadata(getRequestOrigin(request)), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
