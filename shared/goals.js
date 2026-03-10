export function mapApiGoalToUi(goal) {
  return {
    id: String(goal.goal_id),
    type: String(goal.type || "").trim().toLowerCase(),
    name: String(goal.name || ""),
    current: Number(goal.current_value || 0),
    target: Number(goal.target_value || 0),
    trackingStyle: String(goal.tracking_style || "total"),
    progressData:
      goal?.progress_data && typeof goal.progress_data === "object"
        ? goal.progress_data
        : {},
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

export async function fetchAchievements(apiClient) {
  const data = await apiClient.request("/api/goals/achievements", {
    method: "GET",
  });

  return {
    ...data,
    achievements: Array.isArray(data?.achievements) ? data.achievements : [],
  };
}

export async function createGoal(apiClient, payload) {
  const data = await apiClient.request("/api/goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapApiGoalToUi(data);
}

export async function updateGoalProgress(apiClient, goalId, currentValueOrPayload) {
  const payload =
    typeof currentValueOrPayload === "object" && currentValueOrPayload !== null
      ? {
          current_value: Number(currentValueOrPayload.current_value || 0),
          progress_data:
            currentValueOrPayload.progress_data &&
            typeof currentValueOrPayload.progress_data === "object"
              ? currentValueOrPayload.progress_data
              : undefined,
        }
      : { current_value: Number(currentValueOrPayload || 0) };

  const data = await apiClient.request(`/api/goals/${goalId}/progress`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return mapApiGoalToUi(data);
}

export async function deleteGoal(apiClient, goalId) {
  return apiClient.request(`/api/goals/${goalId}`, {
    method: "DELETE",
  });
}
