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
  localStorage.removeItem("households");
  localStorage.removeItem("household");
  localStorage.removeItem("display_name");
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
    display_name: localStorage.getItem("display_name"),
  };
}

export function saveUserToLocalStorage(user) {
  if (!user) return;
  if (user.username) localStorage.setItem("username", user.username);
  if (user.email) localStorage.setItem("email", user.email);
  if (user.display_name)
    localStorage.setItem("display_name", user.display_name);
}

/** Fetch current user */
export const fetchMe = async () => {
  const token = getAccessToken();
  if (!token) return null;

  const cached = getUserFromLocalStorage();
  if (cached?.username && cached?.email && cached?.display_name) return cached;

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

<<<<<<< HEAD
export function capitalizeWords(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
export function normalizeNameFromUsername(username) {
  return String(username || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function getDisplayName(user) {
  const dn = user.display_name;
  if (dn) return capitalizeWords(String(dn).replace(/[_-]+/g, " "));
  return normalizeNameFromUsername(user?.username);
}

export function getInitials(nameOrUsername) {
  const parts = String(nameOrUsername || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
=======
export async function updateKanbanTaskOrder(status, orderedTaskIds) {
  return apiFetch("/api/kanban/tasks/reorder", {
    method: "PATCH",
    body: JSON.stringify({
      status,
      ordered_task_ids: orderedTaskIds,
    }),
  });
>>>>>>> 43e3d24 (feat: add task reordering functionality)
}
