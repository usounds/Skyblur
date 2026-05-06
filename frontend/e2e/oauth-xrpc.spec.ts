import { expect, test } from "./fixtures";

import { mockCurrentSessionScope, mockDid, mockHandle, mockOlderSessionScope, useLoggedInOAuthMock } from "./oauth-mock";

test.describe.configure({ mode: "parallel" });

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

async function gotoAndSkipIfUnavailable(
  page: import("@playwright/test").Page,
  url: string,
) {
  const res = await page.goto(url);
  if (res) await skipIfUnavailable(res);
  await disableNotificationPointerEvents(page);
  return res;
}

function expectedOAuthOrigin(baseURL: string | undefined) {
  return (process.env.NEXT_PUBLIC_BASE_URL || baseURL || "http://localhost:4500").replace(/\/+$/, "");
}

async function disableNotificationPointerEvents(page: import("@playwright/test").Page) {
  await page.addStyleTag({
    content: `
      [data-mantine-shared-portal-node] [role="alert"],
      [data-mantine-shared-portal-node] [role="alert"] *,
      .mantine-Notifications-root,
      .mantine-Notifications-root * {
        pointer-events: none !important;
      }
    `,
  }).catch(() => {});
}

async function useEnglishLocale(context: {
  clearCookies: () => Promise<void>;
  addCookies: (cookies: { name: string; value: string; url: string }[]) => Promise<void>;
}, baseURL: string | undefined) {
  await context.clearCookies();
  await context.addCookies([
    {
      name: "lang",
      value: "en",
      url: baseURL || "http://localhost:4500",
    },
  ]);
}

async function openConsoleLoginForm(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  baseURL: string | undefined,
) {
  await useEnglishLocale(context, baseURL);
  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByRole("heading", { name: "Skyblur" })).toBeVisible();
}

async function openConsoleWithClock(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  baseURL: string | undefined,
  iso: string,
) {
  await page.addInitScript((fixedIso) => {
    const fixedTime = new Date(fixedIso).valueOf();
    const RealDate = Date;
    class MockDate extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(fixedTime);
        } else if (args.length === 1) {
          super(args[0]);
        } else {
          super(args[0], args[1], args[2] ?? 1, args[3] ?? 0, args[4] ?? 0, args[5] ?? 0, args[6] ?? 0);
        }
      }

      static now() {
        return fixedTime;
      }
    }
    window.Date = MockDate as DateConstructor;
  }, iso);
  await useLoggedInOAuthMock(page, context, baseURL);
  await gotoAndSkipIfUnavailable(page, "/console");
}

async function openCreateComposer(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    window.localStorage.removeItem("zustand.temptext");
    window.localStorage.removeItem("zustand.sensitive-post-draft");
    window.sessionStorage.removeItem("skyblur.post-composer.active-create-session");
  });
  await page.getByRole("button", { name: "Create a post" }).click({ force: true });
  await expect(page).toHaveURL(/\/console\/posts\/new$/);
  await expect(page.getByText("Write", { exact: true })).toBeVisible();
}

async function clickCreateComposer(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Create a post" }).click({ force: true });
  await expect(page).toHaveURL(/\/console\/posts\/new$/);
}

async function readComposerDraftStorage(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const readState = (key: string) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return {};
      try {
        return JSON.parse(raw).state ?? {};
      } catch {
        return {};
      }
    };

    return {
      temp: readState("zustand.temptext"),
      sensitive: readState("zustand.sensitive-post-draft"),
    };
  });
}

async function goToAudienceStep(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  if (await restoreUnexpectedCreateDraft(page)) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(page.getByText("What this setting does")).toBeVisible();
}

async function openComposerDetails(page: import("@playwright/test").Page) {
  await page.getByText("Bluesky details").click();
  await expect(page.getByText("Reply Control", { exact: true })).toBeVisible();
}

async function confirmComposerBack(page: import("@playwright/test").Page) {
  const confirmMessage = page.getByText("Your changes will not be saved. Are you sure you want to go back?");
  if (!await confirmMessage.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await page.getByRole("button", { name: "Back" }).first().click({ force: true });
  }
  await expect(confirmMessage).toBeVisible();
  const dialog = page.locator('[role="dialog"]').filter({ hasText: "Your changes will not be saved. Are you sure you want to go back?" });
  await dialog.getByRole("button", { name: "Back" }).click({ force: true });
  await expect(dialog).toBeHidden();
}

async function restoreUnexpectedCreateDraft(page: import("@playwright/test").Page) {
  const restoreDialog = page.getByRole("dialog", { name: "Would you like to restore the content you entered halfway?" });
  if (!await restoreDialog.isVisible({ timeout: 500 }).catch(() => false)) return false;

  await restoreDialog.getByRole("button", { name: "Restore" }).click();
  await expect(restoreDialog).toBeHidden();
  await expect(page.getByText("Write", { exact: true })).toBeVisible();
  return true;
}

async function selectListVisibility(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "List only" }).click();
  if (await restoreUnexpectedCreateDraft(page)) {
    await goToAudienceStep(page);
    await page.getByRole("button", { name: "List only" }).click();
  }
}

async function expectListVisibilityMessage(page: import("@playwright/test").Page, message: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await expect(page.getByText(message)).toBeVisible({ timeout: 5_000 });
      return;
    } catch (error) {
      lastError = error;
      if (!await page.getByText("Write", { exact: true }).isVisible().catch(() => false)) break;
      await goToAudienceStep(page);
      await selectListVisibility(page);
    }
  }

  throw lastError;
}

async function goToCheckStep(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("What appears on Skyblur")).toBeVisible({ timeout: 20_000 });
}

async function selectReplyTarget(page: import("@playwright/test").Page) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.getByRole("button", { name: "Reply to this post" }).click({ timeout: 5_000 });
      return;
    } catch (error) {
      lastError = error;
      if (!await page.getByText("Write", { exact: true }).isVisible().catch(() => false)) break;
      await goToAudienceStep(page);
      await openComposerDetails(page);
      if (!await page.getByRole("button", { name: "Reply to this post" }).isVisible().catch(() => false)) {
        await page.getByLabel("Set a reply target").click();
      }
      await expect(page.getByText("E2E reply target post")).toBeVisible();
    }
  }

  throw lastError;
}

async function clickOpenPostMenuEdit(page: import("@playwright/test").Page) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (!await page.getByRole("menuitem", { name: "Edit" }).isVisible().catch(() => false)) {
        await page.getByTestId("post-menu").last().click();
      }
      await page.getByRole("menuitem", { name: "Edit" }).click({ timeout: 5_000 });
      await page.waitForURL(/\/console\/posts\/.+\/edit$/, { timeout: 5_000 });
      return;
    } catch (error) {
      lastError = error;
      if (/\/console\/posts\/.+\/edit$/.test(page.url())) return;
      await expect(page.getByText("Post List")).toBeVisible();
    }
  }

  throw lastError;
}

async function submitComposer(page: import("@playwright/test").Page, name = "Post") {
  await page.getByRole("button", { name }).click({ force: true });
  await expect(page).toHaveURL(/\/console$/);
}

async function submitCreateComposer(page: import("@playwright/test").Page) {
  await goToAudienceStep(page);
  await goToCheckStep(page);
  await submitComposer(page);
}

async function openLastPostEdit(page: import("@playwright/test").Page) {
  await page.getByTestId("post-menu").last().click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/console\/posts\/.+\/edit$/),
    page.getByRole("menuitem", { name: "Edit" }).click({ force: true }),
  ]);
}

async function expectLoginValidationMessage(
  page: import("@playwright/test").Page,
  handle: string,
  message: string,
) {
  const handleInput = page.getByRole("combobox", { name: "Handle" });
  await handleInput.click();
  await handleInput.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await handleInput.press("Backspace");
  await handleInput.pressSequentially(handle);
  await expect(handleInput).toHaveValue(handle);
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByText(message).first()).toBeVisible();
  await expect(page).toHaveURL(/\/console$/);
}

test("OAuth metadata points to the Next.js API OAuth routes", async ({ request, baseURL }) => {
  const res = await request.get("/oauth-client-metadata.json");
  await skipIfUnavailable(res);
  expect(res.ok(), await responseText(res)).toBe(true);
  expect(res.headers()["cache-control"]).toContain("no-store");

  const metadata = await res.json();
  const oauthOrigin = expectedOAuthOrigin(baseURL);
  expect(metadata.client_id).toBe(`${oauthOrigin}/oauth-client-metadata.json`);
  expect(metadata.redirect_uris).toEqual([`${oauthOrigin}/api/oauth/callback`]);
  expect(metadata.jwks_uri).toBe(`${oauthOrigin}/api/oauth/jwks.json`);
  expect(metadata.grant_types).toEqual(["authorization_code", "refresh_token"]);
  expect(metadata.response_types).toEqual(["code"]);
  expect(metadata.scope).toContain("atproto");
  expect(metadata.scope).toContain("repo:app.bsky.feed.post?action=create&action=delete");
  expect(metadata.scope).toContain("rpc:app.bsky.graph.getLists?aud=*");
  expect(metadata.scope).toContain("rpc:app.bsky.graph.getList?aud=*");
  expect(metadata.token_endpoint_auth_method).toBe("private_key_jwt");
  expect(metadata.dpop_bound_access_tokens).toBe(true);
});

