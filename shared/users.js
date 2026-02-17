export async function fetchMe(apiClient) {
  return apiClient.request("/api/users/me", { method: "GET" });
}
