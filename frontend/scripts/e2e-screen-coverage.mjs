import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const e2eDir = path.join(repoRoot, "e2e");
const threshold = 80;

const screenScenarios = [
  {
    id: "home landing content",
    evidence: ["page.goto(\"/\")", "Welcome to Skyblur", "Post contents from Skyblur"],
  },
  {
    id: "home start opens login modal",
    evidence: [
      "getByRole(\"button\", { name: \"Start\" }).click()",
      "getByRole(\"dialog\", { name: \"Login\" })",
      "Agree to the contents",
    ],
  },
  {
    id: "terms content",
    evidence: ["goto(\"/termofuse\")", "Privacy Policy & Terms of Service", "Prohibited Actions"],
  },
  {
    id: "not-found screen",
    evidence: ["page.goto(\"/not-a-real-screen\")", "404 - Page Not Found"],
  },
  {
    id: "console unauthenticated login form",
    evidence: ["page.goto(\"/console\")", "Login with atproto account", "Create Account"],
  },
  {
    id: "console login validation errors",
    evidence: [
      "bad_handle",
      "bad handle",
      "bad!handle",
      "alice..bsky.social",
      "Bluesky handles do not contain underscores",
      "Handles cannot contain whitespace",
      "Handles cannot contain consecutive dots.",
    ],
  },
  {
    id: "settings unauthenticated redirect",
    evidence: ["page.goto(\"/settings\")", "toHaveURL(/\\/$/)"],
  },
  {
    id: "console logged-in dashboard",
    evidence: ["useLoggedInOAuthMock(page, context, baseURL)", "Create a post", "Visible E2E"],
  },
  {
    id: "settings logged-in form and save",
    evidence: ["Existing E2E My Page description", "Existing E2E custom feed description", "Updated E2E My Page"],
  },
  {
    id: "logged-in account menu",
    evidence: ["header account menu exposes", "mockHandle", "name: /Settings|設定/", "name: /Logout|ログアウト/"],
  },
];

function listSpecFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listSpecFiles(fullPath);
      return /\.(spec|test)\.tsx?$/.test(entry.name) ? [fullPath] : [];
    });
}

const source = listSpecFiles(e2eDir)
  .map((specFile) => fs.readFileSync(specFile, "utf8"))
  .join("\n");

const covered = screenScenarios.filter((scenario) =>
  scenario.evidence.every((item) => source.includes(item)),
);
const percent = (covered.length / screenScenarios.length) * 100;
const uncovered = screenScenarios.filter((scenario) => !covered.includes(scenario));

console.log(
  `E2E screen coverage: ${percent.toFixed(2)}% (${covered.length}/${screenScenarios.length})`,
);

if (uncovered.length > 0) {
  console.log("Uncovered E2E screen scenarios:");
  for (const scenario of uncovered) {
    console.log(`- ${scenario.id}`);
  }
}

if (percent < threshold) {
  console.error(`E2E screen coverage must be at least ${threshold}%.`);
  process.exit(1);
}
