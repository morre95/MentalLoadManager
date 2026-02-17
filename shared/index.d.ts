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
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "on-hold" | "done" | string;
  priority: "low" | "medium" | "high" | string;
  assignee: string;
  dueDate?: string;
  category: string;
};

export function mapApiTaskToUi(task: any): UiTask;
export function toApiTaskStatus(status: string): string;
export function fetchKanbanTasks(apiClient: ApiClient): Promise<{ tasks: UiTask[] }>;
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

export type HouseholdMember = {
  user_id: string | number;
  username: string;
  email: string | null;
  display_name: string | null;
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

export function fetchMe(apiClient: ApiClient): Promise<any>;
