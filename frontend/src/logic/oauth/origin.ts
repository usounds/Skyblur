function normalizeHost(host: string) {
  return host.trim().toLowerCase();
}

function isLocalHost(host: string) {
  return /^localhost(?::\d+)?$/.test(host) || /^127\.0\.0\.1(?::\d+)?$/.test(host);
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

function getRequestHost(request: Request) {
  const url = new URL(request.url);
  const host = normalizeHost(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      url.host,
  );

  if (isLocalHost(host)) {
    return host;
  }

  throw new Error("NEXT_PUBLIC_BASE_URL is required outside localhost");
}

export function getRequestOrigin(request: Request) {
  const configuredOrigin = getConfiguredOrigin();
  if (configuredOrigin) return configuredOrigin;

  const url = new URL(request.url);
  const host = getRequestHost(request);

  const proto = url.protocol.replace(":", "") || "http";

  return `${proto}://${host}`;
}

export function getAppOriginFromRequest(request: Request) {
  return getRequestOrigin(request);
}

export function getCookieDomain(request: Request) {
  const configuredOrigin = getConfiguredOrigin();
  const host = configuredOrigin
    ? new URL(configuredOrigin).host
    : getRequestHost(request);

  if (isLocalHost(host)) {
    return undefined;
  }

  const parts = host.split(".");
  if (parts.length < 2) return undefined;
  return `.${parts.slice(-2).join(".")}`;
}
