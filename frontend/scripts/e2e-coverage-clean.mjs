import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

for (const relativePath of [".nyc_output/e2e", "coverage/e2e"]) {
  fs.rmSync(path.join(repoRoot, relativePath), { recursive: true, force: true });
}
