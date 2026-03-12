export type ApiClient = {
  request: (path: string, requestOptions?: RequestInit) => Promise<any>;
};

export function getApiBaseUrl(options?: {
  env?: Record<string, string | undefined>;
  locationHref?: string;
}): string;

export function createApiClient(options?: {
  getAccessToken?: () => string | null | Promise<string | null>;
  getRefreshToken?: () => string | null | Promise<string | null>;
  shouldRefresh?: () => boolean | Promise<boolean>;
  setAuthTokens?: (tokens: {
    accessToken?: string | null;
    refreshToken?: string | null;
  }) => void | Promise<void>;
  onUnauthorized?: () => void;
  refreshPath?: string;
  envOptions?: {
    env?: Record<string, string | undefined>;
    locationHref?: string;
  };
}): ApiClient;

export type UiTask = {
  id: string;
  householdId?: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "on-hold" | "done" | string;
  priority: "low" | "medium" | "high" | string;
  assigneeId?: string;
  assigneeLabel: string;
  dueDate?: string;
  category: string;
};

export type HouseholdCategory = {
  category_id: string;
  name: string;
};

export function mapApiTaskToUi(task: any): UiTask;
export function toApiTaskStatus(status: string): string;
export function createKanbanTask(
  apiClient: ApiClient,
  payload: {
    household_id: string;
    name: string;
    status?: string;
    description?: string | null;
    priority?: string | null;
    due_date?: string | null;
    category_id?: string | null;
    assigns_to?: string | null;
  }
): Promise<any>;
export function deleteKanbanTask(
  apiClient: ApiClient,
  taskId: string
): Promise<any>;
export function fetchKanbanTasks(
  apiClient: ApiClient,
  householdId?: string | null
): Promise<{ tasks: UiTask[] }>;
export function fetchKanbanAssignees(
  apiClient: ApiClient,
  householdId: string | number
): Promise<{
  assignees: Array<{
    user_id: string;
    username: string;
    display_name: string | null;
  }>;
}>;
export function fetchHouseholdCategories(
  apiClient: ApiClient,
  householdId: string | number
): Promise<{
  categories: HouseholdCategory[];
}>;
export function createHouseholdCategory(
  apiClient: ApiClient,
  householdId: string | number,
  name: string
): Promise<HouseholdCategory>;
export function deleteHouseholdCategory(
  apiClient: ApiClient,
  householdId: string | number,
  categoryId: string | number
): Promise<{
  category_id: string;
  deleted: boolean;
}>;
export function updateKanbanTaskStatus(
  apiClient: ApiClient,
  taskId: string,
  status: string
): Promise<any>;
export function updateKanbanTaskOrder(
  apiClient: ApiClient,
  status: string,
  orderedTaskIds: string[]
): Promise<any>;
export function updateKanbanTaskPriority(
  apiClient: ApiClient,
  taskId: string,
  priority: string
): Promise<any>;
export function updateKanbanTaskDueDate(
  apiClient: ApiClient,
  taskId: string,
  dueDate: string | null
): Promise<any>;
export function updateKanbanTaskDescription(
  apiClient: ApiClient,
  taskId: string,
  description: string | null
): Promise<any>;
export function updateKanbanTaskAssignee(
  apiClient: ApiClient,
  taskId: string,
  assigneeId: string | null
): Promise<any>;
export function updateKanbanTaskCategory(
  apiClient: ApiClient,
  taskId: string,
  categoryName: string | null
): Promise<any>;
export function updateKanbanTaskName(
  apiClient: ApiClient,
  taskId: string,
  name: string
): Promise<any>;

export type UiGoal = {
  id: string;
  type: string;
  name: string;
  current: number;
  target: number;
  trackingStyle: "daily" | "weekly" | "total" | string;
  createdAt: Date | null;
};

export function mapApiGoalToUi(goal: any): UiGoal;
export function fetchGoals(apiClient: ApiClient): Promise<{ goals: UiGoal[] }>;
export function fetchAchievements(apiClient: ApiClient): Promise<{
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    current: number;
    target: number;
    category: string;
  }>;
}>;
export function createGoal(
  apiClient: ApiClient,
  payload: {
    type: string;
    name: string;
    target_value: number;
    tracking_style: string;
    current_value?: number;
  }
): Promise<UiGoal>;
export function updateGoalProgress(
  apiClient: ApiClient,
  goalId: string,
  currentValue: number
): Promise<UiGoal>;
export function deleteGoal(
  apiClient: ApiClient,
  goalId: string
): Promise<{ goal_id: string; deleted: boolean }>;

export type HouseholdMember = {
  user_id: string | number;
  username: string;
  email: string | null;
  display_name: string | null;
  role: "owner" | "admin" | "member" | string;
};

