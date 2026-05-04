import { NextResponse } from "next/server";

import { resolveHandleAction } from "@/logic/HandleResolverAction";

export async function GET(request: Request) {
  const handle = new URL(request.url).searchParams.get("handle");
  if (!handle) {
    return NextResponse.json({ error: "Missing handle" }, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const result = await resolveHandleAction(handle);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json({ did: result.did }, {
    headers: { "Cache-Control": "no-store" },
  });
}
