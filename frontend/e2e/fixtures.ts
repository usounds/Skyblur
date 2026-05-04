import fs from "node:fs";
import path from "node:path";

import { test as base, expect } from "@playwright/test";

type IstanbulCoverage = Record<string, unknown>;

const coverageEnabled = process.env.E2E_COVERAGE === "true";
const coverageDir = path.join(process.cwd(), ".nyc_output", "e2e");
const sessionRequestBudgetAnnotation = "session-request-budget";

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

function sessionRequestBudget(testInfo: { annotations: { type: string; description?: string }[] }) {
  const annotation = testInfo.annotations.findLast(({ type }) => type === sessionRequestBudgetAnnotation);
  if (!annotation) return 1;
  if (annotation.description === "off") return null;

  const budget = Number(annotation.description);
  return Number.isFinite(budget) ? budget : 1;
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
    let currentSessionRequests = 0;
    let maxSessionRequests = 0;
    const sessionRequestUrls: string[] = [];
    const maxSessionRequestUrls: string[] = [];

    const finishSessionRequestSegment = () => {
      if (currentSessionRequests > maxSessionRequests) {
        maxSessionRequests = currentSessionRequests;
        maxSessionRequestUrls.splice(0, maxSessionRequestUrls.length, ...sessionRequestUrls);
      }
      currentSessionRequests = 0;
      sessionRequestUrls.length = 0;
    };

    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) finishSessionRequestSegment();
    });

    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname !== "/api/oauth/session") return;

      currentSessionRequests += 1;
      sessionRequestUrls.push(`${request.method()} ${url.pathname}${url.search}`);
    });

    await use(page);
    finishSessionRequestSegment();

    const budget = sessionRequestBudget(testInfo);
    if (budget !== null) {
      expect(
        maxSessionRequests,
        [
          `Expected /api/oauth/session to be called at most ${budget} time(s) per page segment.`,
          ...maxSessionRequestUrls.map((url, index) => `  ${index + 1}. ${url}`),
        ].join("\n"),
      ).toBeLessThanOrEqual(budget);
    }

    if (!coverageEnabled) return;

    const coverage = await page.evaluate(() => {
      return (window as unknown as { __coverage__?: IstanbulCoverage }).__coverage__;
    }).catch(() => undefined);
    writeCoverage(testInfo.testId, 9999, coverage);
  },
});

export { expect };