test.describe("home start session flows", () => {
  test.describe.configure({ mode: "serial" });

  test("public app pages render core unauthenticated content", async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, { authenticated: false });

    await gotoAndSkipIfUnavailable(page, "/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Skyblur" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Term of Use" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome to Skyblur" })).toBeVisible();
    await expect(page.getByText("Skyblur is a content warning and spoilers protection tool")).toBeVisible();
    await expect(page.getByText("Post contents from Skyblur")).toBeVisible();
    await expect(page.getByText("Bluesky shows the blurred text")).toBeVisible();
    await expect(page.getByText("Skyblur shows the unblurred text")).toBeVisible();
    await expect(page.getByText("These recommended clients offer a seamless viewing experience")).toBeVisible();

    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("dialog", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Handle" })).toBeVisible();
    await expect(page.getByText("Agree to the contents")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeDisabled();
  });

  test("term of use page renders public content", async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, { authenticated: false });

    await gotoAndSkipIfUnavailable(page, "/termofuse");
    await expect(page).toHaveURL(/\/termofuse$/);
    await expect(page.getByRole("heading", { name: "Privacy Policy & Terms of Service" })).toBeVisible();
    await expect(page.getByText("Collection and Use of Personal Information")).toBeVisible();
    await expect(page.getByText("Provision of Data to Third Parties")).toBeVisible();
    await expect(page.getByText("Prohibited Actions")).toBeVisible();
    await expect(page.getByText("Operator Information")).toBeVisible();
  });

  test("home start button opens the console for logged-in users", async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL);

    await gotoAndSkipIfUnavailable(page, "/");
    await page.getByRole("button", { name: "Start" }).click();

    await expect(page).toHaveURL(/\/console$/);
    await expect(page.getByText(/E2E Tester/)).toBeVisible();
  });

  test("home start session check shows a timed retry button after timeout", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    testInfo.annotations.push({ type: "session-request-budget", description: "2" });
    await useEnglishLocale(context, baseURL);

    let sessionRequests = 0;
    let retrySessionRequestNumber = 0;
    await page.route("**/api/oauth/session", async (route) => {
      sessionRequests += 1;

      if (sessionRequests === 1) {
        await new Promise(() => {});
        return;
      }

      if (retrySessionRequestNumber === 0) {
        retrySessionRequestNumber = sessionRequests;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Cache-Control": "no-store",
          Vary: "Cookie",
        },
        body: JSON.stringify({
          authenticated: false,
        }),
      });
    });
    await page.clock.install({ time: new Date("2026-01-01T00:00:00.000Z") });
    await gotoAndSkipIfUnavailable(page, "/");

    await expect(page.getByText("Checking session... retry available in 30s")).toBeVisible();
    await page.clock.runFor(10_000);
    await expect(page.getByText("Checking session... retry available in 20s")).toBeVisible();
    await page.clock.runFor(20_000);

    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await page.getByRole("button", { name: "Retry" }).click();

    await expect(page.getByRole("dialog", { name: "Login" })).toBeVisible();
    expect(retrySessionRequestNumber).toBe(2);
  });

  test("home start session retry opens the console when the session recovers", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    testInfo.annotations.push({ type: "session-request-budget", description: "2" });
    await useEnglishLocale(context, baseURL);

    let sessionRequests = 0;
    let recoveredSessionRequestNumber = 0;
    await page.route("**/api/oauth/session", async (route) => {
      sessionRequests += 1;

      if (sessionRequests === 1) {
        await new Promise(() => {});
        return;
      }

      if (recoveredSessionRequestNumber === 0) {
        recoveredSessionRequestNumber = sessionRequests;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Cache-Control": "no-store",
          Vary: "Cookie",
        },
        body: JSON.stringify({
          authenticated: true,
          did: mockDid,
          pds: "https://e2e-pds.skyblur.test",
          scope: "atproto repo:app.bsky.feed.post?action=create&action=delete",
        }),
      });
    });
    await page.route("https://public.api.bsky.app/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          did: mockDid,
          handle: mockHandle,
          displayName: "E2E Tester",
          description: "Recovered session user",
          avatar: "",
        }),
      });
    });

    await page.clock.install({ time: new Date("2026-01-01T00:00:00.000Z") });
    await gotoAndSkipIfUnavailable(page, "/");

    await expect(page.getByText("Checking session... retry available in 30s")).toBeVisible();
    await page.clock.runFor(30_000);
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await page.getByRole("button", { name: "Retry" }).click();

    await expect(page).toHaveURL(/\/console$/);
    await expect(page.getByText(/E2E Tester/)).toBeVisible();
    expect(recoveredSessionRequestNumber).toBe(2);
  });
});

