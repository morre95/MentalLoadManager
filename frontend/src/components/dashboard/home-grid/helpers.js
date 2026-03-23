import { getUserFromLocalStorage } from "@/lib/auth";

export const DASHBOARD_WIDGETS_STORAGE_KEY_PREFIX = "dashboard-home-widgets-v4";

export const sizeClasses = {
  small: "col-span-1",
  medium: "col-span-1 md:col-span-1",
  large: "col-span-1 md:col-span-2",
};

export const priorityStyles = {
  low: "bg-sage-light text-sage border-sage/30",
  medium: "bg-status-todo/15 text-status-todo border-status-todo/30",
  high: "bg-terracotta-light text-terracotta border-terracotta/30",
};

export const moodTokenStyles = {
  burnout: "bg-terracotta",
  overwhelmed: "bg-[hsl(var(--status-todo))]",
  steady: "bg-[hsl(var(--sand))]",
  calm: "bg-sage",
  joyful: "bg-primary",
};

export const ANALYTICS_SERIES_COLORS = [
  "hsl(var(--sage))",
  "hsl(var(--terracotta))",
  "hsl(var(--sky))",
  "hsl(var(--lavender))",
  "hsl(var(--sand))",
  "hsl(var(--status-todo))",
  "hsl(var(--status-doing))",
  "hsl(var(--status-done))",
  "hsl(var(--primary))",
];

export const ANALYTICS_CHART_META = {
  distribution: {
    emptyTitle: "No distribution data",
    emptyHint: "Complete tasks to populate this chart.",
  },
  category: {
    emptyTitle: "No category data",
    emptyHint: "Assign tasks to categories to populate this chart.",
  },
  "load-trend": {
    emptyTitle: "No trend data",
    emptyHint: "More historical data is needed for this chart.",
  },
  completion: {
    emptyTitle: "No completion data",
    emptyHint: "Completion activity will appear here.",
  },
  radar: {
    emptyTitle: "No category expertise data",
    emptyHint: "This chart appears when categories and assignees exist.",
  },
  momentum: {
    emptyTitle: "No momentum data",
    emptyHint: "Completion movement will appear here.",
  },
};

export const DASHBOARD_LAYOUT_PRESETS = [
  {
    id: "focus",
    label: "Focused",
    description: "A practical workspace for today’s priorities.",
    widgetIds: ["quick-stats", "mini-taskboard", "upcoming-tasks", "mini-calendar", "mini-mood"],
  },
  {
    id: "planner",
    label: "Planner",
    description: "Calendar and task-heavy layout for weekly planning.",
    widgetIds: ["mini-calendar", "upcoming-tasks", "mini-taskboard", "quick-stats", "goal-"],
  },
  {
    id: "insights",
    label: "Insights",
    description: "Analytics-first dashboard with high-level signals.",
    widgetIds: ["quick-stats", "analytics-chart-distribution", "analytics-chart-completion", "analytics-chart-load-trend", "analytics-"],
  },
];

export function getDashboardStorageKey() {
  const user = getUserFromLocalStorage();
  const userKey = user?.username || user?.email || "anonymous";
  return `${DASHBOARD_WIDGETS_STORAGE_KEY_PREFIX}:${String(userKey).toLowerCase()}`;
}

export function readStoredWidgetIds() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getDashboardStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

export function writeWidgetIds(ids) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getDashboardStorageKey(), JSON.stringify(ids));
}

export function inferWidgetCategory(widget) {
  const id = String(widget?.id || "");
  const title = String(widget?.title || "").toLowerCase();

  if (id.startsWith("analytics-") || title.includes("analytics")) return "Analytics";
  if (id.includes("calendar") || title.includes("calendar")) return "Planning";
  if (id.includes("task") || title.includes("task")) return "Tasks";
  if (id.includes("goal") || title.includes("goal")) return "Goals";
  if (id.includes("mood") || title.includes("mood")) return "Wellbeing";
  return "Overview";
}

export function getWidgetSizeLabel(size) {
  if (size === "large") return "Large";
  if (size === "medium") return "Medium";
  return "Small";
}

export function resolvePresetWidgetIds(preset, allWidgets) {
  const availableIds = new Set((allWidgets || []).map((widget) => widget.id));
  const resolved = [];

  for (const requestedId of preset?.widgetIds || []) {
    if (requestedId.endsWith("-")) {
      const match = (allWidgets || [])
        .filter((widget) => widget.id.startsWith(requestedId))
        .map((widget) => widget.id);
      resolved.push(...match);
      continue;
    }

    if (availableIds.has(requestedId)) {
      resolved.push(requestedId);
    }
  }

  return Array.from(new Set(resolved));
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatRelativeDate(value) {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`;
}

export function formatWeekdayDate(value) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function buildTrainingDays(goal) {
  const existing = Array.isArray(goal?.trainingDays) ? goal.trainingDays : null;
  if (existing?.length === 7) return existing.map(Boolean);

  const count = Math.max(0, Math.min(7, Number(goal?.current) || 0));
  return Array.from({ length: 7 }, (_, index) => index < count);
}

export function normalizeGoalForWidget(goal) {
  if (!goal) return goal;
  if (goal.type !== "training") return goal;

  return {
    ...goal,
    trainingDays: buildTrainingDays(goal),
  };
}
