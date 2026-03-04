import { getApiBaseUrl } from "./env.js";

const refreshPromisesByKey = new Map();

export function createApiClient(options = {}) {
  const getToken = options.getAccessToken || (() => null);
  const getRefreshToken = options.getRefreshToken || (() => null);
  const setAuthTokens = options.setAuthTokens || (() => {});
  const onUnauthorized = options.onUnauthorized || (() => {});
  const refreshPath = options.refreshPath || "/api/password/refresh";
  const refreshPathAlternatives = new Set([
    refreshPath,
    "/api/password/refresh",
    "/api/token/refresh",
  ]);

  async function parseResponseBody(response) {
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);
  }

  async function refreshAccessToken(baseUrl) {
    const refreshKey = `${baseUrl}::${refreshPath}`;
    const inFlight = refreshPromisesByKey.get(refreshKey);
    if (inFlight) {
      return inFlight;
    }

    const refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await fetch(`${baseUrl}${refreshPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const body = await parseResponseBody(response);
      if (!response.ok) {
        const error = new Error(body?.detail || body?.message || "Token refresh failed");
        error.status = response.status;
        error.data = body;
        throw error;
      }

      if (!body?.access_token) {
        throw new Error("Token refresh response missing access token");
      }

      await setAuthTokens({
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
      });

      return body.access_token;
    })().finally(() => {
      refreshPromisesByKey.delete(refreshKey);
    });

    refreshPromisesByKey.set(refreshKey, refreshPromise);
    return refreshPromise;
  }

  async function request(path, requestOptions = {}) {
    const baseUrl = getApiBaseUrl(options.envOptions);
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const isRefreshRequest = Array.from(refreshPathAlternatives).some((candidate) =>
      path === candidate || url.endsWith(candidate)
    );

    async function send(accessTokenOverride = null) {
      const token = accessTokenOverride || (await getToken());
      const headers = new Headers(requestOptions.headers || {});

      if (!headers.has("Content-Type") && !(requestOptions.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(url, {
        ...requestOptions,
        headers,
      });
      const body = await parseResponseBody(response);
      return { response, body };
    }

    let { response, body } = await send();

    if (response.status === 401 && !isRefreshRequest) {
      try {
        const refreshedAccessToken = await refreshAccessToken(baseUrl);
        ({ response, body } = await send(refreshedAccessToken));
      } catch {
        onUnauthorized();
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        onUnauthorized();
      }

      const error = new Error(body?.detail || body?.message || "Request failed");
      error.status = response.status;
      error.data = body;
      throw error;
    }

    return body;
  }

  return {
    request,
  };
}
