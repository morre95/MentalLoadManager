// src/lib/utils.js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { GET_API_BASE_URL } from "../components/ui/base_url";

const API_BASE_URL = GET_API_BASE_URL();

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Auth storage helpers */
export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setAuthToken(token) {
  localStorage.setItem("access_token", token);

  // clean up legacy keys if they exist
  localStorage.removeItem("token");
  localStorage.removeItem("auth_token");
}

export function clearAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
  localStorage.removeItem("auth_token");
  localStorage.removeItem("username");
  localStorage.removeItem("email");
  localStorage.removeItem("household_members");
}

export function isUserLoggedIn() {
  return Boolean(getAccessToken());
}

/** User cache helpers */
export function getUserFromLocalStorage() {
  if (typeof window === "undefined") return null;

  return {
    username: localStorage.getItem("username"),
    email: localStorage.getItem("email"),
  };
}

export function saveUserToLocalStorage(user) {
  if (!user) return;
  if (user.username) localStorage.setItem("username", user.username);
  if (user.email) localStorage.setItem("email", user.email);
}

/** Fetch current user */
export const fetchMe = async () => {
  const token = getAccessToken();
  if (!token) return null;

  const cached = getUserFromLocalStorage();
  if (cached?.username && cached?.email) return cached;

  try {
    const url = `${API_BASE_URL}/api/users/me`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const text = await res.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // non-json
    }

    if (!res.ok) {
      // if unauthorized, clear stale auth
      if (res.status === 401) clearAuth();
      throw new Error(data?.detail || "Failed to fetch user");
    }

    if (!data?.username) {
      throw new Error("No username in /api/users/me response");
    }

    saveUserToLocalStorage(data);
    return data;
  } catch (err) {
    console.error("[fetchMe] error:", err);
    return null;
  }
};

/**
 * Generic API fetch helper
 * - adds Authorization header if token exists
 * - parses json/text safely
 * - clears auth on 401
 * - throws a normalized Error with .status and .data
 */
export async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  // Set JSON content-type unless caller is sending FormData
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Attach token if present
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    // ✅ IMPORTANT: wipe stale auth tokens on unauthorized
    if (res.status === 401) {
      clearAuth();
    }

    const err = new Error(body?.detail || body?.message || "Request failed");
    err.status = res.status;
    err.data = body;
    throw err;
  }

  return body;
}

export async function fetchKanbanTasks() {
  return apiFetch("/api/kanban/tasks", { method: "GET" });
}

export async function acceptHouseholdInvite(code) {
  return apiFetch("/api/household/invite/accept", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function updateKanbanTaskStatus(taskId, status) {
  return apiFetch(`/api/kanban/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
