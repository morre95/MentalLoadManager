export type ApiClient = {
  request: (path: string, requestOptions?: RequestInit) => Promise<any>;
};

export function getApiBaseUrl(options?: {
  env?: Record<string, string | undefined>;
  locationHref?: string;
}): string;

export function createApiClient(options?: {
  getAccessToken?: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
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

export function normalizeHousehold(household: any): Household;
export function flattenHouseholdMembers(households: Household[]): Array<
  HouseholdMember & {
    household_id: string | number;
    household_name: string;
  }
>;

export function fetchHouseholds(apiClient: ApiClient): Promise<{ households: Household[] }>;
export function createHousehold(apiClient: ApiClient, name: string): Promise<any>;
export function createHouseholdInvite(apiClient: ApiClient, householdId: string | number): Promise<any>;
export function acceptHouseholdInvite(apiClient: ApiClient, code: string): Promise<any>;
export function removeHouseholdMember(
  apiClient: ApiClient,
  householdId: string | number,
  userId: string | number
): Promise<any>;
export function leaveHousehold(apiClient: ApiClient, householdId: string | number): Promise<any>;
export function updateHouseholdMemberRole(
  apiClient: ApiClient,
  householdId: string | number,
  userId: string | number,
  role: "admin" | "member" | string
): Promise<any>;

export function fetchMe(apiClient: ApiClient): Promise<any>;
