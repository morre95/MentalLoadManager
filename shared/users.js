export async function fetchMe(apiClient) {
  return apiClient.request("/api/users/me", { method: "GET" });
}

export async function updateMe(apiClient, payload) {
  return apiClient.request("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changeMyPassword(apiClient, payload) {
  return apiClient.request("/api/users/me/password", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchNotificationSettings(apiClient) {
  return apiClient.request("/api/settings/notification-settings", {
    method: "GET",
  });
}

export async function updateNotificationSettings(apiClient, payload) {
  return apiClient.request("/api/settings/notification-settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchTaskReminderSummary(apiClient) {
  return apiClient.request("/api/settings/notification-settings/task-reminders/overdue-summary", {
    method: "GET",
  });
}

export async function fetchPreferences(apiClient) {
  return apiClient.request("/api/settings/preferences", {
    method: "GET",
  });
}

export async function updatePreferences(apiClient, payload) {
  return apiClient.request("/api/settings/preferences", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
