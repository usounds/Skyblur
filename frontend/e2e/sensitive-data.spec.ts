import { expect, test } from "./fixtures";
import { mockDid, useLoggedInOAuthMock } from "./oauth-mock";

const secondDid = "did:plc:viewer-b";

async function switchViewer(page: import("@playwright/test").Page, did: string) {
  await page.evaluate((nextDid) => {
    (window as unknown as { __skyblurUseXrpcAgentStore: typeof import("../src/state/XrpcAgent").useXrpcAgentStore }).__skyblurUseXrpcAgentStore.setState({ did: nextDid, isSessionChecked: true });
  }, did);
}

for (const variant of ["restricted", "password"] as const) {
  test(`${variant} plaintext is cleared on account switch and logout`, async ({ page, context, baseURL }) => {
    await useLoggedInOAuthMock(page, context, baseURL, { postVariant: variant });
    await page.goto(`/profile/${encodeURIComponent(mockDid)}`);
    const secret = variant === "restricted" ? "Fetched restricted E2E text" : "Decrypted E2E password text";
    if (variant === "restricted") {
      await page.getByText("*****", { exact: true }).click();
    } else {
      const input = page.locator("main input");
      await expect(input).toHaveAttribute("type", "password");
      await input.fill("synthetic-password");
      await page.getByRole("button", { name: "Unlock", exact: true }).click();
    }
    await expect(page.getByText(secret, { exact: true })).toBeVisible();
    await switchViewer(page, secondDid);
    await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
    // Unlock again as the new viewer, then verify logout erases this new plaintext too.
    if (variant === "restricted") await page.getByText("*****", { exact: true }).click();
    else {
      await page.locator("main input").fill("synthetic-password");
      await page.getByRole("button", { name: "Unlock", exact: true }).click();
    }
    await expect(page.getByText(secret, { exact: true })).toBeVisible();
    await page.evaluate(() => (window as unknown as { __skyblurUseXrpcAgentStore: typeof import("../src/state/XrpcAgent").useXrpcAgentStore }).__skyblurUseXrpcAgentStore.getState().logout("soft"));
    await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
    await switchViewer(page, secondDid);
    await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
  });

  test(`${variant} delayed unlock cannot populate the next account`, async ({ page, context, baseURL }) => {
    await useLoggedInOAuthMock(page, context, baseURL, { postVariant: variant });
    const method = variant === "restricted" ? "getPost" : "decryptByCid";
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let started!: () => void;
    const requested = new Promise<void>((resolve) => { started = resolve; });
    await page.route(`**/xrpc/uk.skyblur.post.${method}`, async (route) => {
      started();
      await pending;
      await route.fulfill({ json: { text: "DELAYED_PRIVATE_BODY", additional: "DELAYED_PRIVATE_NOTE" } });
    });
    await page.goto(`/profile/${encodeURIComponent(mockDid)}`);
    if (variant === "restricted") await page.getByText("*****", { exact: true }).click();
    else {
      await page.locator("main input").fill("synthetic-password");
      await page.getByRole("button", { name: "Unlock", exact: true }).click();
    }
    await requested;
    await switchViewer(page, secondDid);
    const completed = page.waitForResponse((response) => response.url().endsWith(`uk.skyblur.post.${method}`));
    release();
    await completed;
    await expect(page.locator("main")).not.toContainText("DELAYED_PRIVATE_BODY");
    await expect(page.locator("main")).not.toContainText("DELAYED_PRIVATE_NOTE");
  });
}

for (const [owner, sensitiveOwner] of [[undefined, undefined], ["did:plc:previous-account", "did:plc:previous-account"], [mockDid, mockDid], [mockDid, "did:plc:previous-account"]]) {
  test(`password draft restoration requires matching ownership: ${owner ?? "unknown"}/${sensitiveOwner ?? "unknown"}`, async ({ page, context, baseURL }) => {
    await useLoggedInOAuthMock(page, context, baseURL);
    await context.addInitScript(({ owner, sensitiveOwner }) => {
      localStorage.setItem("zustand.temptext", JSON.stringify({ version: 0, state: {
        text: "", additional: "", visibility: "password", ownerDid: owner, simpleMode: false, reply: "",
      } }));
      localStorage.setItem("zustand.sensitive-post-draft", JSON.stringify({ version: 0, state: {
        text: "ACCOUNT_A_PRIVATE_DRAFT", additional: "PRIVATE_NOTE", password: "PRIVATE_PASSWORD", ownerDid: sensitiveOwner,
      } }));
    }, { owner, sensitiveOwner });
    await page.goto("/console/posts/new");
    if (owner === mockDid && sensitiveOwner === mockDid) {
      await expect(page.getByText("ACCOUNT_A_PRIVATE_DRAFT", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Restore", exact: true }).click();
      await expect(page.locator("textarea:visible").first()).toHaveValue("ACCOUNT_A_PRIVATE_DRAFT");
    } else {
      await expect(page.locator("textarea:visible").first()).toHaveValue("");
      await expect(page.locator("body")).not.toContainText("ACCOUNT_A_PRIVATE_DRAFT");
      const stored = await page.evaluate(() => localStorage.getItem("zustand.sensitive-post-draft"));
      expect(stored).not.toContain("ACCOUNT_A_PRIVATE_DRAFT");
      expect(stored).not.toContain("PRIVATE_PASSWORD");
    }
  });
}

test("mounted composer resets before another account can edit or persist its draft", async ({ page, context, baseURL }) => {
  test.info().annotations.push({ type: "session-request-budget", description: "2" });
  await useLoggedInOAuthMock(page, context, baseURL);
  await page.goto("/console/posts/new");
  const editor = page.locator("textarea:visible").first();
  await editor.fill("ACCOUNT_A_PRIVATE_DRAFT");
  await page.route("**/api/oauth/session", (route) => route.fulfill({ json: {
    authenticated: true, did: secondDid, pds: "https://pds.example.com", scope: "atproto",
  } }));
  await page.evaluate(async () => {
    const store = (window as unknown as { __skyblurUseXrpcAgentStore: typeof import("../src/state/XrpcAgent").useXrpcAgentStore }).__skyblurUseXrpcAgentStore;
    store.getState().setIsSessionChecked(false);
    await store.getState().checkSession();
  });
  await expect(editor).toHaveValue("");
  await editor.fill("ACCOUNT_B_DRAFT");
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("zustand.temptext")!).state);
  expect(persisted.ownerDid).toBe(secondDid);
  expect(persisted.text).toBe("ACCOUNT_B_DRAFT");
});
