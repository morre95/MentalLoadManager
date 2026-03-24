export async function fetchMe(apiClient) {
  return apiClient.request("/api/v1/users/me", { method: "GET" });
}

export async function updateMe(apiClient, payload) {
  return apiClient.request("/api/v1/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changeMyPassword(apiClient, payload) {
  return apiClient.request("/api/v1/users/me/password", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function setMyPassword(apiClient, payload) {
  return apiClient.request("/api/v1/users/me/set-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchNotificationSettings(apiClient) {
  return apiClient.request("/api/v1/settings/notification-settings", {
    method: "GET",
  });
}

export async function updateNotificationSettings(apiClient, payload) {
  return apiClient.request("/api/v1/settings/notification-settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchTaskReminderSummary(apiClient) {
  return apiClient.request("/api/v1/settings/notification-settings/task-reminders/overdue-summary", {
    method: "GET",
  });
}

export async function fetchPreferences(apiClient) {
  return apiClient.request("/api/v1/settings/preferences", {
    method: "GET",
  });
}

export async function updatePreferences(apiClient, payload) {
  return apiClient.request("/api/v1/settings/preferences", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
