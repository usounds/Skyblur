function normalizeHost(host: string) {
  return host.trim().toLowerCase();
}

function isLocalHost(host: string) {
  return /^localhost(?::\d+)?$/.test(host) || /^127\.0\.0\.1(?::\d+)?$/.test(host);
}

function isSkyblurHost(host: string) {
  return host === "skyblur.uk" || host.endsWith(".skyblur.uk");
}

function normalizeConfiguredOrigin(value: string) {
  const url = new URL(value);
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_BASE_URL must be an origin without path, query, or hash");
  }
  return url.origin;
}

function getConfiguredOrigin() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  return baseUrl ? normalizeConfiguredOrigin(baseUrl) : null;
}

function getRequestHostFromHeaders(request: Request) {
  const url = new URL(request.url);
  return normalizeHost(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      url.host,
  );
}

function getRequestHost(request: Request) {
  const host = getRequestHostFromHeaders(request);
  if (isLocalHost(host)) {
    return host;
  }

  throw new Error("NEXT_PUBLIC_BASE_URL is required outside localhost");
}

export function getRequestOrigin(request: Request) {
  const configuredOrigin = getConfiguredOrigin();
  const actualHost = getRequestHostFromHeaders(request);
  const actualProto = new URL(request.url).protocol.replace(":", "") || "http";

  if (configuredOrigin) {
    const configuredHost = normalizeHost(new URL(configuredOrigin).host);
    if (configuredHost === actualHost || !isSkyblurHost(actualHost)) {
      return configuredOrigin;
    }
    return `${actualProto}://${actualHost}`;
  }

  const host = getRequestHost(request);

  return `${actualProto}://${host}`;
}

export function getAppOriginFromRequest(request: Request) {
  return getRequestOrigin(request);
}

export function getCookieDomain(request: Request) {
  const configuredOrigin = getConfiguredOrigin();
  const actualHost = getRequestHostFromHeaders(request);
  const host = configuredOrigin && !isSkyblurHost(actualHost)
    ? new URL(configuredOrigin).host
    : isSkyblurHost(actualHost)
      ? actualHost
      : getRequestHost(request);

  if (isLocalHost(host)) {
    return undefined;
  }

  const parts = host.split(".");
  if (parts.length < 2) return undefined;
  return `.${parts.slice(-2).join(".")}`;
}
