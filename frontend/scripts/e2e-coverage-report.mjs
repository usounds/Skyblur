import fs from "node:fs";
import path from "node:path";

import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";

const repoRoot = process.cwd();
const inputDir = path.join(repoRoot, ".nyc_output", "e2e");
const outputDir = path.join(repoRoot, "coverage", "e2e");
const threshold = Number(process.env.E2E_COVERAGE_THRESHOLD || "80");
const branchThreshold = Number(process.env.E2E_BRANCH_COVERAGE_THRESHOLD || "80");
const thresholdMetrics = (
  process.env.E2E_COVERAGE_METRICS || "lines,statements,functions,branches"
)
  .split(",")
  .map((metric) => metric.trim())
  .filter(Boolean);

function listCoverageFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listCoverageFiles(fullPath);
      return entry.name.endsWith(".json") ? [fullPath] : [];
    });
}

const files = listCoverageFiles(inputDir);
if (files.length === 0) {
  console.error("No E2E Istanbul coverage files found in .nyc_output/e2e.");
  process.exit(1);
}

const map = libCoverage.createCoverageMap({});
for (const file of files) {
  map.merge(JSON.parse(fs.readFileSync(file, "utf8")));
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const context = libReport.createContext({
  dir: outputDir,
  coverageMap: map,
});

reports.create("text").execute(context);
reports.create("json-summary").execute(context);
reports.create("html").execute(context);

const summary = map.getCoverageSummary().toJSON();
console.log(
  `E2E code coverage summary: lines ${summary.lines.pct}%, statements ${summary.statements.pct}%, functions ${summary.functions.pct}%, branches ${summary.branches.pct}%`,
);

const failedMetrics = thresholdMetrics.filter((metric) => {
  if (!summary[metric]) {
    console.error(`Unknown E2E coverage metric: ${metric}`);
    process.exit(1);
  }

  const metricThreshold = metric === "branches" ? branchThreshold : threshold;
  return summary[metric].pct < metricThreshold;
});

if (failedMetrics.length > 0) {
  console.error(
    `E2E code coverage is below the configured threshold for: ${failedMetrics
      .map((metric) => {
        const metricThreshold = metric === "branches" ? branchThreshold : threshold;
        return `${metric} ${summary[metric].pct}% < ${metricThreshold}%`;
      })
      .join(", ")}`,
  );
  process.exit(1);
}