test("header controls toggle theme and language from the rendered UI", async ({
  page,
  context,
  baseURL,
}) => {
  await useEnglishLocale(context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/");
  await expect(page.getByRole("heading", { name: "Welcome to Skyblur" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();

  const headerButtons = page.getByRole("button", { name: "Toggle color scheme" });
  await expect(headerButtons).toHaveCount(2);

  await headerButtons.first().click();
  await expect(page.getByRole("heading", { name: "Skyblurへようこそ" })).toBeVisible();
  await headerButtons.first().click();
  await expect(page.getByRole("heading", { name: "Welcome to Skyblur" })).toBeVisible();

  await headerButtons.nth(1).click();
  await expect(page.locator("html")).toHaveAttribute("data-mantine-color-scheme", "dark");
  await headerButtons.nth(1).click();
  await expect(page.locator("html")).toHaveAttribute("data-mantine-color-scheme", "light");
});

test("not found screen renders a clear 404 message", async ({ page }) => {
  await gotoAndSkipIfUnavailable(page, "/not-a-real-screen");

  await expect(page.getByRole("heading", { name: "404 - Page Not Found" })).toBeVisible();
  await expect(page.getByText("The page you are looking for doesn't exist.")).toBeVisible();
});

test("public metadata endpoints expose app identity documents", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  await skipIfUnavailable(manifest);
  expect(manifest.ok(), await responseText(manifest)).toBe(true);
  await expect(manifest.json()).resolves.toMatchObject({
    name: "Skyblur",
    short_name: "Skyblur",
    start_url: "/",
    display: "standalone",
  });

  const did = await request.get("/.well-known/did.json");
  await skipIfUnavailable(did);
  expect(did.ok(), await responseText(did)).toBe(true);
  const didDocument = await did.json();
  expect(didDocument.id).toMatch(/^did:web:/);
  expect(JSON.stringify(didDocument.service)).toContain("#skyblur_api");
});

test("OAuth JWKS endpoint returns JSON and cache semantics", async ({ request }) => {
  const res = await request.get("/api/oauth/jwks.json");
  await skipIfUnavailable(res);
  expect(res.headers()["content-type"]).toMatch(/application\/json/);

  const body = await res.json();
  if (res.ok()) {
    expect(body).toHaveProperty("keys");
  } else {
    expect(res.status()).toBe(500);
    expect(body.error).toBe("OAUTH_PRIVATE_KEY_JWK is not set");
  }
});

test("OAuth session endpoint reports unauthenticated without a signed DID cookie", async ({
  request,
}) => {
  const res = await request.get("/api/oauth/session");
  await skipIfUnavailable(res);
  expect(res.ok(), await responseText(res)).toBe(true);

  expect(res.headers()["content-type"]).toMatch(/application\/json/);
  await expect(res.json()).resolves.toEqual({ authenticated: false });
});

test("OAuth soft logout succeeds and expires the DID cookie", async ({ request }) => {
  const res = await request.post("/api/oauth/soft-logout");
  await skipIfUnavailable(res);
  expect(res.ok(), await responseText(res)).toBe(true);

  await expect(res.json()).resolves.toEqual({ success: true });
  expect(res.headers()["set-cookie"]).toContain("oauth_did=");
  expect(res.headers()["set-cookie"]).toContain("Max-Age=0");
});

test("OAuth logout succeeds without a signed DID cookie and expires the DID cookie", async ({
  request,
}) => {
  const res = await request.post("/api/oauth/logout");
  await skipIfUnavailable(res);
  expect(res.ok(), await responseText(res)).toBe(true);

  await expect(res.json()).resolves.toEqual({ success: true });
  expect(res.headers()["set-cookie"]).toContain("oauth_did=");
  expect(res.headers()["set-cookie"]).toContain("Max-Age=0");
});

test("OAuth callback failure redirects home with a login error", async ({ request }) => {
  const res = await request.get("/api/oauth/callback?state=bad&code=bad", {
    maxRedirects: 0,
  });
  await skipIfUnavailable(res);

  if (res.status() === 500) {
    return;
  }

  expect(res.status(), await responseText(res)).toBe(307);
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(res.headers()["location"]).toContain("loginError=callback_failed");
});

test("OAuth callback user rejection redirects without server error logging", async ({ request }) => {
  const res = await request.get("/api/oauth/callback?error=access_denied&state=bad", {
    maxRedirects: 0,
  });
  await skipIfUnavailable(res);

  if (res.status() === 500) {
    return;
  }

  expect(res.status(), await responseText(res)).toBe(307);
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(res.headers()["location"]).toContain("loginError=rejected");
});

test("OAuth login rejects cross-host callback redirects", async ({ request, baseURL }) => {
  const res = await request.get(
    "/api/oauth/login?handle=bad_handle&redirect_uri=https%3A%2F%2Fdev.skyblur.uk%2Fconsole",
    { maxRedirects: 0 },
  );
  await skipIfUnavailable(res);

  if (res.status() === 500) {
    return;
  }

  const location = new URL(res.headers()["location"]);
  expect(res.status(), await responseText(res)).toBe(307);
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(location.origin).toBe(expectedOAuthOrigin(baseURL));
  expect(location.pathname).toBe("/console");
  expect(location.searchParams.get("loginError")).toBe("invalid_handle");
});

test("OAuth login returns JSON errors for client-side login starts", async ({ request }) => {
  const res = await request.get("/api/oauth/login?handle=bad_handle", {
    headers: { accept: "application/json" },
    maxRedirects: 0,
  });
  await skipIfUnavailable(res);

  if (res.status() === 500) {
    return;
  }

  expect(res.status(), await responseText(res)).toBe(400);
  expect(res.headers()["cache-control"]).toBe("no-store");
  await expect(res.json()).resolves.toMatchObject({ error: "invalid_handle" });
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

test("app.bsky XRPC pipeline shuts down instead of hanging indefinitely", async ({
  request,
}) => {
  const startedAt = Date.now();
  const res = await request.get(
    "/xrpc/app.bsky.actor.getProfile?actor=did%3Aplc%3Argdcflm4ylsl6udghmtblydc&__e2ePipelineDelayMs=11000",
    { timeout: 20_000 },
  );
  const elapsedMs = Date.now() - startedAt;
  await skipIfUnavailable(res);

  expect(res.status(), await responseText(res)).toBe(504);
  expect(res.headers()["x-skyblur-upstream-error"]).toBe("timeout");
  expect(res.headers()["x-skyblur-atproto-proxy"]).toBe("did:web:api.bsky.app#bsky_appview");
  expect(Number(res.headers()["x-skyblur-xrpc-elapsed-ms"])).toBeGreaterThanOrEqual(9_000);
  expect(elapsedMs).toBeLessThan(15_000);
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
  expect(res.ok(), await responseText(res)).toBe(true);

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

test("handle resolution rejects local and IP literal handles", async ({ request }) => {
  const localIp = await request.get("/api/resolve-handle?handle=127.0.0.1");
  await skipIfUnavailable(localIp);
  expect(localIp.status(), await responseText(localIp)).toBe(400);
  await expect(localIp.json()).resolves.toEqual({ error: "Invalid handle" });

  const localhost = await request.get("/api/resolve-handle?handle=localhost.localdomain");
  await skipIfUnavailable(localhost);
  expect(localhost.status(), await responseText(localhost)).toBe(400);
  await expect(localhost.json()).resolves.toEqual({ error: "Invalid handle" });

  const privateSuffix = await request.get("/api/resolve-handle?handle=pds.internal");
  await skipIfUnavailable(privateSuffix);
  expect(privateSuffix.status(), await responseText(privateSuffix)).toBe(400);
  await expect(privateSuffix.json()).resolves.toEqual({ error: "Invalid handle" });
});

test("OAuth login rejects local and IP literal handles before authorize", async ({ request }) => {
  const res = await request.get("/api/oauth/login?handle=127.0.0.1", {
    headers: { Accept: "application/json" },
  });
  await skipIfUnavailable(res);
  expect(res.status(), await responseText(res)).toBe(400);
  await expect(res.json()).resolves.toMatchObject({ error: "invalid_handle" });

  const privateSuffix = await request.get("/api/oauth/login?handle=pds.internal", {
    headers: { Accept: "application/json" },
  });
  await skipIfUnavailable(privateSuffix);
  expect(privateSuffix.status(), await responseText(privateSuffix)).toBe(400);
  await expect(privateSuffix.json()).resolves.toMatchObject({ error: "invalid_handle" });
});

test("/console shows the login form when there is no OAuth session", async ({
  page,
  context,
  baseURL,
}) => {
  await openConsoleLoginForm(page, context, baseURL);

  await expect(page.getByRole("link", { name: "Skyblur" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Skyblur" })).toBeVisible();
  await expect(page.getByText("Login with atproto account")).toBeVisible();
  await expect(page.getByText("Agree to the contents")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Term of Use" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Handle" })).toBeVisible();
  await expect(page.getByPlaceholder("alice.bsky.social")).toBeVisible();
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeDisabled();
  await page.getByLabel("Agree to the contents").check();
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Login with @passport" })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Create Account" })).toBeVisible();
});

test("/console create post route shows login form without an OAuth session", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { authenticated: false });
  await gotoAndSkipIfUnavailable(page, "/console/posts/new");

  await expect(page.getByText("Login with atproto account")).toBeVisible();
  await expect(page.getByText("Write", { exact: true })).toHaveCount(0);
});

for (const [handle, message] of [
  ["@alice.bsky.social", 'Please do not include the "@" in the handle.'],
  ["bad_handle", "Bluesky handles do not contain underscores"],
  ["bad handle", "Handles cannot contain whitespace"],
  ["bad!handle", "Bluesky handles can only contain letters, numbers, hyphens, and dots. Please check your input."],
  ["alice", 'Please include ".bsky.social", like "alice.bsky.social".'],
  ["alice.", "Handles cannot end with a dot."],
  ["alice..bsky.social", "Handles cannot contain consecutive dots."],
] as const) {
  test(`/console validates login handle ${handle}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await openConsoleLoginForm(page, context, baseURL);
    await page.getByLabel("Agree to the contents").check();
    await expectLoginValidationMessage(page, handle, message);
  });
}

test("/console warns before starting OAuth for likely handle typos", async ({
  page,
  context,
  baseURL,
}) => {
  await openConsoleLoginForm(page, context, baseURL);
  let loginRequests = 0;
  await page.route("**/api/oauth/login?**", async (route) => {
    loginRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "https://bsky.social/oauth/authorize?client_id=e2e" }),
    });
  });

  const handleInput = page.getByRole("combobox", { name: "Handle" });
  await page.getByLabel("Agree to the contents").check();
  await handleInput.fill("shibata1945.bsky.socal");
  await expect(handleInput).toHaveValue("shibata1945.bsky.socal");
  await expect(page.getByText('This may be a typo for "bsky.social". Please check your handle.').first()).toBeVisible();

  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByText('This may be a typo for "bsky.social". Please check your handle.').first()).toBeVisible();
  await expect(page).toHaveURL(/\/console$/);
  expect(loginRequests).toBe(0);
});

test("/console login form shows callback errors and clears typeahead input", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { authenticated: false });

  await gotoAndSkipIfUnavailable(page, "/console?loginError=invalid_handle");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Skyblur" })).toBeVisible();
  await expect(main.getByText("Invalid handle.")).toBeVisible();

  const loginDialog = page.getByRole("dialog", { name: "Login" });
  await expect(loginDialog).toBeVisible();
  await expect(loginDialog.getByText("Invalid handle.")).toBeVisible();

  const handleInput = loginDialog.getByRole("combobox");
  await handleInput.fill("clearme");
  await expect(handleInput).toHaveValue("clearme");
  await handleInput.fill("");
  await expect(handleInput).toHaveValue("");
  await expect(loginDialog.getByRole("button", { name: "Login", exact: true })).toBeDisabled();
});

test("/settings redirects unauthenticated visitors back home", async ({
  page,
  context,
  baseURL,
}) => {
  await useEnglishLocale(context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/settings");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Skyblur" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Skyblur" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(page.getByText("Settings")).toHaveCount(0);
});

test("/profile renders a published profile and public post list", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, `/profile/${encodeURIComponent(mockDid)}`);

  await expect(page).toHaveURL(/\/profile\/did%3Aplc%3Ae2emock$/);
  await expect(page.getByText("E2E Tester")).toBeVisible();
  await expect(page.getByText("Existing E2E My Page description")).toBeVisible();
  await expect(page.getByText("Visible E2E ○○○○○○ console post")).toBeVisible();
  await page.getByText("Visible E2E").click();
  await expect(page.getByText("E2E additional note")).toBeVisible();
  await expect(page.getByRole("link").filter({ has: page.locator("svg") }).last()).toBeVisible();
});

test("/profile renders the private profile message when preferences are unpublished", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { noPreference: true });

  await gotoAndSkipIfUnavailable(page, `/profile/${encodeURIComponent(mockDid)}`);

  await expect(page.getByText("E2E Tester")).toBeVisible();
  await expect(page.getByText("The profile page is private.")).toBeVisible();
  await expect(page.getByText("Post List")).toHaveCount(0);
});

test("/profile renders the private profile message when profile loading fails", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { profileStatus: 500 });

  await gotoAndSkipIfUnavailable(page, `/profile/${encodeURIComponent(mockDid)}`);

  await expect(page.getByText("The profile page is private.")).toBeVisible();
  await expect(page.getByText("Post List")).toHaveCount(0);
});

test("/post renders public detail content with profile and reaction metadata", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postDetailVariant: "public" });

  await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2epost`);

  await expect(page).toHaveURL(/\/post\/did%3Aplc%3Ae2emock\/e2epost$/);
  await expect(page.getByText("E2E Tester")).toBeVisible();
  await expect(page.getByText("Public post detail secret text")).toBeVisible();
  await expect(page.getByText("Public post detail additional")).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to My Page" })).toBeVisible();
  await expect(page.getByText("4", { exact: true })).toBeVisible();
});

test("/post hides reaction metadata when reaction fetches fail", async ({
  page,
  context,
  baseURL,
}) => {
  const cases = [
    { constellationIntentStatus: 500 as const },
    { constellationAllStatus: 500 as const },
  ];

  for (const options of cases) {
    await useLoggedInOAuthMock(page, context, baseURL, { ...options, postDetailVariant: "public" });
    await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2epublic-${Object.keys(options)[0]}`);

    await expect(page.getByText("E2E Tester")).toBeVisible();
    await expect(page.getByText("Public post detail secret text")).toBeVisible();
    await expect(page.getByText("4", { exact: true })).toHaveCount(0);
    await expect(page.getByText("3", { exact: true })).toHaveCount(0);
  }
});

test("/post validates and unlocks password-protected detail content", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postDetailVariant: "password" });

  await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2epassword`);

  await expect(page.getByText("E2E Tester")).toBeVisible();
  await expect(page.getByText("○○○○○")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible();
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Password is required")).toBeVisible();

  await page.locator("input").last().fill("p@ssword");
  await page.getByRole("button", { name: "Unlock" }).click();

  await expect(page.getByText("Unlocked post detail text")).toBeVisible();
  await expect(page.getByText("Unlocked post detail additional")).toBeVisible();
});

for (const { visibility, label, tone, options } of [
  {
    visibility: "public",
    label: "Public",
    tone: "public",
    options: { postDetailVariant: "public" as const },
  },
  {
    visibility: "password",
    label: "Password required",
    tone: "password",
    options: { postDetailVariant: "password" as const },
  },
  {
    visibility: "login",
    label: "Login required",
    tone: "login",
    options: {
      authenticated: false,
      postDetailVariant: "authRequired" as const,
      postDetailVisibility: "login" as const,
    },
  },
  {
    visibility: "followers",
    label: "Followers only",
    tone: "followers",
    options: {
      authenticated: false,
      postDetailVariant: "authRequired" as const,
      postDetailVisibility: "followers" as const,
    },
  },
  {
    visibility: "following",
    label: "Following only",
    tone: "following",
    options: {
      authenticated: false,
      postDetailVariant: "authRequired" as const,
      postDetailVisibility: "following" as const,
    },
  },
  {
    visibility: "mutual",
    label: "Mutuals only",
    tone: "mutual",
    options: {
      authenticated: false,
      postDetailVariant: "authRequired" as const,
      postDetailVisibility: "mutual" as const,
    },
  },
  {
    visibility: "list",
    label: "List only",
    tone: "list",
    options: {
      authenticated: false,
      postDetailVariant: "authRequired" as const,
      postDetailVisibility: "list" as const,
    },
  },
]) {
  test(`/post renders the ${visibility} visibility badge`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, options);

    await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2e-badge-${visibility}`);

    const badge = page.getByTestId("post-visibility-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(label);
    await expect(badge).toHaveAttribute("data-tone", tone);
  });
}

test("/post shows restricted login-required detail content to logged-out visitors", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    authenticated: false,
    postDetailVariant: "authRequired",
  });

  await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2erestricted`);

  await expect(page.getByText("E2E Tester")).toBeVisible();
  await expect(page.getByText("この投稿はフォロワー限定です。参照するにはログインが必要です。")).toBeVisible();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
});

test("/post refetches restricted detail after the session resolves authenticated", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    authenticated: false,
    postDetailVariant: "authRequired",
    postDetailVisibility: "followers",
  });

  let resolveSession = () => {};
  let sessionRequests = 0;
  await page.unroute("**/api/oauth/session");
  await page.route("**/api/oauth/session", async (route) => {
    sessionRequests += 1;
    await new Promise<void>((resolve) => {
      resolveSession = resolve;
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Cache-Control": "no-store",
        Vary: "Cookie",
      },
      body: JSON.stringify({
        authenticated: true,
        did: mockDid,
        pds: "https://e2e-pds.skyblur.test",
        scope: "atproto repo:app.bsky.feed.post?action=create&action=delete",
      }),
    });
  });

  let getPostRequests = 0;
  await page.route("**/xrpc/uk.skyblur.post.getPost", async (route) => {
    getPostRequests += 1;
    if (getPostRequests === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: "*****",
          additional: "",
          errorCode: "AuthRequired",
          visibility: "followers",
          createdAt: "2026-05-04T03:22:34.000Z",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        text: "Authenticated restricted post detail text",
        additional: "Authenticated restricted post detail additional",
        visibility: "followers",
        createdAt: "2026-05-04T03:22:34.000Z",
      }),
    });
  });

  await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2erefetch`);
  await expect(page.getByText("この投稿はフォロワー限定です。参照するにはログインが必要です。")).toBeVisible();
  expect(getPostRequests).toBe(1);

  await expect.poll(() => sessionRequests).toBe(1);
  resolveSession();

  await expect(page.getByText("Authenticated restricted post detail text")).toBeVisible();
  await expect(page.getByText("Authenticated restricted post detail additional")).toBeVisible();
  await expect(page.getByText("この投稿はフォロワー限定です。参照するにはログインが必要です。")).toHaveCount(0);
  expect(sessionRequests).toBe(1);
  expect(getPostRequests).toBe(2);
});

for (const { visibility, message } of [
  {
    visibility: "login" as const,
    message: "この投稿を参照するにはログインが必要です。",
  },
  {
    visibility: "followers" as const,
    message: "この投稿はフォロワー限定です。参照するにはログインが必要です。",
  },
  {
    visibility: "following" as const,
    message: "この投稿はフォロー中限定です。参照するにはログインが必要です。",
  },
  {
    visibility: "mutual" as const,
    message: "この投稿は相互フォロー限定です。参照するにはログインが必要です。",
  },
]) {
  test(`/post shows logged-out ${visibility} restricted visibility message`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, {
      authenticated: false,
      postDetailVariant: "authRequired",
      postDetailVisibility: visibility,
    });

    await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2e-${visibility}`);
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });
}

