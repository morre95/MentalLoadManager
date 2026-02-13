const ACCESS_TOKEN_KEY = "access_token";

export function getToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setToken(token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    window.dispatchEvent(new Event("auth:changed"));
}

export function clearToken() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.dispatchEvent(new Event("auth:changed"));
}

export function readTokenFromHashAndCleanUrl() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return null;

    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    if (!token) return null;

    // clean URL (remove #access_token=...)
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return token;
}
