import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { GET_API_BASE_URL } from '../components/ui/base_url'

const API_BASE_URL = GET_API_BASE_URL();

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("access_token");
}

export function getUserFromLocalStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  const user = {"username": localStorage.getItem("username"), "email": localStorage.getItem("email"),};
  return user;
}

export function saveUserToLocalStorage(user){
  localStorage.setItem("username", user.username);
  localStorage.setItem("email", user.email)
}

export function isUserLoggedIn() {
  return Boolean(getAccessToken());
}

export const fetchMe = async () => {
  const token = getAccessToken();
  if (!token) return null;

  const cached = getUserFromLocalStorage();

  // Only return cache if it looks valid
  if (cached?.username && cached?.email) {
    return cached;
  }

  try {
    const url = `${API_BASE_URL}/api/users/me`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Read body once (avoids double-read issues)
    const text = await res.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
        console.error("Failed to fetch user");
    }

    if (!res.ok) {
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
