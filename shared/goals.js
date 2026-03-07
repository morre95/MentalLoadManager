export function mapApiGoalToUi(goal) {
  return {
    id: String(goal.goal_id),
    type: String(goal.type || "").trim().toLowerCase(),
    name: String(goal.name || ""),
    current: Number(goal.current_value || 0),
    target: Number(goal.target_value || 0),
    trackingStyle: String(goal.tracking_style || "total"),
    createdAt: goal.created_at ? new Date(goal.created_at) : null,
  };
}

export async function fetchGoals(apiClient) {
  const data = await apiClient.request("/api/goals", { method: "GET" });
  const goals = Array.isArray(data?.goals) ? data.goals : [];

  return {
    ...data,
    goals: goals.map(mapApiGoalToUi),
  };
}

export async function createGoal(apiClient, payload) {
  const data = await apiClient.request("/api/goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapApiGoalToUi(data);
}

export async function updateGoalProgress(apiClient, goalId, currentValue) {
  const data = await apiClient.request(`/api/goals/${goalId}/progress`, {
    method: "PATCH",
    body: JSON.stringify({ current_value: currentValue }),
  });
  return mapApiGoalToUi(data);
}

export async function deleteGoal(apiClient, goalId) {
  return apiClient.request(`/api/goals/${goalId}`, {
    method: "DELETE",
  });
}
