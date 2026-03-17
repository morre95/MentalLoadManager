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
    isRecurring: Boolean(goal?.is_recurring),
    periodKey: goal?.period_key ? String(goal.period_key) : null,
    periodStart: goal?.period_start ? new Date(goal.period_start) : null,
    periodEnd: goal?.period_end ? new Date(goal.period_end) : null,
    currentStreak: Number(goal?.current_streak || 0),
    bestStreak: Number(goal?.best_streak || 0),
    completedPeriods: Number(goal?.completed_periods || 0),
    history: Array.isArray(goal?.history)
      ? goal.history.map((item) => ({
          id: String(item?.goal_history_id || ""),
          trackingStyle: String(item?.tracking_style || ""),
          periodKey: String(item?.period_key || ""),
          periodStartedAt: item?.period_started_at ? new Date(item.period_started_at) : null,
          periodEndedAt: item?.period_ended_at ? new Date(item.period_ended_at) : null,
          current: Number(item?.current_value || 0),
          target: Number(item?.target_value || 0),
          completed: Boolean(item?.completed),
          createdAt: item?.created_at ? new Date(item.created_at) : null,
        }))
      : [],
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
    achievements: Array.isArray(data?.achievements)
      ? data.achievements.map((achievement) => ({
          ...achievement,
          completed: Boolean(achievement?.completed),
          current_milestone_complete: Boolean(
            achievement?.current_milestone_complete ?? achievement?.completed
          ),
          has_unlocked_before: Boolean(achievement?.has_unlocked_before),
          entity_id: achievement?.entity_id ? String(achievement.entity_id) : null,
          completion_key: achievement?.completion_key ? String(achievement.completion_key) : null,
          unlocked_at: achievement?.unlocked_at ? String(achievement.unlocked_at) : null,
          last_unlocked_at: achievement?.last_unlocked_at ? String(achievement.last_unlocked_at) : null,
          last_unlocked_label: achievement?.last_unlocked_label
            ? String(achievement.last_unlocked_label)
            : null,
          rarity: String(achievement?.rarity || "common"),
        }))
      : [],
    timeline: Array.isArray(data?.timeline)
      ? data.timeline.map((item) => ({
          ...item,
          achievement_unlock_id: String(item?.achievement_unlock_id || ""),
          achievement_id: String(item?.achievement_id || ""),
          title: String(item?.title || ""),
          category: String(item?.category || ""),
          rarity: String(item?.rarity || "common"),
          entity_id: item?.entity_id ? String(item.entity_id) : null,
          unlocked_at: item?.unlocked_at ? String(item.unlocked_at) : null,
        }))
      : [],
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

export async function fetchGoalAICheckin(apiClient, goalId, options = {}) {
  const data = await apiClient.request(`/api/goals/${goalId}/ai-checkin`, {
    method: "POST",
    body: JSON.stringify({
      refresh: Boolean(options.refresh),
    }),
  });

  return {
    goal_id: String(data?.goal_id || goalId),
    status_summary: String(data?.status_summary || ""),
    pace_needed: String(data?.pace_needed || ""),
    risk_level: String(data?.risk_level || "low"),
    next_step: String(data?.next_step || ""),
    adjustment_suggestion: String(data?.adjustment_suggestion || ""),
    evidence: Array.isArray(data?.evidence) ? data.evidence.map((item) => String(item)) : [],
    cached: Boolean(data?.cached),
    model: data?.model ? String(data.model) : null,
    generated_at: data?.generated_at || null,
  };
}

export async function fetchGoalsBoardAICheckin(apiClient, options = {}) {
  const data = await apiClient.request("/api/goals/ai-checkin", {
    method: "POST",
    body: JSON.stringify({
      refresh: Boolean(options.refresh),
    }),
  });

  return {
    headline: String(data?.headline || ""),
    summary: String(data?.summary || ""),
    priorities: Array.isArray(data?.priorities) ? data.priorities.map((item) => String(item)) : [],
    wins: Array.isArray(data?.wins) ? data.wins.map((item) => String(item)) : [],
    risks: Array.isArray(data?.risks) ? data.risks.map((item) => String(item)) : [],
    model: data?.model ? String(data.model) : null,
    generated_at: data?.generated_at || null,
  };
}