export type Household = {
  household_id: string | number;
  name: string;
  members: HouseholdMember[];
};

export type AnalyticsRiskItem = {
  title: string;
  severity: "low" | "medium" | "high";
  reason: string;
};

export type AnalyticsRecommendationItem = {
  title: string;
  action: string;
  priority: "low" | "medium" | "high";
};

export type AnalyticsAIInsights = {
  household_id: string | null;
  timeframe: "7d" | "30d" | "12w" | string;
  generated_at: string | null;
  summary: string;
  risks: AnalyticsRiskItem[];
  recommendations: AnalyticsRecommendationItem[];
  evidence: string[];
  confidence: "low" | "medium" | "high" | string;
  cached: boolean;
  model: string | null;
};

export type AnalyticsAskResponse = {
  household_id: string | null;
  timeframe: "7d" | "30d" | "12w" | string;
  question: string;
  answer: string;
  evidence: string[];
  suggested_followups: string[];
  cached: boolean;
  model: string | null;
  generated_at: string | null;
};

export function normalizeHousehold(household: any): Household;
export function flattenHouseholdMembers(households: Household[]): Array<
  HouseholdMember & {
    household_id: string | number;
    household_name: string;
  }
>;

export function fetchHouseholds(apiClient: ApiClient): Promise<{ households: Household[] }>;
export function normalizeAnalyticsSummary(data: any): any;
export function normalizeAnalyticsAIInsights(data: any): AnalyticsAIInsights;
export function normalizeAnalyticsAskResponse(data: any): AnalyticsAskResponse;
export function fetchAnalyticsSummary(
  apiClient: ApiClient,
  householdId?: string | null,
  timeframe?: "7d" | "30d" | "12w" | string
): Promise<any>;
export function fetchAnalyticsAIInsights(
  apiClient: ApiClient,
  options?: {
    householdId?: string | null;
    timeframe?: "7d" | "30d" | "12w" | string;
    refresh?: boolean;
  }
): Promise<AnalyticsAIInsights>;
export function askAnalyticsQuestion(
  apiClient: ApiClient,
  options?: {
    householdId?: string | null;
    timeframe?: "7d" | "30d" | "12w" | string;
    question?: string;
    refresh?: boolean;
  }
): Promise<AnalyticsAskResponse>;
export function createHousehold(apiClient: ApiClient, name: string): Promise<any>;
export function createHouseholdInvite(apiClient: ApiClient, householdId: string | number): Promise<any>;
export function acceptHouseholdInvite(apiClient: ApiClient, code: string): Promise<any>;
export function removeHouseholdMember(
  apiClient: ApiClient,
  householdId: string | number,
  userId: string | number
): Promise<any>;
export function leaveHousehold(apiClient: ApiClient, householdId: string | number): Promise<any>;
export function transferHouseholdOwnership(
  apiClient: ApiClient,
  householdId: string | number,
  newOwnerUserId: string | number
): Promise<any>;
export function updateHouseholdMemberRole(
  apiClient: ApiClient,
  householdId: string | number,
  userId: string | number,
  role: "admin" | "member" | string
): Promise<any>;

export function fetchMe(apiClient: ApiClient): Promise<any>;
export function updateMe(apiClient: ApiClient, payload: {
  email?: string | null;
  display_name?: string | null;
}): Promise<any>;
export function changeMyPassword(apiClient: ApiClient, payload: {
  current_password: string;
  new_password: string;
}): Promise<any>;
export function fetchNotificationSettings(apiClient: ApiClient): Promise<{
  email_notifications: boolean;
  task_reminders: boolean;
  goal_milestones: boolean;
  household_updates: boolean;
  weekly_analytics_email: boolean;
}>;
export function updateNotificationSettings(apiClient: ApiClient, payload: {
  email_notifications: boolean;
  task_reminders: boolean;
  goal_milestones: boolean;
  household_updates: boolean;
  weekly_analytics_email: boolean;
}): Promise<{
  email_notifications: boolean;
  task_reminders: boolean;
  goal_milestones: boolean;
  household_updates: boolean;
  weekly_analytics_email: boolean;
}>;
export function fetchPreferences(apiClient: ApiClient): Promise<{
  date_format: "mdy" | "dmy" | "ymd";
  first_day_of_week: "sunday" | "monday" | "saturday";
}>;
export function updatePreferences(apiClient: ApiClient, payload: {
  date_format: "mdy" | "dmy" | "ymd";
  first_day_of_week: "sunday" | "monday" | "saturday";
}): Promise<{
  date_format: "mdy" | "dmy" | "ymd";
  first_day_of_week: "sunday" | "monday" | "saturday";
}>;
