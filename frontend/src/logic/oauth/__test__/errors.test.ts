import { describe, expect, it } from "vitest";

import { isInvalidGrantInvalidCodeError } from "../errors";

describe("OAuth error helpers", () => {
  it("detects token exchange invalid-code failures", () => {
    expect(isInvalidGrantInvalidCodeError({
      error: "invalid_grant",
      errorDescription: "Invalid code",
    })).toBe(true);

    expect(isInvalidGrantInvalidCodeError({
      error: "invalid_grant",
      message: "Invalid code",
    })).toBe(true);
  });

  it("rejects unrelated OAuth failures", () => {
    expect(isInvalidGrantInvalidCodeError({
      error: "invalid_grant",
      errorDescription: "Expired state",
    })).toBe(false);
    expect(isInvalidGrantInvalidCodeError(new Error("Invalid code"))).toBe(false);
    expect(isInvalidGrantInvalidCodeError(null)).toBe(false);
  });
});
