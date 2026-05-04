import { expect, test } from "@playwright/test";

async function responseText(res: { text: () => Promise<string> }) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function skipIfUnavailable(res: { status: () => number; text: () => Promise<string> }) {
  if (res.status() < 500) return;

  const body = await responseText(res);
  test.skip(
    body.includes("cloudflare") || body.includes("Bad gateway"),
    `E2E target is unavailable: HTTP ${res.status()}`,
  );
}

async function useEnglishLocale(context: {
  addCookies: (cookies: { name: string; value: string; url: string }[]) => Promise<void>;
}, baseURL: string | undefined) {
  await context.addCookies([
    {
      name: "lang",
      value: "en",
      url: baseURL || "http://localhost:4500",
    },
  ]);
}

test("OAuth metadata points to the Next.js API OAuth routes", async ({ request, baseURL }) => {
  const res = await request.get("/oauth-client-metadata.json");
  await skipIfUnavailable(res);
  expect(res.ok(), await responseText(res)).toBeTruthy();
  expect(res.headers()["cache-control"]).toContain("max-age=3600");

  const metadata = await res.json();
  expect(metadata.client_id).toBe(`${baseURL}/oauth-client-metadata.json`);
  expect(metadata.redirect_uris).toEqual([`${baseURL}/api/oauth/callback`]);
  expect(metadata.jwks_uri).toBe(`${baseURL}/api/oauth/jwks.json`);
  expect(metadata.grant_types).toEqual(["authorization_code", "refresh_token"]);
  expect(metadata.response_types).toEqual(["code"]);
  expect(metadata.scope).toContain("atproto");
  expect(metadata.scope).toContain("repo:app.bsky.feed.post?action=create&action=delete");
  expect(metadata.token_endpoint_auth_method).toBe("private_key_jwt");
  expect(metadata.dpop_bound_access_tokens).toBe(true);
});

test("OAuth session endpoint reports unauthenticated without a signed DID cookie", async ({
  request,
}) => {
  const res = await request.get("/api/oauth/session");
  await skipIfUnavailable(res);
  expect(res.ok(), await responseText(res)).toBeTruthy();

  expect(res.headers()["content-type"]).toMatch(/application\/json/);
  await expect(res.json()).resolves.toEqual({ authenticated: false });
});

test("OAuth soft logout succeeds and expires the DID cookie", async ({ request }) => {
  const res = await request.post("/api/oauth/soft-logout");
  await skipIfUnavailable(res);
  expect(res.ok(), await responseText(res)).toBeTruthy();

  await expect(res.json()).resolves.toEqual({ success: true });
  expect(res.headers()["set-cookie"]).toContain("oauth_did=");
  expect(res.headers()["set-cookie"]).toContain("Max-Age=0");
});

test("app.bsky XRPC requires local OAuth instead of leaking a Skyblur API scope error", async ({
  request,
}) => {
  const res = await request.get(
    "/xrpc/app.bsky.actor.getProfile?actor=did%3Aplc%3Argdcflm4ylsl6udghmtblydc",
  );
  await skipIfUnavailable(res);
  expect(res.status(), await responseText(res)).toBe(401);

  const body = await res.json();
  expect(body.error).toBe("Authentication required");
  expect(JSON.stringify(body)).not.toContain("did:web:dev.skyblur.uk%23skyblur_api");
});

test("XRPC POST requires local OAuth when the method is not public", async ({ request }) => {
  const res = await request.post("/xrpc/app.bsky.feed.post", {
    data: {
      repo: "did:plc:example",
      collection: "app.bsky.feed.post",
      record: { text: "hello" },
    },
  });
  await skipIfUnavailable(res);
  expect(res.status(), await responseText(res)).toBe(401);

  await expect(res.json()).resolves.toEqual({ error: "Authentication required" });
});

test("handle resolution can be reached through the Next.js server resolver", async ({ request }) => {
  const res = await request.get("/api/resolve-handle?handle=test.bsky.social");
  await skipIfUnavailable(res);
  expect(res.ok(), await responseText(res)).toBeTruthy();

  const body = await res.json();
  expect(body.did).toMatch(/^did:(plc|web):/);
});

test("handle resolution validates missing and malformed handles", async ({ request }) => {
  const missing = await request.get("/api/resolve-handle");
  await skipIfUnavailable(missing);
  expect(missing.status(), await responseText(missing)).toBe(400);
  await expect(missing.json()).resolves.toEqual({ error: "Missing handle" });

  const malformed = await request.get("/api/resolve-handle?handle=not_a_handle");
  await skipIfUnavailable(malformed);
  expect(malformed.status(), await responseText(malformed)).toBe(400);
  await expect(malformed.json()).resolves.toEqual({ error: "Invalid handle" });
});

test("/console shows the login form when there is no OAuth session", async ({
  page,
  context,
  baseURL,
}) => {
  await useEnglishLocale(context, baseURL);

  await page.goto("/console");

  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByRole("link", { name: "Skyblur" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Skyblur" })).toBeVisible();
  await expect(page.getByText("Login with atproto account")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Handle" })).toBeVisible();
  await expect(page.getByPlaceholder("alice.bsky.social")).toBeVisible();
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Create Account" })).toBeVisible();
});

test("/settings redirects unauthenticated visitors back home", async ({
  page,
  context,
  baseURL,
}) => {
  await useEnglishLocale(context, baseURL);

  await page.goto("/settings");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Skyblur" })).toBeVisible();
  await expect(page.getByText("Settings")).toHaveCount(0);
});
