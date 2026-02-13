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

  const user = getUserFromLocalStorage();
  if (user) return user; 
  try {
    const res = await fetch(`${API_BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to fetch user");
    }

    const user = await res.json();

    // spara username i localStorage
    if (!user.username) {
      throw new Error(err.detail || "No username")
    }
    saveUserToLocalStorage(user)

    // returnera username & email
    return user;
  } catch (err) {
    return null;
  }
};