test("/post links to Bluesky profile when My Page preferences are not published", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    noPreference: true,
    postDetailVariant: "public",
  });

  await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2epublic-no-mypage`);

  const profileLink = page.getByRole("link", { name: /E2E Tester/ });
  await expect(profileLink).toBeVisible();
  await expect(profileLink).toHaveAttribute("href", `https://bsky.app/profile/${mockDid}`);
  await expect(profileLink).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("button", { name: "Go to MyPage" })).toHaveCount(0);
});

for (const [restrictedErrorCode, message] of [
  ["NotFollower", "You do not have permission to view this post (Followers only)."],
  ["NotFollowing", "You do not have permission to view this post (Following only)."],
  ["NotMutual", "You do not have permission to view this post (Mutuals only)."],
  ["NotListMember", "This post is limited to a selected list, or permission could not be confirmed."],
  ["ListMembershipCheckFailed", "List visibility could not be confirmed. Please try again later."],
  ["AuthRequired", "Please log in to view this post."],
  ["ContentMissing", "Content not found."],
  ["Other", "You do not have permission to view this post."],
] as const) {
  test(`/post renders ${restrictedErrorCode} denial message for logged-in visitors`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, { restrictedErrorCode });
    await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2erestricted-${restrictedErrorCode}`);
    await expect(page.getByText("E2E Tester")).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });
}

test("/post renders a fetch failure message when detail loading fails", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postDetailVariant: "error" });

  await gotoAndSkipIfUnavailable(page, `/post/${encodeURIComponent(mockDid)}/e2efailed`);

  await expect(page.getByText("E2E Tester")).toBeVisible();
  await expect(page.getByText("Get Post Failed.")).toBeVisible();
});

test("/console renders logged-in dashboard from mocked OAuth session", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");

  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create a post" })).toBeVisible();
  await expect(page.getByText("Post List")).toBeVisible();
  await expect(page.getByText("Visible E2E")).toBeVisible();
  await expect(page.getByText("console post")).toBeVisible();
});

test("/console prompts relogin when app.bsky rpc scopes are missing", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    sessionScope: "atproto repo:app.bsky.feed.post?action=create&action=delete",
  });

  await gotoAndSkipIfUnavailable(page, "/console");

  await expect(page.getByText("Login permissions need to be updated")).toBeVisible();
  await expect(page.getByText("Skyblur has added a new feature. Press Log in again on the right to start using it.")).toBeVisible();
  await expect(page.getByText("rpc:app.bsky.graph.getLists?aud=*")).toBeVisible();

  const relogin = page.getByRole("link", { name: "Log in again" });
  await expect(relogin).toBeVisible();
  await expect(relogin).toHaveAttribute("href", /\/api\/oauth\/login\?redirect_uri=/);
});

test("/console prompts relogin for an older session missing list visibility scopes", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    sessionScope: mockOlderSessionScope,
  });

  await gotoAndSkipIfUnavailable(page, "/console");

  await expect(page.getByText("Login permissions need to be updated")).toBeVisible();
  await expect(page.getByText("Skyblur has added a new feature. Press Log in again on the right to start using it.")).toBeVisible();
  await expect(page.getByText("rpc:app.bsky.graph.getLists?aud=*")).toBeVisible();
  await expect(page.getByText("rpc:app.bsky.graph.getList?aud=*")).toBeVisible();
  await expect(page.getByText("rpc:app.bsky.feed.searchPosts?aud=*")).toHaveCount(0);

  const relogin = page.getByRole("link", { name: "Log in again" });
  await expect(relogin).toBeVisible();
  await expect(relogin).toHaveAttribute("href", /\/api\/oauth\/login\?redirect_uri=/);
});

test("/console hides relogin prompt when current app.bsky rpc scopes are present", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    sessionScope: mockCurrentSessionScope,
  });

  await gotoAndSkipIfUnavailable(page, "/console");

  await expect(page.getByText("Login permissions need to be updated")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create a post" })).toBeVisible();
});

test("/console remains usable when the profile fetch fails", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { profileStatus: 500 });

  await gotoAndSkipIfUnavailable(page, "/console");

  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByText(mockDid)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create a post" })).toBeVisible();
  await expect(page.getByText("Post List")).toBeVisible();
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText(mockDid).last()).toBeVisible();
  await expect(page.getByText("Logout")).toBeVisible();
});

test("/console create post form covers validation, reply, visibility, and submit UI", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);

  await expect(page.getByText("Post content")).toBeVisible();
  await expect(page.getByText("Simple Mode")).toBeVisible();
  await expect(page.getByText("Additional", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();

  const postInput = page.getByPlaceholder("Please enter the content.");
  const additionalInput = page.getByPlaceholder("Enter additional information if necessary.");

  await postInput.fill("Select secret text");
  await page.getByRole("button", { name: "Enclose the selected text with []" }).click();
  await expect(postInput).toHaveValue("Select secret text");
  await postInput.evaluate((node) => {
    const input = node as HTMLTextAreaElement;
    input.setSelectionRange(7, 13);
  });
  await page.getByRole("button", { name: "Enclose the selected text with []" }).click();
  await expect(postInput).toHaveValue("Select [secret] text");

  await postInput.fill("E2E post with [secret] #coverage https://example.com");
  await additionalInput.fill("E2E additional content shown only on Skyblur");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();

  await postInput.fill("This uses ［full width］ brackets");
  await expect(page.getByRole("button", { name: "Convert Full-width Brackets to Half-width Brackets" })).toBeVisible();
  await page.getByRole("button", { name: "Convert Full-width Brackets to Half-width Brackets" }).click();
  await expect(postInput).toHaveValue("This uses [full width] brackets");
  await page.getByLabel("Omit consecutive * (Bluesky only)").check();
  await page.getByLabel("Omit consecutive * (Bluesky only)").uncheck();

  await postInput.fill("This [has [bad] brackets");
  await expect(page.getByText("A closing ] is missing. Please add ].")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();

  await page.getByLabel("Simple Mode").click();
  const changeModeDialog = page.getByRole("dialog", { name: "Change Mode" });
  await expect(changeModeDialog).toBeVisible();
  await changeModeDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(changeModeDialog).toBeHidden();
  await page.getByLabel("Simple Mode").click();
  await changeModeDialog.getByRole("button", { name: "Change" }).click();
  await expect(changeModeDialog).toBeHidden();
  await expect(page.getByText("The second line and beyond will be automatically blurred.")).toBeVisible();
  await postInput.fill("Public line\nHidden line");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();

  await goToAudienceStep(page);
  await page.getByRole("button", { name: "Password" }).click();
  await expect(page.getByText("Only people who know the password can read the full text and additional text.")).toBeVisible();
  await expect(page.getByPlaceholder("p@ssw0rd")).toBeVisible();
  await page.getByPlaceholder("p@ssw0rd").fill("bad pass");
  await expect(page.getByText("Spaces are not allowed in the password.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByPlaceholder("p@ssw0rd").fill("p@ssword");

  await page.getByRole("button", { name: "Followers only" }).click();
  await expect(page.getByText("Only people logged in to Skyblur who follow you can read the full text and additional text.")).toBeVisible();
  await page.getByRole("button", { name: "Public" }).click();

  await openComposerDetails(page);
  await page.getByLabel("Set a reply target").click();
  await expect(page.getByText("E2E reply target post")).toBeVisible();
  await selectReplyTarget(page);
  await expect(page.getByText("E2E reply target post")).toBeVisible();
  await page.getByLabel("Set a reply target").click();
  await expect(page.getByText("E2E reply target post")).toHaveCount(0);

  await page.getByRole("button", { name: "Back" }).click();
  await postInput.fill(
    `E2E final covered post #coverage #${"a".repeat(65)} # https://example.com @badhandle`,
  );
  await additionalInput.fill("Final E2E additional content");
  await goToAudienceStep(page);
  await goToCheckStep(page);
  await expect(page.getByText("What appears on Skyblur")).toBeVisible();
  await expect(page.getByText("What appears on Bluesky")).toBeVisible();
  await submitComposer(page);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();
});

