import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "@/components/ui/sonner";
import {
  clearAuth,
  isUserLoggedIn,
  getUserFromLocalStorage,
  saveUserToLocalStorage,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "./auth";
import {
  acceptHouseholdInvite as sharedAcceptHouseholdInvite,
  createGoal as sharedCreateGoal,
  createKanbanTask as sharedCreateKanbanTask,
  createHouseholdCategory as sharedCreateHouseholdCategory,
  changeMyPassword as sharedChangeMyPassword,
  fetchPreferences as sharedFetchPreferences,
  fetchNotificationSettings as sharedFetchNotificationSettings,
  fetchTaskReminderSummary as sharedFetchTaskReminderSummary,
  createApiClient,
  deleteGoal as sharedDeleteGoal,
  deleteKanbanTask as sharedDeleteKanbanTask,
  deleteHouseholdCategory as sharedDeleteHouseholdCategory,
  fetchAchievements as sharedFetchAchievements,
  fetchGoalAICheckin as sharedFetchGoalAICheckin,
  fetchGoalsBoardAICheckin as sharedFetchGoalsBoardAICheckin,
  fetchGoals as sharedFetchGoals,
  fetchHouseholds as sharedFetchHouseholds,
  fetchHouseholdCategories as sharedFetchHouseholdCategories,
  fetchKanbanAssignees as sharedFetchKanbanAssignees,
  fetchKanbanTasks as sharedFetchKanbanTasks,
  formatTaskRecurrence as sharedFormatTaskRecurrence,
  fetchMe as sharedFetchMe,
  getApiBaseUrl,
  skipKanbanTaskOccurrence as sharedSkipKanbanTaskOccurrence,
  updateNotificationSettings as sharedUpdateNotificationSettings,
  updateMe as sharedUpdateMe,
  updatePreferences as sharedUpdatePreferences,
  updateGoalProgress as sharedUpdateGoalProgress,
  updateKanbanTaskDescription as sharedUpdateKanbanTaskDescription,
  updateKanbanTaskAssignee as sharedUpdateKanbanTaskAssignee,
  updateKanbanTaskCategory as sharedUpdateKanbanTaskCategory,
  updateKanbanTaskDueDate as sharedUpdateKanbanTaskDueDate,
  updateKanbanTaskName as sharedUpdateKanbanTaskName,
  updateKanbanTaskOrder as sharedUpdateKanbanTaskOrder,
  updateKanbanTaskPriority as sharedUpdateKanbanTaskPriority,
  updateKanbanTaskRecurrence as sharedUpdateKanbanTaskRecurrence,
  updateKanbanTaskStatus as sharedUpdateKanbanTaskStatus,
} from "../../../shared/index.js";

const API_BASE_URL = getApiBaseUrl({
  locationHref: typeof window !== "undefined" ? window.location?.href : "",
});

const GOAL_MILESTONES_UPDATED_EVENT = "goals:changed";
const NETWORK_ERROR_TOAST_ID = "network-connection-lost";

function emitGoalMilestonesUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GOAL_MILESTONES_UPDATED_EVENT));
}

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatTaskRecurrence(frequency, interval) {
  return sharedFormatTaskRecurrence(frequency, interval);
}

export function toUtcDateOnlyIso(dateInputValue) {
  if (!dateInputValue) return null;

  return `${dateInputValue}T00:00:00.000Z`;
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
  shouldRefresh: isUserLoggedIn,
  onNetworkError: () => {
    toast.error("Connection lost. Changes not saved.", {
      id: NETWORK_ERROR_TOAST_ID,
    });
  },
  envOptions: {
    locationHref: typeof window !== "undefined" ? window.location?.href : "",
  },
});

export function getApiClientNetworkStatus() {
  return apiClient.getNetworkStatus();
}

export function subscribeToApiClientNetworkStatus(listener) {
  return apiClient.subscribeNetworkStatus(listener);
}

let fetchMeInFlight = null;
let lastFetchMeAt = 0;
let lastFetchMeResult = null;
const FETCH_ME_CACHE_MS = 5000;

