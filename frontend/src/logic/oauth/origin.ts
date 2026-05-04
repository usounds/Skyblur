export function getRequestOrigin(request: Request) {
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.host;

  let proto = request.headers.get("x-forwarded-proto") || "https";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    proto = url.protocol.replace(":", "") || "http";
  }

  return `${proto}://${host}`;
}

export function getAppOriginFromRequest(request: Request) {
  return getRequestOrigin(request);
}

export function getCookieDomain(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;

  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return undefined;
  }

  const parts = host.split(".");
  if (parts.length < 2) return undefined;
  return `.${parts.slice(-2).join(".")}`;
}
