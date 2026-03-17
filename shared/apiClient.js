import { getApiBaseUrl } from "./env.js";

const refreshPromisesByKey = new Map();
const OFFLINE_QUEUE_STORAGE_KEY = "api-client-offline-queue-v1";
const NETWORK_RETRY_DELAYS_MS = [500, 1000, 2000];
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function canUseWindow() {
  return typeof window !== "undefined";
}

function loadPersistedQueue() {
  if (!canUseWindow()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistQueue(queue) {
  if (!canUseWindow()) {
    return;
  }

  try {
    window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore localStorage failures and keep the in-memory queue.
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMutationRequest(method) {
  return MUTATION_METHODS.has(String(method || "GET").toUpperCase());
}

function isNetworkFailureError(error) {
  return Boolean(error?.isNetworkFailure);
}

function createNetworkFailureError(message, extra = {}) {
  const error = new Error(message);
  error.name = "NetworkError";
  error.isNetworkFailure = true;
  Object.assign(error, extra);
  return error;
}

export function createApiClient(options = {}) {
  const getToken = options.getAccessToken || (() => null);
  const getRefreshToken = options.getRefreshToken || (() => null);
  const setAuthTokens = options.setAuthTokens || (() => {});
  const onUnauthorized = options.onUnauthorized || (() => {});
  const shouldRefresh = options.shouldRefresh || (() => true);
  const onNetworkError = options.onNetworkError || (() => {});
  const onOfflineQueue = options.onOfflineQueue || (() => {});
  const refreshPath = options.refreshPath || "/api/v1/password/refresh";
  const refreshPathAlternatives = new Set([
    refreshPath,
    "/api/v1/password/refresh",
    "/api/v1/token/refresh",
  ]);

  const statusListeners = new Set();
  const offlineQueue = loadPersistedQueue();
  let currentStatus = {
    online: canUseWindow() ? window.navigator.onLine !== false : true,
    queueSize: offlineQueue.length,
    isSyncing: false,
  };
  let flushPromise = null;

  function emitStatus(partialStatus = {}) {
    currentStatus = {
      ...currentStatus,
      ...partialStatus,
    };
    for (const listener of statusListeners) {
      listener(currentStatus);
    }
  }

  function getNetworkStatus() {
    return currentStatus;
  }

  function subscribeNetworkStatus(listener) {
    statusListeners.add(listener);
    return () => {
      statusListeners.delete(listener);
    };
  }

  function queueRequest(path, requestOptions) {
    if (!isMutationRequest(requestOptions.method)) {
      return false;
    }
    if (requestOptions.body instanceof FormData) {
      return false;
    }

    const headers = Object.fromEntries(
      new Headers(requestOptions.headers || {}).entries()
    );
    const queuedEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      path,
      requestOptions: {
        method: requestOptions.method || "GET",
        headers,
        body:
          typeof requestOptions.body === "string" || requestOptions.body == null
            ? requestOptions.body ?? null
            : String(requestOptions.body),
        credentials: requestOptions.credentials || "include",
      },
      queuedAt: new Date().toISOString(),
    };

    offlineQueue.push(queuedEntry);
    persistQueue(offlineQueue);
    emitStatus({ queueSize: offlineQueue.length });
    onOfflineQueue(queuedEntry);
    return true;
  }

  async function parseResponseBody(response) {
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);
  }

  async function fetchWithRetry(
    url,
    fetchOptions,
    retryDelaysMs = NETWORK_RETRY_DELAYS_MS,
    retryOptions = {}
  ) {
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        const response = await fetch(url, fetchOptions);
        emitStatus({ online: true });
        return response;
      } catch (error) {
        if (!(error instanceof TypeError)) {
          throw error;
        }

        emitStatus({ online: false });
        if (attempt === retryDelaysMs.length) {
          const networkError = createNetworkFailureError(
            "Connection lost. Changes not saved.",
            { cause: error }
          );
          if (!retryOptions.suppressNetworkError) {
            onNetworkError(networkError);
          }
          throw networkError;
        }

        await delay(retryDelaysMs[attempt]);
      }
    }

    throw createNetworkFailureError("Connection lost. Changes not saved.");
  }

  async function refreshAccessToken(baseUrl) {
    const refreshKey = `${baseUrl}::${refreshPath}`;
    const inFlight = refreshPromisesByKey.get(refreshKey);
    if (inFlight) {
      return inFlight;
    }

    const refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      const refreshRequestOptions = {
        method: "POST",
        credentials: "include",
      };

      if (refreshToken) {
        refreshRequestOptions.headers = { "Content-Type": "application/json" };
        refreshRequestOptions.body = JSON.stringify({ refresh_token: refreshToken });
      }

      const response = await fetchWithRetry(
        `${baseUrl}${refreshPath}`,
        refreshRequestOptions,
        NETWORK_RETRY_DELAYS_MS,
        { suppressNetworkError: false }
      );

      const body = await parseResponseBody(response);
      if (!response.ok) {
        const error = new Error(body?.detail || body?.message || "Token refresh failed");
        error.status = response.status;
        error.data = body;
        throw error;
      }

      if (body?.access_token || body?.refresh_token) {
        await setAuthTokens({
          accessToken: body.access_token,
          refreshToken: body.refresh_token,
        });
      }

      return body?.access_token || null;
    })().finally(() => {
      refreshPromisesByKey.delete(refreshKey);
    });

    refreshPromisesByKey.set(refreshKey, refreshPromise);
    return refreshPromise;
  }

  async function request(path, requestOptions = {}) {
    const { __offlineMeta = {}, ...publicRequestOptions } = requestOptions;
    const baseUrl = getApiBaseUrl(options.envOptions);
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const isRefreshRequest = Array.from(refreshPathAlternatives).some((candidate) =>
      path === candidate || url.endsWith(candidate)
    );

    async function send(accessTokenOverride = null) {
      const token = accessTokenOverride || (await getToken());
      const headers = new Headers(publicRequestOptions.headers || {});

      if (!headers.has("Content-Type") && !(publicRequestOptions.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetchWithRetry(
        url,
        {
          ...publicRequestOptions,
          headers,
          credentials: publicRequestOptions.credentials || "include",
        },
        __offlineMeta.retryDelaysMs || NETWORK_RETRY_DELAYS_MS,
        { suppressNetworkError: Boolean(__offlineMeta.suppressNetworkError) }
      );
      const body = await parseResponseBody(response);
      return { response, body };
    }

    let response;
    let body;

    try {
      ({ response, body } = await send());
    } catch (error) {
      if (
        isNetworkFailureError(error) &&
        !isRefreshRequest &&
        !__offlineMeta.skipQueueOnFailure &&
        queueRequest(path, publicRequestOptions)
      ) {
        error.queued = true;
      }
      throw error;
    }

    if (response.status === 401 && !isRefreshRequest) {
      const canRefresh = await shouldRefresh();
      if (!canRefresh) {
        onUnauthorized();
        const error = new Error(body?.detail || body?.message || "Request failed");
        error.status = response.status;
        error.data = body;
        throw error;
      }

      let refreshedAccessToken;
      try {
        refreshedAccessToken = await refreshAccessToken(baseUrl);
      } catch (err) {
        if (
          isNetworkFailureError(err) &&
          !__offlineMeta.skipQueueOnFailure &&
          queueRequest(path, publicRequestOptions)
        ) {
          err.queued = true;
        } else if (!isNetworkFailureError(err)) {
          onUnauthorized();
        }
        throw err;
      }

      try {
        ({ response, body } = await send(refreshedAccessToken));
      } catch (error) {
        if (
          isNetworkFailureError(error) &&
          !__offlineMeta.skipQueueOnFailure &&
          queueRequest(path, publicRequestOptions)
        ) {
          error.queued = true;
        }
        throw error;
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

  async function flushQueuedRequests() {
    if (flushPromise) {
      return flushPromise;
    }

    if (!offlineQueue.length) {
      emitStatus({ queueSize: 0 });
      return;
    }

    flushPromise = (async () => {
      emitStatus({ isSyncing: true });
      while (offlineQueue.length > 0) {
        const nextEntry = offlineQueue[0];

        try {
          await request(nextEntry.path, {
            ...nextEntry.requestOptions,
            __offlineMeta: {
              skipQueueOnFailure: true,
              retryDelaysMs: [1000, 2000, 4000],
              suppressNetworkError: true,
            },
          });
          offlineQueue.shift();
          persistQueue(offlineQueue);
          emitStatus({ queueSize: offlineQueue.length, online: true });
        } catch (error) {
          if (isNetworkFailureError(error)) {
            emitStatus({ online: false });
            break;
          }

          offlineQueue.shift();
          persistQueue(offlineQueue);
          emitStatus({ queueSize: offlineQueue.length });
        }
      }
    })().finally(() => {
      emitStatus({ isSyncing: false, queueSize: offlineQueue.length });
      flushPromise = null;
    });

    return flushPromise;
  }

  if (canUseWindow()) {
    window.addEventListener("online", () => {
      emitStatus({ online: true });
      void flushQueuedRequests();
    });
    window.addEventListener("offline", () => {
      emitStatus({ online: false });
    });

    if (offlineQueue.length > 0 && window.navigator.onLine !== false) {
      void flushQueuedRequests();
    }
  }

  return {
    request,
    flushQueuedRequests,
    getNetworkStatus,
    subscribeNetworkStatus,
  };
}
