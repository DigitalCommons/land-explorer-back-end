/**
 * Origins allowed to make cross-origin requests to the API and the websocket
 * server. Prefer the explicit CORS_ORIGINS env var (comma-separated); fall back
 * to the local dev front-end origin when running in development so local setups
 * keep working with no extra config.
 *
 * In deployed environments (e.g. Coolify) the front-end is served from its own
 * domain, so set CORS_ORIGINS, e.g.
 *   CORS_ORIGINS=https://dev.cool.landexplorer.coop
 */
export function getCorsOrigins(): string[] {
  return (
    process.env.CORS_ORIGINS ??
    (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "")
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
