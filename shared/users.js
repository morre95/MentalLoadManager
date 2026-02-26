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
