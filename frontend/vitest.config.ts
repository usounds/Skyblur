import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/__test__/**/*.{test,spec}.{ts,tsx}",
      "src/**/__tests__/**/*.{test,spec}.{ts,tsx}",
    ],
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
        branches: 90,
        statements: 80,
      },
    },
  },
});
