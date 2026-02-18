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
  if (["medium", "med", "m", "2", "p2", "normal"].includes(value)) return "medium";

  return "medium";
}

function formatDueDate(iso) {
  if (!iso) return undefined;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toLocaleDateString();
}

export function toApiTaskStatus(status) {
  if (status === "in-progress") return "in_progress";
  if (status === "on-hold") return "on_hold";
  return status;
}

export function mapApiTaskToUi(task) {
  return {
    id: String(task.task_id),
    title: task.name || "",
    description: undefined,
    status: normalizeStatus(task.status),
    priority: normalizePriority(task),
    assignee: task.assignee_name || "Unassigned",
    dueDate: formatDueDate(task.due_date),
    category: task.category_name || "Other",
  };
}

export async function fetchKanbanTasks(apiClient) {
  const data = await apiClient.request("/api/kanban/tasks", { method: "GET" });
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];

  return {
    ...data,
    tasks: tasks.map(mapApiTaskToUi),
  };
}

export async function updateKanbanTaskStatus(apiClient, taskId, status) {
  return apiClient.request(`/api/kanban/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: toApiTaskStatus(status) }),
  });
}

export async function updateKanbanTaskOrder(apiClient, status, orderedTaskIds) {
  return apiClient.request("/api/kanban/tasks/reorder", {
    method: "PATCH",
    body: JSON.stringify({
      status: toApiTaskStatus(status),
      ordered_task_ids: orderedTaskIds,
    }),
  });
}

export async function createKanbanTask(apiClient, payload) {
  return apiClient.request("/api/kanban", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