test("/console submits list visibility post after selecting an owned list", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);

  await page.getByPlaceholder("Please enter the content.").fill("E2E list [secret] post");
  await page.getByPlaceholder("Enter additional information if necessary.").fill("E2E list-only additional");
  await goToAudienceStep(page);
  await selectListVisibility(page);

  await expect(page.getByText("Allowed list", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E Allowed List")).toBeVisible();
  await expect(page.getByText("Someone else's list")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();

  await page.getByText("E2E Allowed List").click();
  await expect(page.getByLabel("Selected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();

  await goToCheckStep(page);
  await submitComposer(page);
});

test("/console list visibility shows an empty owned-list state", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { getListsEmpty: true });
  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("E2E list empty state");
  await goToAudienceStep(page);
  await selectListVisibility(page);
  await expect(page.getByText("No lists owned by this account were found.")).toBeVisible();
});

test("/console list visibility shows owned-list loading failures", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { getListsStatus: 500 });
  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("E2E list error state");
  await goToAudienceStep(page);
  await selectListVisibility(page);
  await expectListVisibilityMessage(page, "Failed to load lists.");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("/console submits password-protected post from the create form", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);

  await page.getByPlaceholder("Please enter the content.").fill("E2E password [secret] post");
  await page.getByPlaceholder("Enter additional information if necessary.").fill("E2E encrypted additional");
  await goToAudienceStep(page);
  await page.getByRole("button", { name: "Password" }).click();
  await expect(page.getByText("Only people who know the password can read the full text and additional text.")).toBeVisible();
  await page.getByPlaceholder("p@ssw0rd").fill("p@ssword");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();

  await goToCheckStep(page);
  await submitComposer(page);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();
});

test("/console submits restricted post with reply controls from the create form", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);

  await page.getByPlaceholder("Please enter the content.").fill("E2E followers [secret] post");
  await page.getByPlaceholder("Enter additional information if necessary.").fill("E2E followers-only additional");
  await goToAudienceStep(page);
  await page.getByRole("button", { name: "Followers only" }).click();
  await expect(page.getByText("Only people logged in to Skyblur who follow you can read the full text and additional text.")).toBeVisible();
  await openComposerDetails(page);
  await page.getByText("Mentioned users").click();
  await page.getByText("Followed users").click();
  await page.getByLabel("Allow quotes of this post").uncheck();
  await page.getByLabel("Set a reply target").check();
  await expect(page.getByText("E2E reply target post")).toBeVisible();
  await selectReplyTarget(page);
  await expect(page.getByText("E2E reply target post")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();

  await goToCheckStep(page);
  await submitComposer(page);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();
});

test("/console create post form covers bracket warnings and reply paging", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    replySearchHasNextPage: true,
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);

  const postInput = page.getByPlaceholder("Please enter the content.");
  await postInput.fill("This has unbalanced] brackets");
  await expect(page.getByText("The brackets are not correct. The number of [ and ] do not match.")).toBeVisible();

  await page.getByLabel("Simple Mode").click();
  await page.getByRole("button", { name: "Change" }).click();
  await postInput.fill("Public [bracket] line");
  await expect(page.getByText("You cannot use [] in Simple Mode")).toBeVisible();

  await page.getByLabel("Simple Mode").click();
  await page.getByRole("button", { name: "Change" }).click();
  await postInput.fill("Reply paging [secret]");
  await goToAudienceStep(page);
  await openComposerDetails(page);
  await page.getByLabel("Set a reply target").check();
  await expect(page.getByText("E2E reply target post")).toBeVisible();
  await expect(page.getByText("External root reply should be filtered")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Read More" })).toBeVisible();
});

test("/console reply target picker handles empty searches", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { replySearchEmpty: true });
  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("E2E empty reply picker");
  await goToAudienceStep(page);
  await openComposerDetails(page);
  await page.getByLabel("Set a reply target").check();
  await expect(page.getByText("No posts available.")).toBeVisible();
});

test("/console reply target picker handles failed searches", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { replySearchStatus: 500 });
  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("E2E failed reply picker");
  await goToAudienceStep(page);
  await openComposerDetails(page);
  await page.getByLabel("Set a reply target").check();
  await expect(page.getByText("No posts available.")).toBeVisible();
});

test("/console create post form keeps encrypted submission open when encryption fails", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { encryptStatus: 500 });

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("E2E failed password [secret]");
  await goToAudienceStep(page);
  await page.getByRole("button", { name: "Password" }).click();
  await page.getByPlaceholder("p@ssw0rd").fill("p@ssword");
  await goToCheckStep(page);
  await page.getByRole("button", { name: "Post" }).click({ force: true });
  await expect(page.getByText("Encryption failed. The text, additional text, and password are still kept. Try again.")).toBeVisible();
  await expect(page.locator("#post-composer-encrypt-failed")).toHaveCount(0);
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("E2E failed password [secret]");
  await expect(page).toHaveURL(/\/console\/posts\/new$/);
});

test("/console create post form shows upload failure", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { uploadBlobStatus: 500 });

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("E2E failed upload [secret]");
  await goToAudienceStep(page);
  await page.getByRole("button", { name: "Password" }).click();
  await page.getByPlaceholder("p@ssw0rd").fill("p@ssword");
  await goToCheckStep(page);
  await page.getByRole("button", { name: "Post" }).click({ force: true });
  await expect(page.getByText("Could not upload the encrypted data. The post has not been created yet. Try again.")).toBeVisible();
  await expect(page.locator("#post-composer-blob-upload-failed")).toHaveCount(0);
});

test("/console create post form shows restricted storage failure", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { storeStatus: 500 });

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("E2E failed restricted [secret]");
  await goToAudienceStep(page);
  await page.getByRole("button", { name: "Followers only" }).click();
  await page.keyboard.press("Escape");
  await goToCheckStep(page);
  await page.getByRole("button", { name: "Post" }).click({ force: true });
  await expect(page.getByText("Could not save the restricted full text. The text and additional text are still on this screen. Try again.")).toBeVisible();
  await expect(page.locator("#post-composer-restricted-store-failed")).toHaveCount(0);
});

test("/console create post form shows apply write failure", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { applyWritesStatus: 500 });

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("E2E failed apply [secret]");
  await goToAudienceStep(page);
  await goToCheckStep(page);
  await page.getByRole("button", { name: "Post" }).click({ force: true });
  await expect(page.getByText("Could not save the post records. The save is not complete. Try again.")).toBeVisible();
  await expect(page.locator("#post-composer-apply-writes-failed")).toHaveCount(0);
});

test("/console create post form writes reply and quote controls from the screen", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  const applyWriteBodies: any[] = [];
  await page.route("**/xrpc/com.atproto.repo.applyWrites", async (route) => {
    applyWriteBodies.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("E2E reply controls [secret] #thread https://example.com");
  await goToAudienceStep(page);
  await openComposerDetails(page);
  await expect(page.getByText("Reply Control", { exact: true })).toBeVisible();
  await expect(page.getByText("Mentioned users")).toBeVisible();
  await page.getByText("Mentioned users").click();
  await page.getByText("Followed users").click();
  await page.getByText("Your followers").click();
  await page.getByLabel("Allow quotes of this post").uncheck();
  await page.getByLabel("Set a reply target").check();
  await expect(page.getByText("E2E reply target post")).toBeVisible();
  await selectReplyTarget(page);
  await expect(page.locator('input[value="mention"]')).toBeChecked();
  await expect(page.locator('input[value="following"]')).toBeChecked();
  await expect(page.locator('input[value="followers"]')).toBeChecked();
  await goToCheckStep(page);
  await submitComposer(page);
  expect(applyWriteBodies).toHaveLength(1);
  const applyWriteInput = applyWriteBodies[0].input || applyWriteBodies[0];
  expect(applyWriteInput.repo).toBe(mockDid);
  expect(applyWriteInput.validate).toBeUndefined();

  const writes: any[] = applyWriteInput.writes || [];
  const blueskyPost = writes.find((write) => write.collection === "app.bsky.feed.post");
  expect(blueskyPost).toBeTruthy();
  expect(blueskyPost.$type).toBe("com.atproto.repo.applyWrites#create");
  expect(blueskyPost.rkey).toBeTruthy();
  expect(blueskyPost.value).toMatchObject({
    $type: "app.bsky.feed.post",
    text: "E2E reply controls ****** #thread https://example.com",
    langs: expect.any(Array),
    via: "Skyblur",
    "uk.skyblur.post.uri": `at://${mockDid}/uk.skyblur.post/${blueskyPost.rkey}`,
    "uk.skyblur.post.visibility": "public",
    embed: {
      $type: "app.bsky.embed.external",
      external: {
        uri: expect.stringContaining(`/post/${mockDid}/${blueskyPost.rkey}`),
        title: "Skyblur",
        description: "Refer to the unblurred text.",
      },
    },
    reply: {
      $type: "app.bsky.feed.post#replyRef",
      root: {
        cid: "bafy-e2e-root",
        uri: `at://${mockDid}/app.bsky.feed.post/e2eroot`,
        $type: "com.atproto.repo.strongRef",
      },
      parent: {
        cid: "bafy-e2e-reply",
        uri: `at://${mockDid}/app.bsky.feed.post/e2ereply`,
        $type: "com.atproto.repo.strongRef",
      },
    },
  });
  expect(blueskyPost.value.langs.length).toBeGreaterThan(0);
  expect(blueskyPost.value.createdAt).toEqual(expect.any(String));
  expect(blueskyPost.value.facets).toEqual(expect.arrayContaining([
    expect.objectContaining({
      features: [expect.objectContaining({ $type: "app.bsky.richtext.facet#tag", tag: "thread" })],
    }),
    expect.objectContaining({
      features: [expect.objectContaining({ $type: "app.bsky.richtext.facet#link", uri: "https://example.com" })],
    }),
  ]));

  const skyblurRecord = writes.find((write) => write.collection === "uk.skyblur.post");
  expect(skyblurRecord.value.uri).toBe(`at://${mockDid}/app.bsky.feed.post/${blueskyPost.rkey}`);
  expect(writes.some((write) => write.collection === "app.bsky.feed.threadgate")).toBe(true);
  expect(writes.some((write) => write.collection === "app.bsky.feed.postgate")).toBe(true);
  const threadgate = writes.find((write) => write.collection === "app.bsky.feed.threadgate");
  expect(threadgate.value.allow.map((rule: { $type: string }) => rule.$type)).toEqual([
    "app.bsky.feed.threadgate#mentionRule",
    "app.bsky.feed.threadgate#followingRule",
    "app.bsky.feed.threadgate#followerRule",
  ]);

  const draftStorage = await readComposerDraftStorage(page);
  expect(draftStorage.temp).toMatchObject({
    text: "",
    additional: "",
    reply: "",
    visibility: "public",
  });
  expect(draftStorage.sensitive).toMatchObject({
    text: "",
    additional: "",
    password: "",
    encryptKey: "",
  });
});

test("/console post list supports reveal, reaction, edit, and delete actions", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("Visible E2E")).toBeVisible();
  await page.getByText("Visible E2E").click();

  await expect(page.getByText("E2E additional note")).toBeVisible();
  await expect(page.getByText("4", { exact: true })).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  await page.getByText("4", { exact: true }).click();
  await expect(page.getByText("View Reactions")).toBeVisible();

  const postMenuIcon = page.getByTestId("post-menu").last();
  await postMenuIcon.click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Copy Skyblur URL" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "View in Bluesky" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await clickOpenPostMenuEdit(page);

  await expect(page).toHaveURL(/\/console\/posts\/.+\/edit$/);
  await expect(page.getByText("Write", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("Visible E2E [secret] console post");
  await page.getByPlaceholder("Please enter the content.").fill("Visible E2E [changed] console post");
  await page.getByRole("button", { name: "Back" }).click();
  const backDialog = page.getByRole("dialog", { name: "Confirm" });
  await expect(backDialog).toBeVisible();
  await backDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(backDialog).toBeHidden();
  await expect(page).toHaveURL(/\/console\/posts\/.+\/edit$/);
  await page.goto(`${baseURL}/console`);
  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByText("Post List")).toBeVisible();
  await expect(page.getByText("Visible E2E")).toBeVisible();

  await page.getByTestId("post-menu").last().click();
  await page.getByRole("menuitem", { name: "Copy Skyblur URL" }).click();
  await expect(page.getByText("URL has been copied!")).toBeVisible();
  await page.getByTestId("post-menu").last().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("dialog", { name: "Are you sure you want to delete this post?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByTestId("post-menu").last().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Are you sure you want to delete this post?" });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Visible E2E")).toHaveCount(0);
});

