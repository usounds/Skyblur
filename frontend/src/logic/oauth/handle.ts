export function normalizeOAuthHandle(handle: string | null) {
  const normalized = handle?.trim().toLowerCase() ?? "";
  return normalized || null;
}

export function isValidOAuthHandle(handle: string) {
  if (handle.length > 253) return false;
  if (!handle.includes(".")) return false;
  if (handle.startsWith(".") || handle.endsWith(".")) return false;
  if (handle.includes("..")) return false;
  if (!/^[a-z0-9.-]+$/.test(handle)) return false;

  return handle.split(".").every((label) => {
    return (
      label.length > 0 &&
      label.length <= 63 &&
      !label.startsWith("-") &&
      !label.endsWith("-")
    );
  });
}

export function getLikelyOAuthHandleTypo(handle: string) {
  if (handle.endsWith(".bsky.socal")) return "bsky.social";
  return null;
}

export function isHandleResolutionError(error: unknown) {
  let current: unknown = error;

  while (current && typeof current === "object") {
    const err = current as { name?: string; message?: string; cause?: unknown };
    const name = err.name ?? "";
    const message = err.message ?? "";

    if (
      name.includes("ResolverError") ||
      name.includes("ResolutionError") ||
      message.includes("failed to resolve identity") ||
      message.includes("failed to resolve handle")
    ) {
      return true;
    }

    current = err.cause;
  }

  return false;
}
