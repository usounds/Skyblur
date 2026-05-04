import fs from "node:fs";
import path from "node:path";

import { test as base, expect } from "@playwright/test";

type IstanbulCoverage = Record<string, unknown>;

const coverageEnabled = process.env.E2E_COVERAGE === "true";
const coverageDir = path.join(process.cwd(), ".nyc_output", "e2e");

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");
}

function writeCoverage(testId: string, index: number, coverage: IstanbulCoverage | undefined) {
  if (!coverage || Object.keys(coverage).length === 0) return;

  fs.mkdirSync(coverageDir, { recursive: true });
  fs.writeFileSync(
    path.join(coverageDir, `${safeName(testId)}-${index}.json`),
    JSON.stringify(coverage),
  );
}

export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    if (!coverageEnabled) {
      await use(context);
      return;
    }

    let coverageIndex = 0;
    await context.addInitScript(() => {
      window.addEventListener("pagehide", () => {
        const coverage = (window as unknown as { __coverage__?: unknown }).__coverage__;
        if (!coverage) return;

        const body = JSON.stringify(coverage);
        navigator.sendBeacon("/__e2e_coverage__", body);
      });
    });

    await context.route("**/__e2e_coverage__", async (route) => {
      const body = route.request().postData();
      if (body) {
        writeCoverage(testInfo.testId, coverageIndex++, JSON.parse(body) as IstanbulCoverage);
      }
      await route.fulfill({ status: 204, body: "" });
    });

    await use(context);
  },
  page: async ({ page }, use, testInfo) => {
    await use(page);

    if (!coverageEnabled) return;

    const coverage = await page.evaluate(() => {
      return (window as unknown as { __coverage__?: IstanbulCoverage }).__coverage__;
    }).catch(() => undefined);
    writeCoverage(testInfo.testId, 9999, coverage);
  },
});

export { expect };
