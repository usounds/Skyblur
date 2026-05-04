"use server";

import { isDid } from "@atcute/lexicons/syntax";
import type { Did } from "@atcute/lexicons";
import { headers } from "next/headers";

export type ResolveHandleResult =
  | { ok: true; did: Did }
  | { ok: false; error: string; status: number };

export async function resolveHandleAction(handle: string): Promise<ResolveHandleResult> {
  if (!/^[a-zA-Z0-9.-]+$/.test(handle) || !handle.includes(".")) {
    return { ok: false, error: "Invalid handle", status: 400 };
  }

  const headerList = await headers();
  const host = headerList.get("host") || "";
  const isLocalE2E =
    process.env.E2E_TEST === "true" ||
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:");

  if (isLocalE2E && handle === "test.bsky.social") {
    return { ok: true, did: "did:plc:mock" as Did };
  }

  try {
    const url = new URL("/.well-known/atproto-did", `https://${handle}`);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, error: "Domain is unreachable", status: 502 };
    }

    const did = (await response.text()).split("\n")[0]?.trim();
    if (did && isDid(did)) {
      return { ok: true, did: did as Did };
    }

    return { ok: false, error: "Invalid DID", status: 400 };
  } catch (error) {
    console.error("[resolveHandleAction] Failed to resolve handle %s:", handle, error);
    return { ok: false, error: "Failed to resolve handle", status: 500 };
  }
}
