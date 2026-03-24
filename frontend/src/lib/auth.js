const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const AUTH_STATE_KEY = "is_authenticated";

function dispatchAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:changed"));
  }
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAuthToken(token, refreshToken = null) {
  if (typeof window === "undefined") return;

  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  localStorage.setItem(AUTH_STATE_KEY, "1");

  localStorage.removeItem("token");
  localStorage.removeItem("auth_token");
  dispatchAuthChanged();
}

export function setAuthTokens(tokens) {
  if (typeof window === "undefined") return;

  const accessToken = tokens?.accessToken ?? null;
  const refreshToken = tokens?.refreshToken ?? null;

  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  localStorage.setItem(AUTH_STATE_KEY, "1");

  dispatchAuthChanged();
}

export function clearAuth() {
  if (typeof window === "undefined") return;

  const hadAuthState =
    localStorage.getItem(ACCESS_TOKEN_KEY) != null ||
    localStorage.getItem(REFRESH_TOKEN_KEY) != null ||
    localStorage.getItem("token") != null ||
    localStorage.getItem("auth_token") != null ||
    localStorage.getItem("username") != null ||
    localStorage.getItem("email") != null ||
    localStorage.getItem("household_members") != null ||
    localStorage.getItem("households") != null ||
    localStorage.getItem("household") != null ||
    localStorage.getItem("display_name") != null ||
    localStorage.getItem(AUTH_STATE_KEY) != null;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("token");
  localStorage.removeItem("auth_token");
  localStorage.removeItem("username");
  localStorage.removeItem("email");
  localStorage.removeItem("household_members");
  localStorage.removeItem("households");
  localStorage.removeItem("household");
  localStorage.removeItem("display_name");
  localStorage.removeItem(AUTH_STATE_KEY);

  if (hadAuthState) {
    dispatchAuthChanged();
  }
}

export function isUserLoggedIn() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_STATE_KEY) === "1";
}

export function getUserFromLocalStorage() {
  if (typeof window === "undefined") return null;

  return {
    username: localStorage.getItem("username"),
    email: localStorage.getItem("email"),
    display_name: localStorage.getItem("display_name"),
  };
}

export function saveUserToLocalStorage(user) {
  if (typeof window === "undefined" || !user) return;

  if (user.username != null) {
    localStorage.setItem("username", user.username);
  }

  if (user.email != null && user.email !== "") {
    localStorage.setItem("email", user.email);
  } else {
    localStorage.removeItem("email");
  }

  if (user.display_name != null && user.display_name !== "") {
    localStorage.setItem("display_name", user.display_name);
  } else {
    localStorage.removeItem("display_name");
  }

  localStorage.setItem(AUTH_STATE_KEY, "1");

  window.dispatchEvent(new Event("user:changed"));
}

export function readTokenFromHashAndCleanUrl() {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  if (!token) return null;

  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return token;
}