test("/console post list decrypts password-protected posts", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "password" });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("Password E2E")).toBeVisible();
  await expect(page.getByText("This post is password protected.")).toBeVisible();
  await page.locator("input").last().fill("p@ssword");
  await page.getByRole("button", { name: "Unlock" }).click();

  await expect(page.getByText("Decrypted E2E password text")).toBeVisible();
  await expect(page.getByText("Decrypted E2E password additional")).toBeVisible();
  await openLastPostEdit(page);
  await expect(page.getByText("Write", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("Decrypted E2E password text");
});

test("/console password-protected edit unlocks encrypted content", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "password" });

  await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur-password/edit`);
  await expect(page.getByText("Edit password post")).toBeVisible();
  await page.getByPlaceholder("p@ssw0rd").fill("p@ssword");
  await page.getByRole("button", { name: "Unlock" }).click();

  await expect(page.getByText("Write", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("Decrypted E2E password text");
  await expect(page.getByPlaceholder("Enter additional information if necessary.")).toHaveValue("Decrypted E2E password additional");
});

test("/console post list validates password unlock errors", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    postVariant: "password",
    decryptStatus: 403,
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("Password E2E")).toBeVisible();
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Password is required")).toBeVisible();

  await page.locator("input").last().fill("wrong-password");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Incorrect password")).toBeVisible();
});

for (const passwordEncryptBodyShape of ["ref-string", "cid", "link"] as const) {
  test(`/console post list supports ${passwordEncryptBodyShape} password encrypt body cid shape`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, {
      postVariant: "password",
      passwordEncryptBodyShape,
    });
    await gotoAndSkipIfUnavailable(page, "/console");
    await expect(page.getByText("Password E2E")).toBeVisible();
    await page.locator("input").last().fill("p@ssword");
    await page.getByRole("button", { name: "Unlock" }).click();

    await expect(page.getByText("Decrypted E2E password text")).toBeVisible();
  });
}

test("/console post list reports missing password encrypt body cid", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    postVariant: "password",
    passwordEncryptBodyShape: "missing",
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("Password E2E")).toBeVisible();
  await page.locator("input").last().fill("p@ssword");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Message:Error: CID is missing.")).toBeVisible();
});

test("/console post list shows generic decrypt failures", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    postVariant: "password",
    decryptStatus: 500,
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("Password E2E")).toBeVisible();
  await page.locator("input").last().fill("p@ssword");
  await page.getByRole("button", { name: "Unlock" }).click();

  await expect(page.getByText("System error. Please try again later.")).toBeVisible();
});

test("/console post list fetches restricted post details", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "restricted" });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("*****")).toBeVisible();
  await page.getByText("*****").click();

  await expect(page.getByText("Fetched restricted E2E text")).toBeVisible();
  await expect(page.getByText("Fetched restricted E2E additional")).toBeVisible();
});

for (const [restrictedErrorCode, message] of [
  ["NotFollowing", "You do not have permission to view this post (Following only)."],
  ["ContentMissing", "Content not found."],
] as const) {
  test(`/console post list renders ${restrictedErrorCode} restricted authorization error`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, {
      postVariant: "restricted",
      restrictedErrorCode,
    });

    await gotoAndSkipIfUnavailable(page, "/console");
    await expect(page.getByText("*****")).toBeVisible();
    await page.getByText("*****").click();
    await expect(page.getByText(message)).toBeVisible();
  });
}

for (const [restrictedErrorCode, message] of [
  ["NotFollower", "You do not have permission to view this post (Followers only)."],
  ["NotMutual", "You do not have permission to view this post (Mutuals only)."],
  ["Other", "You do not have permission to view this post."],
] as const) {
  test(`/console post list renders ${restrictedErrorCode} restricted denial message`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, {
      postVariant: "restricted",
      restrictedErrorCode,
    });

    await gotoAndSkipIfUnavailable(page, "/console");
    await expect(page.getByText("*****")).toBeVisible();
    await page.getByText("*****").click();
    await expect(page.getByText(message)).toBeVisible();
  });
}

test("/console post list shows a restricted fetch failure", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    postVariant: "restricted",
    postDetailVariant: "error",
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("*****")).toBeVisible();
  await page.getByText("*****").click();
  await expect(page.getByText("Failed to fetch content.")).toBeVisible();
});

test("/console restricted edit reports authorization errors before opening the form", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    postVariant: "restricted",
    restrictedErrorCode: "NotMutual",
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("*****")).toBeVisible();
  await openLastPostEdit(page);

  await expect(page.getByText("You do not have permission to view this post (Mutuals only).")).toBeVisible();
});

test("/console restricted edit keeps the original post when prefetch returns non-ok", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    postVariant: "restricted",
    getPostStatus: 500,
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("*****")).toBeVisible();
  await openLastPostEdit(page);

  await expect(page.getByText("Could not load the restricted post body.")).toBeVisible();
});

for (const [restrictedErrorCode, message] of [
  ["NotFollower", "You do not have permission to view this post (Followers only)."],
  ["NotFollowing", "You do not have permission to view this post (Following only)."],
  ["AuthRequired", "Please log in to view this post."],
  ["ContentMissing", "Content not found."],
  ["Other", "You do not have permission to view this post."],
] as const) {
  test(`/console restricted edit renders ${restrictedErrorCode} denial message`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, {
      postVariant: "restricted",
      restrictedErrorCode,
    });

    await gotoAndSkipIfUnavailable(page, "/console");
    await expect(page.getByText("*****")).toBeVisible();
    await openLastPostEdit(page);

    await expect(page.getByText(message)).toBeVisible();
  });
}

test("/console prefetches restricted post details before editing", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "restricted" });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("*****")).toBeVisible();
  await openLastPostEdit(page);

  await expect(page.getByText("Write", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("Fetched restricted E2E text");
  await expect(page.getByPlaceholder("Enter additional information if necessary.")).toHaveValue("Fetched restricted E2E additional");
});

test("/console supports restricted-to-public edit migration", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "restricted" });
  const deleteStoredBodies: any[] = [];
  await page.route("**/xrpc/uk.skyblur.post.deleteStored", async (route) => {
    deleteStoredBodies.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ deleted: true }),
    });
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("*****")).toBeVisible();
  await openLastPostEdit(page);

  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("Fetched restricted E2E text");
  await goToAudienceStep(page);
  await page.getByRole("button", { name: "Public" }).click();
  await expect(page.getByText("Everyone can read the full text and additional text.")).toBeVisible();
  await goToCheckStep(page);
  await expect(page.getByText("This visibility change is not supported while editing yet. Recreate the post if you need this change.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Update/ })).toBeEnabled();
  await page.getByRole("button", { name: /Update/ }).click({ force: true });

  await expect(page).toHaveURL(/\/console$/);
  expect(deleteStoredBodies).toHaveLength(1);
  const cleanupInput = deleteStoredBodies[0].input ?? deleteStoredBodies[0];
  expect(cleanupInput.uri).toBe(`at://${mockDid}/uk.skyblur.post/e2eblur-restricted`);
});

test("/console deletes restricted posts and cleans up stored content", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "restricted" });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("*****")).toBeVisible();
  await page.getByTestId("post-menu").last().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("dialog", { name: "Are you sure you want to delete this post?" })).toBeVisible();

  const cleanupRequest = page.waitForRequest(/\/xrpc\/uk\.skyblur\.post\.deleteStored/);
  await page.getByRole("button", { name: "Delete" }).click();

  expect((await cleanupRequest).postData() || "").toContain("uk.skyblur.post");
  await expect(page.getByText("Delete completed!")).toBeVisible();
  await expect(page.getByText("*****")).toHaveCount(0);
});

