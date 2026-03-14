export { getApiBaseUrl } from "./env.js";
export { createApiClient } from "./apiClient.js";

export {
  createHouseholdCategory,
  createKanbanTask,
  deleteHouseholdCategory,
  deleteKanbanTask,
  fetchHouseholdCategories,
  fetchKanbanAssignees,
  fetchKanbanTasks,
  mapApiTaskToUi,
  toApiTaskStatus,
  updateKanbanTaskDescription,
  updateKanbanTaskAssignee,
  updateKanbanTaskCategory,
  updateKanbanTaskDueDate,
  updateKanbanTaskName,
  updateKanbanTaskOrder,
  updateKanbanTaskPriority,
  updateKanbanTaskStatus,
} from "./tasks.js";

export {
  acceptHouseholdInvite,
  createHousehold,
  createHouseholdInvite,
  emailHouseholdInvite,
  fetchHouseholds,
  flattenHouseholdMembers,
  leaveHousehold,
  normalizeHousehold,
  removeHouseholdMember,
  transferHouseholdOwnership,
  updateHousehold,
  updateHouseholdMemberRole,
} from "./households.js";

export {
  askAnalyticsQuestion,
  fetchAnalyticsAIInsights,
  fetchAnalyticsSummary,
  normalizeAnalyticsAskResponse,
  normalizeAnalyticsAIInsights,
  normalizeAnalyticsSummary,
} from "./analytics.js";

export { fetchCalendarMonth, fetchCalendarRange} from "./calendar.js";

export {
  createGoal,
  deleteGoal,
  fetchGoalAICheckin,
  fetchAchievements,
  fetchGoals,
  mapApiGoalToUi,
  updateGoalProgress,
} from "./goals.js";

export {
  changeMyPassword,
  fetchPreferences,
  fetchMe,
  fetchNotificationSettings,
  fetchTaskReminderSummary,
  updateMe,
  updatePreferences,
  updateNotificationSettings,
} from "./users.js";
