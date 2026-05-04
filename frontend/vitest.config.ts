import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__test__/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/logic/LocaledDatetime.ts",
        "src/logic/oauth/CookieHasher.ts",
        "src/logic/oauth/constants.ts",
        "src/logic/oauth/cookies.ts",
        "src/logic/oauth/metadata.ts",
        "src/logic/oauth/origin.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