test("/console restricted-to-public edit warns when cleanup fails", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    postVariant: "restricted",
    deleteStoredStatus: 500,
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("*****")).toBeVisible();
  await openLastPostEdit(page);

  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("Fetched restricted E2E text");
  await goToAudienceStep(page);
  await page.getByRole("button", { name: "Public" }).click();
  await goToCheckStep(page);
  await page.getByRole("button", { name: /Update/ }).click({ force: true });

  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByText("The post was saved, but previous restricted data may still remain. Check again later.")).toBeVisible();
});

test("/console updates an existing post from the edit form", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("Visible E2E")).toBeVisible();
  await openLastPostEdit(page);

  const postInput = page.getByPlaceholder("Please enter the content.");
  await expect(page.getByText("Write", { exact: true })).toBeVisible();
  await postInput.fill("Updated E2E [secret] post");
  await page.getByPlaceholder("Enter additional information if necessary.").fill("Updated E2E additional");
  await goToAudienceStep(page);
  await goToCheckStep(page);
  await expect(page.getByText("The already-published Bluesky text and card will not change in this update.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Update/ })).toBeEnabled();
  await page.getByRole("button", { name: /Update/ }).click({ force: true });

  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();
});

test("/console password edit blocks unsupported public migration", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "password" });

  await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur-password/edit`);
  await page.getByPlaceholder("p@ssw0rd").fill("p@ssword");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Write", { exact: true })).toBeVisible();

  await goToAudienceStep(page);
  await page.getByRole("button", { name: "Public" }).click();

  await expect(page.getByText("This visibility change is not supported while editing yet. Recreate the post if you need this change.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
});

test("/console edit route initializes existing Bluesky gate controls", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    editThreadGateStatus: 200,
    editPostGateStatus: 200,
  });

  await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur-public/edit`);
  await expect(page.getByText("Write", { exact: true })).toBeVisible();
  await goToAudienceStep(page);
  await openComposerDetails(page);

  await expect(page.locator('input[value="mention"]')).toBeChecked();
  await expect(page.locator('input[value="following"]')).toBeChecked();
  await expect(page.locator('input[value="followers"]')).toBeChecked();
  await expect(page.getByLabel("Allow quotes of this post")).not.toBeChecked();
  await expect(page.getByText("Reply target", { exact: true })).toHaveCount(0);
});

test("/console edit route treats missing Bluesky gate records as editable defaults", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    editThreadGateStatus: 400,
    editPostGateStatus: 400,
  });

  await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur-public/edit`);
  await expect(page.getByText("Write", { exact: true })).toBeVisible();
  await goToAudienceStep(page);
  await openComposerDetails(page);

  await expect(page.getByText("Reply and quote settings could not be checked, so they cannot be changed in this edit. Text and additional text can still be saved.")).toHaveCount(0);
  await expect(page.locator('input[value="mention"]')).toBeEnabled();
  await expect(page.getByLabel("Allow quotes of this post")).toBeEnabled();
  await expect(page.getByLabel("Allow quotes of this post")).toBeChecked();
});

test("/console edit route keeps gate controls locked when gate loading fails", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    editThreadGateStatus: 500,
    editPostGateStatus: 500,
  });

  await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur-public/edit`);
  await expect(page.getByText("Write", { exact: true })).toBeVisible();
  await goToAudienceStep(page);
  await openComposerDetails(page);

  await expect(page.getByText("Reply and quote settings could not be checked, so they cannot be changed in this edit. Text and additional text can still be saved.")).toBeVisible();
  await expect(page.locator('input[value="mention"]')).toBeDisabled();
  await expect(page.getByLabel("Allow quotes of this post")).toBeDisabled();
});

test("/console edit route reports invalid and unsupported edit records", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);
  await gotoAndSkipIfUnavailable(page, "/console/posts/not-a-did/e2eblur/edit");
  await expect(page.getByText("This post cannot be edited from the currently logged-in account.")).toBeVisible();

  await useLoggedInOAuthMock(page, context, baseURL, { editRecordStatus: 500 });
  await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur/edit`);
  await expect(page.getByText("Could not load the post for editing.")).toBeVisible();

  for (const editRecordVariant of ["invalid-type", "invalid-visibility", "invalid-text"] as const) {
    await useLoggedInOAuthMock(page, context, baseURL, { editRecordVariant });
    await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur/edit`);
    await expect(page.getByText("This post format cannot be edited.")).toBeVisible();
  }

  await useLoggedInOAuthMock(page, context, baseURL, {
    postVariant: "password",
    editRecordVariant: "password-missing-encrypt",
  });
  await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur/edit`);
  await expect(page.getByText("Could not find the encrypted data for this password post.")).toBeVisible();
});

test("/console edit route validates password unlock failures", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "password", decryptStatus: 403 });
  await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur/edit`);

  await expect(page.getByText("Edit password post")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlock" })).toBeDisabled();
  await page.getByPlaceholder("p@ssw0rd").fill("wrong-password");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Incorrect password")).toBeVisible();

  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "password", decryptStatus: 500 });
  await gotoAndSkipIfUnavailable(page, `/console/posts/${encodeURIComponent(mockDid)}/e2eblur/edit`);
  await page.getByPlaceholder("p@ssw0rd").fill("server-error");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Content not found.")).toBeVisible();
});

test("/console restores and discards draft content in the create form", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("Draft E2E [secret] text");
  await page.getByPlaceholder("Enter additional information if necessary.").fill("Draft E2E additional");
  await page.getByRole("button", { name: "Back" }).click();
  await confirmComposerBack(page);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();

  await clickCreateComposer(page);
  await expect(page.getByRole("dialog", { name: "Would you like to restore the content you entered halfway?" })).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("Draft E2E [secret] text");
  await expect(page.getByPlaceholder("Enter additional information if necessary.")).toHaveValue("Draft E2E additional");
  await page.getByRole("button", { name: "Back" }).click();
  await confirmComposerBack(page);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();

  await clickCreateComposer(page);
  await expect(page.getByRole("dialog", { name: "Would you like to restore the content you entered halfway?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("");
});

test("/console restores draft content with a selected reply target", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("Reply draft [secret] text");
  await goToAudienceStep(page);
  await openComposerDetails(page);
  await page.getByLabel("Set a reply target").check();
  await expect(page.getByText("E2E reply target post")).toBeVisible();
  await selectReplyTarget(page);
  await expect(page.getByText("E2E reply target post")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await confirmComposerBack(page);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();

  await clickCreateComposer(page);
  await expect(page.getByRole("dialog", { name: "Would you like to restore the content you entered halfway?" })).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("Reply draft [secret] text");
});

test("/console keeps draft text when the saved reply target cannot be restored", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await openCreateComposer(page);
  await page.getByPlaceholder("Please enter the content.").fill("Reply failure draft [secret] text");
  await goToAudienceStep(page);
  await openComposerDetails(page);
  await page.getByLabel("Set a reply target").check();
  await expect(page.getByText("E2E reply target post")).toBeVisible();
  await selectReplyTarget(page);
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await confirmComposerBack(page);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();

  await useLoggedInOAuthMock(page, context, baseURL, { replyResolveStatus: 500 });
  await clickCreateComposer(page);
  await expect(page.getByRole("dialog", { name: "Would you like to restore the content you entered halfway?" })).toBeVisible();
  await expect(page.getByText("The reply target could not be restored. Text, additional text, and visibility can still be restored.")).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByPlaceholder("Please enter the content.")).toHaveValue("Reply failure draft [secret] text");
});

test("/console login form redirects valid handle to OAuth login", async ({
  page,
  context,
  baseURL,
}) => {
  await openConsoleLoginForm(page, context, baseURL);
  await page.route("**/api/oauth/login?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "https://bsky.social/oauth/authorize?client_id=e2e" }),
    });
  });

  await page.getByLabel("Agree to the contents").check();
  await page.getByRole("combobox", { name: "Handle" }).fill("alice.bsky.social");
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeEnabled();
  const loginRequest = page.waitForRequest(/\/api\/oauth\/login\?handle=alice\.bsky\.social/);
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect((await loginRequest).url()).toContain("redirect_uri=");
});

test("/console login form shows server-side OAuth start errors inline", async ({
  page,
  context,
  baseURL,
}) => {
  await openConsoleLoginForm(page, context, baseURL);
  await page.route("**/api/oauth/login?**", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "invalid_handle" }),
    });
  });

  await page.getByLabel("Agree to the contents").check();
  await page.getByRole("combobox", { name: "Handle" }).fill("alice.bsky.social");
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect(page.getByRole("combobox", { name: "Handle" })).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#handle-error")).toHaveText("Invalid handle.");
  await expect(page).toHaveURL(/\/console$/);
});

test("/console login form restores saved handle and agreement state", async ({
  page,
  context,
  baseURL,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("oauth.handle", "stored.bsky.social");
    localStorage.setItem("login.agreed", "true");
  });
  await openConsoleLoginForm(page, context, baseURL);

  await expect(page.getByRole("combobox", { name: "Handle" })).toHaveValue("stored.bsky.social");
  await expect(page.getByLabel("Agree to the contents")).toBeChecked();
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeEnabled();
});

test("/console greeting renders morning, day, and night messages", async ({
  browser,
  baseURL,
}) => {
  const cases = [
    { iso: "2026-05-04T08:00:00.000+09:00", greeting: "Good morning, E2E Tester!" },
    { iso: "2026-05-04T13:00:00.000+09:00", greeting: "Hello, E2E Tester!" },
    { iso: "2026-05-04T20:00:00.000+09:00", greeting: "Good evening, E2E Tester!" },
  ];

  for (const { iso, greeting } of cases) {
    const context = await browser.newContext({ baseURL, timezoneId: "Asia/Tokyo" });
    const page = await context.newPage();
    await openConsoleWithClock(page, context, baseURL, iso);
    await expect(page.getByText(greeting)).toBeVisible();
    await expect(page.getByRole("button", { name: "Create a post" })).toBeVisible();
    await context.close();
  }
});

test("/console post list shows an empty state when no posts are available", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { postVariant: "empty" });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("No posts available.")).toBeVisible();
  await expect(page.getByText("Post List")).toHaveCount(0);
});

test("/console post list shows an empty state when list records fails", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, { listRecordsStatus: 500 });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("No posts available.")).toBeVisible();
  await expect(page.getByText("Visible E2E")).toHaveCount(0);
});

test("/console post list appends the next page when scrolled to the end", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    listRecordsHasNextPage: true,
  });

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText("Visible E2E")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByText("Next page E2E secret console").first()).toBeVisible();
});

