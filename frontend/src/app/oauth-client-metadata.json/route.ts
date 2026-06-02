import { NextResponse } from "next/server";

import { resolveLocale } from "@/logic/locale";
import { getClientMetadata } from "@/logic/oauth/metadata";
import { getRequestOrigin } from "@/logic/oauth/origin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getCookieValue(cookieHeader: string | null, name: string) {
  return cookieHeader
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function GET(request: Request) {
  const locale = resolveLocale(
    getCookieValue(request.headers.get("cookie"), "lang"),
    request.headers.get("accept-language"),
  );

  return NextResponse.json(getClientMetadata(getRequestOrigin(request), locale), {
    headers: {
      "Cache-Control": "no-store",
      "Vary": "Cookie, Accept-Language",
    },
  });
}
