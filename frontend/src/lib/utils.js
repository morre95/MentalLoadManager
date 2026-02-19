import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  acceptHouseholdInvite as sharedAcceptHouseholdInvite,
  createKanbanTask as sharedCreateKanbanTask,
  createApiClient,
  deleteKanbanTask as sharedDeleteKanbanTask,
  fetchKanbanAssignees as sharedFetchKanbanAssignees,
  fetchKanbanTasks as sharedFetchKanbanTasks,
  fetchMe as sharedFetchMe,
  getApiBaseUrl,
  updateKanbanTaskDescription as sharedUpdateKanbanTaskDescription,
  updateKanbanTaskDueDate as sharedUpdateKanbanTaskDueDate,
  updateKanbanTaskName as sharedUpdateKanbanTaskName,
  updateKanbanTaskOrder as sharedUpdateKanbanTaskOrder,
  updateKanbanTaskPriority as sharedUpdateKanbanTaskPriority,
  updateKanbanTaskStatus as sharedUpdateKanbanTaskStatus,
} from "../../../shared/index.js";

const API_BASE_URL = getApiBaseUrl({
  locationHref: typeof window !== "undefined" ? window.location?.href : "",
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setAuthToken(token) {
  localStorage.setItem("access_token", token);
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
  if (user.display_name) {
    localStorage.setItem("display_name", user.display_name);
  }
}

const apiClient = createApiClient({
  getAccessToken,
  onUnauthorized: clearAuth,
  envOptions: {
    locationHref: typeof window !== "undefined" ? window.location?.href : "",
  },
});

export const fetchMe = async () => {
  const token = getAccessToken();
  if (!token) return null;

  const cached = getUserFromLocalStorage();
  if (cached?.username && cached?.email && cached?.display_name) return cached;

  try {
    const data = await sharedFetchMe(apiClient);
    if (!data?.username) {
      throw new Error("No username in /api/users/me response");
    }

    saveUserToLocalStorage(data);
    return data;
  } catch (error) {
    if (error?.status === 401) {
      clearAuth();
    }
    console.error("[fetchMe] error:", error);
    return null;
  }
};

export async function apiFetch(path, options = {}) {
  return apiClient.request(path, options);
}

export async function fetchKanbanTasks() {
  return sharedFetchKanbanTasks(apiClient);
}

export async function fetchKanbanAssignees(householdId) {
  return sharedFetchKanbanAssignees(apiClient, householdId);
}

export async function createKanbanTask(payload) {
  return sharedCreateKanbanTask(apiClient, payload);
}

export async function deleteKanbanTask(taskId) {
  return sharedDeleteKanbanTask(apiClient, taskId);
}

export async function acceptHouseholdInvite(code) {
  return sharedAcceptHouseholdInvite(apiClient, code);
}

export async function updateKanbanTaskStatus(taskId, status) {
  return sharedUpdateKanbanTaskStatus(apiClient, taskId, status);
}

export async function updateKanbanTaskOrder(status, orderedTaskIds) {
  return sharedUpdateKanbanTaskOrder(apiClient, status, orderedTaskIds);
}

export async function updateKanbanTaskPriority(taskId, priority) {
  return sharedUpdateKanbanTaskPriority(apiClient, taskId, priority);
}

export async function updateKanbanTaskDueDate(taskId, dueDate) {
  return sharedUpdateKanbanTaskDueDate(apiClient, taskId, dueDate);
}

export async function updateKanbanTaskDescription(taskId, description) {
  return sharedUpdateKanbanTaskDescription(apiClient, taskId, description);
}

export async function updateKanbanTaskName(taskId, name) {
  return sharedUpdateKanbanTaskName(apiClient, taskId, name);
}

export function capitalizeWords(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeNameFromUsername(username) {
  return String(username || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getDisplayName(user) {
  const displayName = user.display_name;
  if (displayName) {
    return capitalizeWords(String(displayName).replace(/[_-]+/g, " "));
  }
  return normalizeNameFromUsername(user?.username);
}

export function getDisplayNameFromUsername(username, labels) {
  if (!username) return "Unknown";
  const label = labels?.[username];
  if (label) return capitalizeWords(String(label).replace(/[_-]+/g, " "));
  return normalizeNameFromUsername(username);
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
}

export { API_BASE_URL };
