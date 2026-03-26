function normalizeStatus(value) {
  const normalized = String(value || "todo").toLowerCase();
  if (normalized === "in_progress") return "in-progress";
  if (normalized === "on_hold") return "on-hold";
  return normalized;
}

function normalizePriority(task) {
  const raw =
    task?.priority ??
    task?.priority_level ??
    task?.priority_name ??
    task?.priorityLabel ??
    "medium";

  const value = String(raw).trim().toLowerCase();

  if (["high", "h", "3", "p1", "urgent"].includes(value)) return "high";
  if (["low", "l", "1", "p3"].includes(value)) return "low";
  if (["medium", "med", "m", "2", "p2", "normal"].includes(value))
    return "medium";

  return "medium";
}

function formatDueDate(iso) {
  if (!iso) return undefined;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toLocaleDateString();
}

export function formatTaskRecurrence(frequency, interval = 1) {
  const normalizedFrequency = String(frequency || "").trim().toLowerCase();
  const normalizedInterval = Number(interval) > 0 ? Number(interval) : 1;

  if (!normalizedFrequency) return "";

  if (normalizedInterval === 1) {
    if (normalizedFrequency === "daily") return "Daily";
    if (normalizedFrequency === "weekly") return "Weekly";
    if (normalizedFrequency === "monthly") return "Monthly";
  }

  const unit =
    normalizedFrequency === "daily"
      ? "day"
      : normalizedFrequency === "weekly"
        ? "week"
        : "month";

  return `Every ${normalizedInterval} ${unit}${normalizedInterval === 1 ? "" : "s"}`;
}

function toDateInputValue(iso) {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

export function toApiTaskStatus(status) {
  if (status === "in-progress") return "in_progress";
  if (status === "on-hold") return "on_hold";

  return status;
}

export function mapApiTaskToUi(task) {
  const assigneeLabel = task.assignee_name || "Unassigned";

  return {
    id: String(task.task_id),
    householdId: task.household_id ? String(task.household_id) : undefined,
    title: task.name || "",
    description: task.description || "",
    status: normalizeStatus(task.status),
    priority: normalizePriority(task),
    assigneeId: task.assignee_user_id
      ? String(task.assignee_user_id)
      : undefined,
    assigneeLabel,
    dueDateValue: toDateInputValue(task.due_date),
    dueDate: formatDueDate(task.due_date),
    category: task.category_name || "Other",
    recurrenceEnabled: Boolean(task.recurrence_enabled),
    recurrenceFrequency: task.recurrence_frequency || null,
    recurrenceInterval: task.recurrence_interval || null,
    recurrenceEndDate: task.recurrence_end_date || null,
    recurrenceLabel: task.recurrence_enabled
      ? formatTaskRecurrence(task.recurrence_frequency, task.recurrence_interval)
      : "",
  };
}

export async function fetchKanbanTasks(apiClient, householdId, options = {}) {
  const normalizedHouseholdId = String(householdId || "").trim();
  const params = new URLSearchParams();
  const rawLimit = options?.limit;
  const limit =
    rawLimit == null || rawLimit === ""
      ? 5000
      : Number(rawLimit);
  const offset = Number(options?.offset);

  if (normalizedHouseholdId) {
    params.set("household_id", normalizedHouseholdId);
  }
  if (Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(limit));
  }
  if (Number.isFinite(offset) && offset >= 0) {
    params.set("offset", String(offset));
  }

  const path = params.toString()
    ? `/api/v1/kanban/tasks?${params.toString()}`
    : "/api/v1/kanban/tasks";
  const data = await apiClient.request(path, { method: "GET" });
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];

  return {
    ...data,
    tasks: tasks.map(mapApiTaskToUi),
    total: Number.isFinite(Number(data?.total)) ? Number(data.total) : tasks.length,
    limit: Number.isFinite(Number(data?.limit)) ? Number(data.limit) : null,
    offset: Number.isFinite(Number(data?.offset)) ? Number(data.offset) : 0,
  };
}

