import { getApiBaseUrl } from "./env.js";

export function createApiClient(options = {}) {
  const getToken = options.getAccessToken || (() => null);
  const onUnauthorized = options.onUnauthorized || (() => {});

  async function request(path, requestOptions = {}) {
    const token = await getToken();
    const headers = new Headers(requestOptions.headers || {});

    if (!headers.has("Content-Type") && !(requestOptions.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const baseUrl = getApiBaseUrl(options.envOptions);
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

    const response = await fetch(url, {
      ...requestOptions,
      headers,
    });

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

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
