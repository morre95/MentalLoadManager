const FALLBACK_WEB_API_BASE_URL = "http://localhost:8000";

export function getApiBaseUrl(options = {}) {
  const env = options.env || globalThis?.process?.env || {};
  const href =
    options.locationHref ||
    (typeof window !== "undefined" ? window.location?.href || "" : "");

  const fromEnv =
    env.EXPO_PUBLIC_API_BASE_URL ||
    env.VITE_API_BASE_URL ||
    env.VITE_API_URL ||
    env.API_BASE_URL;

  if (fromEnv) {
    return String(fromEnv).replace(/\/$/, "");
  }

  if (href.includes("frontend-production")) {
    return "https://mentalloadmanager-production.up.railway.app";
  }

  return FALLBACK_WEB_API_BASE_URL;
}
