import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  getUserFromLocalStorage,
  saveUserToLocalStorage,
  setAuthTokens,
} from "./auth";
import {
  acceptHouseholdInvite as sharedAcceptHouseholdInvite,
  createKanbanTask as sharedCreateKanbanTask,
  createHouseholdCategory as sharedCreateHouseholdCategory,
  changeMyPassword as sharedChangeMyPassword,
  fetchNotificationSettings as sharedFetchNotificationSettings,
  createApiClient,
  deleteKanbanTask as sharedDeleteKanbanTask,
  deleteHouseholdCategory as sharedDeleteHouseholdCategory,
  fetchHouseholds as sharedFetchHouseholds,
  fetchHouseholdCategories as sharedFetchHouseholdCategories,
  fetchKanbanAssignees as sharedFetchKanbanAssignees,
  fetchKanbanTasks as sharedFetchKanbanTasks,
  fetchMe as sharedFetchMe,
  getApiBaseUrl,
  updateNotificationSettings as sharedUpdateNotificationSettings,
  updateMe as sharedUpdateMe,
  updateKanbanTaskDescription as sharedUpdateKanbanTaskDescription,
  updateKanbanTaskAssignee as sharedUpdateKanbanTaskAssignee,
  updateKanbanTaskCategory as sharedUpdateKanbanTaskCategory,
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

function getHouseholdIdFromStoredValue(value) {
  const householdId = value?.household_id ?? value?.id ?? value;
  return householdId ? String(householdId) : null;
}


export const apiClient = createApiClient({
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
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

export async function updateMe(payload) {
  const data = await sharedUpdateMe(apiClient, payload);
  if (data?.username) {
    saveUserToLocalStorage(data);
  }
  return data;
}

export async function changeMyPassword(payload) {
  return sharedChangeMyPassword(apiClient, payload);
}

export async function fetchKanbanTasks(householdId) {
  return sharedFetchKanbanTasks(apiClient, householdId);
}

export async function fetchKanbanAssignees(householdId) {
  return sharedFetchKanbanAssignees(apiClient, householdId);
}

export async function fetchHouseholdCategories(householdId) {
  return sharedFetchHouseholdCategories(apiClient, householdId);
}

export async function createHouseholdCategory(householdId, name) {
  return sharedCreateHouseholdCategory(apiClient, householdId, name);
}

export async function deleteHouseholdCategory(householdId, categoryId) {
  return sharedDeleteHouseholdCategory(apiClient, householdId, categoryId);
}

export async function resolveCurrentHouseholdId() {
  if (typeof window === "undefined") return null;

  try {
    const selectedHouseholdRaw = localStorage.getItem("household");
    if (selectedHouseholdRaw) {
      const selectedHousehold = JSON.parse(selectedHouseholdRaw);
      const selectedHouseholdId = getHouseholdIdFromStoredValue(selectedHousehold);
      if (selectedHouseholdId) return selectedHouseholdId;
    }
  } catch {
    // Ignore malformed local storage and fallback to households list.
  }

  try {
    const householdsRaw = localStorage.getItem("households");
    const households = householdsRaw ? JSON.parse(householdsRaw) : [];
    const firstHouseholdId = getHouseholdIdFromStoredValue(households?.[0]);
    if (firstHouseholdId) return firstHouseholdId;
  } catch {
    // Ignore malformed local storage and fallback to API.
  }

  try {
    const data = await sharedFetchHouseholds(apiClient);
    const households = Array.isArray(data?.households) ? data.households : [];
    const firstHousehold = households[0] ?? null;
    const firstHouseholdId = getHouseholdIdFromStoredValue(firstHousehold);
    if (!firstHouseholdId) return null;

    localStorage.setItem("households", JSON.stringify(households));
    localStorage.setItem("household", JSON.stringify(firstHousehold));
    return firstHouseholdId;
  } catch {
    return null;
  }
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

export async function updateKanbanTaskAssignee(taskId, assigneeId) {
  return sharedUpdateKanbanTaskAssignee(apiClient, taskId, assigneeId);
}

export async function updateKanbanTaskCategory(taskId, categoryName) {
  return sharedUpdateKanbanTaskCategory(apiClient, taskId, categoryName);
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

export async function fetchNotificationSettings() {
  return sharedFetchNotificationSettings(apiClient);
}

export async function updateNotificationSettings(payload) {
  return sharedUpdateNotificationSettings(apiClient, payload);
}