for (const postVariant of ["following", "mutual"] as const) {
  test(`/console post list renders ${postVariant} visibility row`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, { postVariant });

    await gotoAndSkipIfUnavailable(page, "/console");
    await expect(page.getByText("*****")).toBeVisible();
    await page.getByText("*****").click();
    await expect(page.getByText("Fetched restricted E2E text")).toBeVisible();
  });
}

test("/profile hides restricted post content from logged-out visitors", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    authenticated: false,
    postVariant: "restricted",
  });

  await gotoAndSkipIfUnavailable(page, `/profile/${encodeURIComponent(mockDid)}`);

  await expect(page.getByText("E2E Tester")).toBeVisible();
  await expect(page.getByText("Login to view")).toBeVisible();
  await expect(page.getByText("*****")).toHaveCount(0);
});

for (const { variant, hiddenText } of [
  { variant: "login" as const, hiddenText: "Login-only E2E" },
  { variant: "following" as const, hiddenText: "*****" },
  { variant: "mutual" as const, hiddenText: "*****" },
]) {
  test(`/profile hides logged-out ${variant} restricted visibility row`, async ({
    page,
    context,
    baseURL,
  }) => {
    await useLoggedInOAuthMock(page, context, baseURL, {
      authenticated: false,
      postVariant: variant,
    });

    await gotoAndSkipIfUnavailable(page, `/profile/${encodeURIComponent(mockDid)}`);

    await expect(page.getByText("E2E Tester")).toBeVisible();
    await expect(page.getByText("Login to view")).toBeVisible();
    await expect(page.getByText(hiddenText)).toHaveCount(0);
  });
}

test("/profile renders the profile avatar image when one is available", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    profileAvatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:e2emock/bafyavatar@jpeg",
  });

  await gotoAndSkipIfUnavailable(page, `/profile/${encodeURIComponent(mockDid)}`);

  await expect(page.getByAltText("E2E Tester")).toBeVisible();
  await expect(page.getByText("Existing E2E My Page description")).toBeVisible();
  await expect(page.getByText("Visible E2E")).toBeVisible();
});

test("/profile renders avatar and display-name fallbacks", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    noPreference: true,
    profileAvatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:e2emock/bafyavatar@jpeg",
    profileDisplayName: "",
  });

  await gotoAndSkipIfUnavailable(page, `/profile/${encodeURIComponent(mockDid)}`);

  await expect(page.getByAltText("No Avatar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No Display Name" })).toBeVisible();
  await expect(page.getByText(`@${mockHandle}`)).toBeVisible();
});

test("/console login form shows typeahead suggestions and redirects to atpassport", async ({
  page,
  context,
  baseURL,
}) => {
  await openConsoleLoginForm(page, context, baseURL);
  await page.route("https://public.api.bsky.app/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        actors: [
          {
            did: mockDid,
            handle: mockHandle,
            displayName: "E2E Tester",
            avatar: "",
          },
        ],
      }),
    });
  });

  await page.getByLabel("Agree to the contents").check();
  await page.getByRole("combobox", { name: "Handle" }).fill("e2e");
  await expect(page.getByText(mockHandle)).toBeVisible();
  await page.getByText(mockHandle).click();
  await expect(page.getByRole("combobox", { name: "Handle" })).toHaveValue(mockHandle);

  await expect(page.getByRole("button", { name: "Login with @passport" })).toBeEnabled();
  await page.getByRole("button", { name: "Login with @passport" }).click();

  await expect(page).toHaveURL(/preview\.atpassport\.net|atpassport\.net/);
});

test("/settings renders and saves logged-in settings from mocked OAuth data", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/settings");

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Settings").first()).toBeVisible();
  await expect(page.getByText("My Page", { exact: true })).toBeVisible();
  await expect(page.getByText("Custom Feed", { exact: true })).toBeVisible();
  const myPageDescription = page.locator("textarea").first();
  await expect(myPageDescription).toBeVisible();
  await expect(myPageDescription).toHaveValue("Existing E2E My Page description");
  await expect(page.locator('input[value="E2E Custom Feed"]')).toBeVisible();
  await expect(
    page.locator("textarea").filter({ hasText: "Existing E2E custom feed description" }),
  ).toBeVisible();

  await myPageDescription.fill("Updated E2E My Page");
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByText(/E2E Tester/)).toBeVisible();
});

test("/settings keeps save disabled until a visible setting changes", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/settings");
  await expect(page.locator('input[value="E2E Custom Feed"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();

  await page.getByRole("textbox").nth(1).fill("E2E Custom Feed changed");
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();

  await page.getByRole("textbox").nth(1).fill("E2E Custom Feed");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
});

test("/settings creates preferences and validates custom feed avatar input", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    noPreference: true,
    noCustomFeed: true,
  });

  await gotoAndSkipIfUnavailable(page, "/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("My Page", { exact: true })).toBeVisible();
  await page.getByLabel("Publish").first().check();
  await page.locator("textarea").first().fill("Created E2E My Page");
  await page.getByLabel("Publish").nth(1).check();
  await page.getByRole("textbox").nth(1).fill("Created E2E Feed");
  await page.getByRole("textbox").nth(2).fill("Created E2E feed description");
  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("File accepts jpg or png images")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.concat([
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
      Buffer.alloc(950 * 1024),
    ]),
  });
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click({ force: true });
  await expect(page.getByText("Save Completed!").first()).toBeVisible();
  await expect(page).toHaveURL(/\/console$/);
});

test("/settings saves only My Page preferences when custom feed is unchanged", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    noPreference: true,
    noCustomFeed: true,
  });

  await gotoAndSkipIfUnavailable(page, "/settings");
  await expect(page.getByText("My Page", { exact: true })).toBeVisible();
  await page.getByLabel("Publish").first().check();
  await page.locator("textarea").first().fill("My Page only E2E settings");
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Save Completed!")).toBeVisible();
  await expect(page).toHaveURL(/\/console$/);
});

test("/settings updates custom feed metadata without changing the avatar", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/settings");
  await expect(page.locator('input[value="E2E Custom Feed"]')).toBeVisible();
  await page.getByRole("textbox").nth(1).fill("Metadata Only Feed");
  await page.getByRole("textbox").nth(2).fill("Metadata only custom feed update");
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Save Completed!")).toBeVisible();
  await expect(page).toHaveURL(/\/console$/);
});

test("/settings deletes an existing custom feed", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/settings");
  await expect(page.getByText("E2E Custom Feed")).toBeVisible();
  await page.getByLabel("Publish").nth(1).uncheck();
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Save Completed!")).toBeVisible();
  await expect(page).toHaveURL(/\/console$/);
});

test("/settings preserves an existing custom feed avatar when saving feed metadata", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    customFeedAvatar: true,
  });

  await gotoAndSkipIfUnavailable(page, "/settings");
  await expect(page.getByAltText("Feed Avatar Image")).toBeVisible();

  await page.getByRole("textbox").nth(2).fill("Updated E2E feed metadata");
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Save Completed!")).toBeVisible();
  await expect(page).toHaveURL(/\/console$/);
});

test("/settings reports avatar upload failures from the settings screen", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL, {
    noPreference: true,
    noCustomFeed: true,
    uploadBlobStatus: 500,
  });

  await gotoAndSkipIfUnavailable(page, "/settings");
  await page.getByLabel("Publish").nth(1).check();
  await page.getByRole("textbox").nth(0).fill("Upload Failure Feed");
  await page.getByRole("textbox").nth(1).fill("Upload failure feed description");
  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]),
  });

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("error", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);
});

test("/settings reports apply write failures while saving settings", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);
  await page.route("**/xrpc/com.atproto.repo.applyWrites", async (route) => {
    await route.abort("failed");
  });

  await gotoAndSkipIfUnavailable(page, "/settings");
  const myPageDescription = page.locator("textarea").first();
  await expect(myPageDescription).toHaveValue("Existing E2E My Page description");
  await myPageDescription.fill("Settings failure branch");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText(/Error:/)).toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);
});

test("header account menu exposes logged-in settings and logout actions", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");

  await expect(page.getByText(/E2E Tester/)).toBeVisible();
  await page.getByLabel("Account menu").click();
  await expect(page.getByText(mockHandle)).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Settings|設定/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Logout|ログアウト/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /Logout|ログアウト/ }).click();
  await expect(page.getByRole("dialog", { name: /Logout|ログアウト/ })).toBeVisible();
  await expect(page.getByText("Please choose how you would like to logout.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Logout from this device/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Invalidate session and logout/ })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByLabel("Account menu").click();
  await page.getByRole("menuitem", { name: /Settings|設定/ }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText(mockDid)).toHaveCount(0);
});

test("header account menu can soft logout from the console", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/console");
  await expect(page.getByText(/E2E Tester/)).toBeVisible();
  await page.getByLabel("Account menu").click();
  await page.getByRole("menuitem", { name: /Logout|ログアウト/ }).click();
  await expect(page.getByRole("dialog", { name: /Logout|ログアウト/ })).toBeVisible();
  await page.getByRole("button", { name: /Logout from this device/ }).click();

  await expect(page.getByRole("heading", { name: "Welcome to Skyblur" })).toBeVisible();
});

test("header account menu can hard logout from settings", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/settings");
  await expect(page.getByText("Settings").first()).toBeVisible();
  await page.getByLabel("Account menu").click();
  await page.getByRole("menuitem", { name: /Logout|ログアウト/ }).click();
  await expect(page.getByRole("dialog", { name: /Logout|ログアウト/ })).toBeVisible();
  await page.getByRole("button", { name: /Invalidate session and logout/ }).click();

  await expect(page.getByRole("heading", { name: "Welcome to Skyblur" })).toBeVisible();
});

test("header account menu can logout from home without leaving the page", async ({
  page,
  context,
  baseURL,
}) => {
  await useLoggedInOAuthMock(page, context, baseURL);

  await gotoAndSkipIfUnavailable(page, "/");
  await expect(page.getByRole("heading", { name: "Welcome to Skyblur" })).toBeVisible();
  await page.getByLabel("Account menu").click();
  await page.getByRole("menuitem", { name: /Logout|ログアウト/ }).click();
  await expect(page.getByRole("dialog", { name: /Logout|ログアウト/ })).toBeVisible();
  await page.getByRole("button", { name: /Logout from this device/ }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Welcome to Skyblur" })).toBeVisible();
});