export async function fetchKanbanAssignees(apiClient, householdId) {
  const encodedHouseholdId = encodeURIComponent(
    String(householdId || "").trim(),
  );
  const data = await apiClient.request(
    `/api/v1/kanban/households/${encodedHouseholdId}/assignees`,
    { method: "GET" },
  );
  const assignees = Array.isArray(data?.assignees) ? data.assignees : [];

  return {
    ...data,
    assignees,
  };
}

export async function fetchHouseholdCategories(apiClient, householdId) {
  const encodedHouseholdId = encodeURIComponent(
    String(householdId || "").trim(),
  );
  const data = await apiClient.request(
    `/api/v1/household/${encodedHouseholdId}/categories`,
    { method: "GET" },
  );

  return {
    ...data,
    categories: Array.isArray(data?.categories) ? data.categories : [],
  };
}

export async function createHouseholdCategory(apiClient, householdId, name) {
  const encodedHouseholdId = encodeURIComponent(
    String(householdId || "").trim(),
  );

  return apiClient.request(`/api/v1/household/${encodedHouseholdId}/categories`, {
    method: "POST",
    body: JSON.stringify({ name: String(name || "").trim() }),
  });
}

export async function deleteHouseholdCategory(
  apiClient,
  householdId,
  categoryId,
) {
  const encodedHouseholdId = encodeURIComponent(
    String(householdId || "").trim(),
  );
  const encodedCategoryId = encodeURIComponent(String(categoryId || "").trim());

  return apiClient.request(
    `/api/v1/household/${encodedHouseholdId}/categories/${encodedCategoryId}`,
    { method: "DELETE" },
  );
}

export async function updateKanbanTaskStatus(apiClient, taskId, status) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: toApiTaskStatus(status) }),
  });
}

export async function updateKanbanTaskOrder(apiClient, status, orderedTaskIds) {
  return apiClient.request("/api/v1/kanban/tasks/reorder", {
    method: "PATCH",
    body: JSON.stringify({
      status: toApiTaskStatus(status),
      ordered_task_ids: orderedTaskIds,
    }),
  });
}

export async function updateKanbanTaskPriority(apiClient, taskId, priority) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}/priority`, {
    method: "PATCH",
    body: JSON.stringify({
      priority: String(priority || "")
        .trim()
        .toLowerCase(),
    }),
  });
}

export async function updateKanbanTaskDueDate(apiClient, taskId, dueDate) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}/due-date`, {
    method: "PATCH",
    body: JSON.stringify({
      due_date: dueDate || null,
    }),
  });
}

export async function updateKanbanTaskRecurrence(
  apiClient,
  taskId,
  recurrenceFrequency,
  recurrenceInterval = 1,
  recurrenceEndDate = null,
) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}/recurrence`, {
    method: "PATCH",
    body: JSON.stringify({
      recurrence_frequency: recurrenceFrequency || null,
      recurrence_interval: recurrenceFrequency ? recurrenceInterval : null,
      recurrence_end_date: recurrenceFrequency ? recurrenceEndDate : null,
    }),
  });
}

export async function skipKanbanTaskOccurrence(apiClient, taskId, occurrenceDate) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}/skip-occurrence`, {
    method: "PATCH",
    body: JSON.stringify({
      occurrence_date: occurrenceDate,
    }),
  });
}

export async function updateKanbanTaskDescription(
  apiClient,
  taskId,
  description,
) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}/description`, {
    method: "PATCH",
    body: JSON.stringify({
      description: description ?? null,
    }),
  });
}

export async function updateKanbanTaskAssignee(apiClient, taskId, assigneeId) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}/assignee`, {
    method: "PATCH",
    body: JSON.stringify({
      assigns_to: assigneeId || null,
    }),
  });
}

export async function updateKanbanTaskCategory(
  apiClient,
  taskId,
  categoryName,
) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}/category`, {
    method: "PATCH",
    body: JSON.stringify({
      category_name: categoryName || null,
    }),
  });
}

export async function updateKanbanTaskName(apiClient, taskId, name) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}/name`, {
    method: "PATCH",
    body: JSON.stringify({
      name: String(name || "").trim(),
    }),
  });
}

export async function deleteKanbanTask(apiClient, taskId) {
  return apiClient.request(`/api/v1/kanban/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function createKanbanTask(apiClient, payload) {
  return apiClient.request("/api/v1/kanban", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