export const fetchMe = async (options = {}) => {
  const { force = false } = options;
  const cached = getUserFromLocalStorage();
  const now = Date.now();

  if (!force) {
    if (!isUserLoggedIn() && !cached?.username) {
      return null;
    }

    if (fetchMeInFlight) {
      return fetchMeInFlight;
    }

    if (lastFetchMeAt && now - lastFetchMeAt < FETCH_ME_CACHE_MS) {
      return lastFetchMeResult;
    }
  }

  fetchMeInFlight = (async () => {
    try {
    const data = await sharedFetchMe(apiClient);
    if (!data?.username) {
      throw new Error("No username in /api/v1/users/me response");
    }

    saveUserToLocalStorage(data);
      lastFetchMeResult = data;
      lastFetchMeAt = Date.now();
      return data;
    } catch (error) {
      if (error?.status === 401) {
        clearAuth();
        lastFetchMeResult = null;
        lastFetchMeAt = Date.now();
        return null;
      }
      console.error("[fetchMe] error:", error);
      const fallback = cached?.username ? cached : null;
      lastFetchMeResult = fallback;
      lastFetchMeAt = Date.now();
      return fallback;
    } finally {
      fetchMeInFlight = null;
    }
  })();

  return fetchMeInFlight;
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

export async function fetchKanbanTasks(householdId, options = {}) {
  return sharedFetchKanbanTasks(apiClient, householdId, options);
}

export async function fetchKanbanAssignees(householdId) {
  return sharedFetchKanbanAssignees(apiClient, householdId);
}

export async function fetchHouseholdCategories(householdId) {
  return sharedFetchHouseholdCategories(apiClient, householdId);
}

export async function fetchHouseholds() {
  return sharedFetchHouseholds(apiClient);
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

export async function fetchGoals() {
  return sharedFetchGoals(apiClient);
}

export async function fetchAchievements() {
  return sharedFetchAchievements(apiClient);
}

export async function fetchGoalAICheckin(goalId, options = {}) {
  return sharedFetchGoalAICheckin(apiClient, goalId, options);
}

export async function fetchGoalsBoardAICheckin(options = {}) {
  return sharedFetchGoalsBoardAICheckin(apiClient, options);
}

export async function fetchMoodTrackerPeriod(periodType, anchorDate) {
  const params = new URLSearchParams({
    period_type: String(periodType || "weekly"),
  });

  if (anchorDate) {
    params.set("anchor_date", String(anchorDate));
  }

  return apiFetch(`/api/v1/mood-tracker?${params.toString()}`, { method: "GET" });
}

export async function upsertMoodTrackerEntry(payload) {
  return apiFetch("/api/v1/mood-tracker/entries", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function createGoal(payload) {
  return sharedCreateGoal(apiClient, payload);
}

export async function updateGoalProgress(goalId, currentValue) {
  return sharedUpdateGoalProgress(apiClient, goalId, currentValue);
}

export async function deleteGoal(goalId) {
  return sharedDeleteGoal(apiClient, goalId);
}

export async function deleteKanbanTask(taskId) {
  return sharedDeleteKanbanTask(apiClient, taskId);
}

export async function acceptHouseholdInvite(code) {
  return sharedAcceptHouseholdInvite(apiClient, code);
}

export async function updateKanbanTaskStatus(taskId, status) {
  const result = await sharedUpdateKanbanTaskStatus(apiClient, taskId, status);
  emitGoalMilestonesUpdated();
  return result;
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

export async function updateKanbanTaskRecurrence(taskId, recurrenceFrequency, recurrenceInterval = 1) {
  return sharedUpdateKanbanTaskRecurrence(
    apiClient,
    taskId,
    recurrenceFrequency,
    recurrenceInterval
  );
}

export async function skipKanbanTaskOccurrence(taskId, occurrenceDate) {
  return sharedSkipKanbanTaskOccurrence(apiClient, taskId, occurrenceDate);
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

export async function fetchTaskReminderSummary() {
  return sharedFetchTaskReminderSummary(apiClient);
}

export async function fetchInviteEmailNotifications() {
  return apiFetch("/api/v1/household/invite/notifications");
}

export async function fetchPreferences() {
  return sharedFetchPreferences(apiClient);
}

export async function updatePreferences(payload) {
  return sharedUpdatePreferences(apiClient, payload);
}
