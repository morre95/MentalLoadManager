import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  GripVertical,
  Home,
  Loader2,
  Plus,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTaskboardTasks } from "@/hooks/useTaskboardTasks";
import { useHousehold } from "@/hooks/useHouseHold";
import {
  apiClient,
  apiFetch,
  fetchAchievements,
  fetchGoals,
  fetchMoodTrackerPeriod,
  fetchNotificationSettings,
  fetchPreferences,
  fetchTaskReminderSummary,
} from "@/lib/utils";
import { fetchAnalyticsSummary, fetchCalendarRange } from "../../../../shared/index.js";

const DASHBOARD_WIDGETS_STORAGE_KEY = "dashboard-home-widgets-v1";

const sizeClasses = {
  small: "col-span-1",
  medium: "col-span-1 md:col-span-1",
  large: "col-span-1 md:col-span-2",
};

function readWidgetIds(defaultIds) {
  if (typeof window === "undefined") return defaultIds;

  try {
    const raw = window.localStorage.getItem(DASHBOARD_WIDGETS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(String) : defaultIds;
  } catch {
    return defaultIds;
  }
}

function writeWidgetIds(ids) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DASHBOARD_WIDGETS_STORAGE_KEY, JSON.stringify(ids));
}

function formatRelativeDate(value) {
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

function formatWeekdayDate(value) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function WidgetShell({
  title,
  description,
  actionLabel,
  onAction,
  children,
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actionLabel ? (
          <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={onAction}>
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function TasksOverviewWidget() {
  const navigate = useNavigate();
  const { tasks, loading, error } = useTaskboardTasks(null, { pageSize: 20 });

  const statusCounts = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        const key = task?.status === "on-hold" ? "archive" : String(task?.status || "todo");
        if (key === "done") acc.done += 1;
        else if (key === "in-progress") acc.inProgress += 1;
        else if (key === "archive") acc.archive += 1;
        else acc.todo += 1;
        return acc;
      },
      { todo: 0, inProgress: 0, done: 0, archive: 0 }
    );
  }, [tasks]);

  const upcomingTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => task?.status !== "done" && task?.dueDateValue)
      .sort((a, b) => String(a.dueDateValue).localeCompare(String(b.dueDateValue)))
      .slice(0, 4);
  }, [tasks]);

  return (
    <WidgetShell
      title="Tasks"
      description="Live task board status and next deadlines."
      actionLabel="Open tasks"
      onAction={() => navigate("/dashboard/tasks")}
    >
      {loading ? (
        <EmptyState message="Loading tasks..." />
      ) : error ? (
        <EmptyState message="Could not load tasks right now." />
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">To do</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{statusCounts.todo}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">In progress</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{statusCounts.inProgress}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">Done</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{statusCounts.done}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">Archived</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{statusCounts.archive}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Next up</p>
            {upcomingTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                No upcoming due dates.
              </div>
            ) : (
              upcomingTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate("/dashboard/tasks")}
                  className="w-full rounded-xl border border-border bg-card p-3 text-left transition hover:bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.category || "Uncategorized"}
                      </p>
                    </div>
                    <Badge variant="outline">{formatRelativeDate(task.dueDateValue)}</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

function CalendarOverviewWidget() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, events: [], error: null });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const today = new Date();
        const from = today.toISOString().slice(0, 10);
        const toDate = new Date(today);
        toDate.setDate(today.getDate() + 6);
        const to = toDate.toISOString().slice(0, 10);
        const data = await fetchCalendarRange(apiClient, from, to);
        if (!active) return;
        setState({
          loading: false,
          events: Array.isArray(data?.events) ? data.events : [],
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setState({ loading: false, events: [], error });
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const groupedDays = useMemo(() => {
    const map = new Map();
    state.events.forEach((event) => {
      const key = String(event.date || "");
      if (!key) return;
      const current = map.get(key) || [];
      current.push(event);
      map.set(key, current);
    });
    return [...map.entries()].slice(0, 4);
  }, [state.events]);

  return (
    <WidgetShell
      title="Calendar"
      description="Upcoming scheduled tasks across the next week."
      actionLabel="Open calendar"
      onAction={() => navigate("/dashboard/calendar")}
    >
      {state.loading ? (
        <EmptyState message="Loading calendar..." />
      ) : state.error ? (
        <EmptyState message="Could not load calendar events." />
      ) : (
        <div className="flex h-full flex-col gap-3">
          <div className="grid grid-cols-4 gap-2">
            {groupedDays.length === 0
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-center text-xs text-muted-foreground"
                  >
                    Free day
                  </div>
                ))
              : groupedDays.map(([date, events]) => (
                  <div key={date} className="rounded-xl border border-border bg-muted/25 p-3 text-center">
                    <p className="text-xs text-muted-foreground">{formatWeekdayDate(date)}</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{events.length}</p>
                    <p className="text-[11px] text-muted-foreground">planned</p>
                  </div>
                ))}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {state.events.slice(0, 4).map((event) => (
              <button
                key={`${event.id}-${event.date}`}
                type="button"
                onClick={() => navigate("/dashboard/calendar")}
                className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:bg-muted/20"
              >
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWeekdayDate(event.date)}
                    {event.household_name ? ` · ${event.household_name}` : ""}
                  </p>
                </div>
              </button>
            ))}
            {state.events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                No scheduled items in the next week.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

function GoalsOverviewWidget() {
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    goals: [],
    achievements: [],
    error: null,
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [goalsData, achievementsData] = await Promise.all([
          fetchGoals(),
          fetchAchievements(),
        ]);
        if (!active) return;
        setState({
          loading: false,
          goals: Array.isArray(goalsData?.goals) ? goalsData.goals : [],
          achievements: Array.isArray(achievementsData?.achievements)
            ? achievementsData.achievements
            : [],
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setState({ loading: false, goals: [], achievements: [], error });
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const activeGoals = state.goals.filter(
    (goal) => Number(goal?.current || 0) < Math.max(1, Number(goal?.target) || 1)
  );
  const readyAchievements = state.achievements.filter(
    (achievement) => achievement?.current_milestone_complete ?? achievement?.completed
  );

  return (
    <WidgetShell
      title="Goals"
      description="Progress, unlocked milestones, and what still needs motion."
      actionLabel="Open goals"
      onAction={() => navigate("/dashboard/goals")}
    >
      {state.loading ? (
        <EmptyState message="Loading goals..." />
      ) : state.error ? (
        <EmptyState message="Could not load goals." />
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">Active goals</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{activeGoals.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">Ready achievements</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{readyAchievements.length}</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {activeGoals.slice(0, 4).map((goal) => {
              const current = Number(goal?.current || 0);
              const target = Math.max(1, Number(goal?.target) || 1);
              const pct = Math.min(100, Math.round((current / target) * 100));

              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => navigate("/dashboard/goals", { state: { highlightGoalId: goal.id } })}
                  className="w-full rounded-xl border border-border bg-card p-3 text-left transition hover:bg-muted/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{goal.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {current}/{target} complete
                      </p>
                    </div>
                    <Badge variant="outline">{pct}%</Badge>
                  </div>
                </button>
              );
            })}
            {activeGoals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                No active goals right now.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

function MoodOverviewWidget() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, tracker: null, error: null });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const data = await fetchMoodTrackerPeriod("weekly", today);
        if (!active) return;
        setState({ loading: false, tracker: data, error: null });
      } catch (error) {
        if (!active) return;
        setState({ loading: false, tracker: null, error });
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const dates = Array.isArray(state.tracker?.dates) ? state.tracker.dates : [];
  const paintedCount = dates.filter((item) => item?.is_painted).length;
  const openCount = dates.filter((item) => !item?.is_future && !item?.is_painted).length;

  return (
    <WidgetShell
      title="Mood"
      description="This week’s painted days and what still needs a check-in."
      actionLabel="Open mood"
      onAction={() => navigate("/dashboard/mood")}
    >
      {state.loading ? (
        <EmptyState message="Loading mood tracker..." />
      ) : state.error ? (
        <EmptyState message="Could not load mood tracker." />
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">Painted</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{paintedCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">Open days</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{openCount}</p>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {dates.slice(0, 7).map((dateItem) => (
              <button
                key={dateItem.date}
                type="button"
                onClick={() => navigate("/dashboard/mood")}
                className="rounded-xl border border-border bg-card p-2 text-center transition hover:bg-muted/20"
              >
                <p className="text-[11px] text-muted-foreground">
                  {formatWeekdayDate(dateItem.date).split(",")[0]}
                </p>
                <div className="mt-2 flex justify-center">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      dateItem.is_future
                        ? "bg-muted"
                        : dateItem.is_painted
                          ? "bg-primary"
                          : "bg-border"
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

function AnalyticsOverviewWidget() {
  const navigate = useNavigate();
  const { households } = useHousehold();
  const [state, setState] = useState({ loading: true, stats: [], error: null });

  useEffect(() => {
    let active = true;

    const load = async () => {
      const household = households?.[0];
      const householdId = household?.household_id ? String(household.household_id) : null;

      if (!householdId) {
        setState({ loading: false, stats: [], error: null });
        return;
      }

      try {
        const summary = await fetchAnalyticsSummary(apiClient, householdId, "30d");
        if (!active) return;
        setState({
          loading: false,
          stats: Array.isArray(summary?.stats) ? summary.stats.slice(0, 3) : [],
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setState({ loading: false, stats: [], error });
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [households]);

  return (
    <WidgetShell
      title="Analytics"
      description="Top household metrics from the current analytics summary."
      actionLabel="Open analytics"
      onAction={() => navigate("/dashboard/analytics")}
    >
      {state.loading ? (
        <EmptyState message="Loading analytics..." />
      ) : state.error ? (
        <EmptyState message="Could not load analytics." />
      ) : state.stats.length === 0 ? (
        <EmptyState message="No analytics data available yet." />
      ) : (
        <div className="grid h-full gap-3">
          {state.stats.map((stat, index) => (
            <div key={`${stat.title}-${index}`} className="rounded-xl border border-border bg-muted/25 p-4">
              <p className="text-xs text-muted-foreground">{stat.title}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
              {stat.compareLabel || stat.description ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.compareLabel || stat.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function HouseholdOverviewWidget() {
  const navigate = useNavigate();
  const { households, membersFlat, loading } = useHousehold();

  const uniqueMembers = useMemo(() => {
    const map = new Map();
    membersFlat.forEach((member) => {
      const key = member?.user_id ?? member?.id ?? member?.username;
      if (!key) return;
      if (!map.has(key)) map.set(key, member);
    });
    return [...map.values()];
  }, [membersFlat]);

  return (
    <WidgetShell
      title="Household"
      description="Membership, collaborators, and household coverage."
      actionLabel="Open household"
      onAction={() => navigate("/dashboard/household")}
    >
      {loading ? (
        <EmptyState message="Loading households..." />
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">Households</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{households.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-xs text-muted-foreground">People</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{uniqueMembers.length}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {households.slice(0, 4).map((household) => (
              <button
                key={household.household_id}
                type="button"
                onClick={() => navigate("/dashboard/household")}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left transition hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{household.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(household.members || []).length} member{(household.members || []).length === 1 ? "" : "s"}
                  </p>
                </div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {households.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                You are not part of a household yet.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

function SummariesOverviewWidget() {
  const navigate = useNavigate();
  const { households } = useHousehold();
  const [state, setState] = useState({ loading: true, reports: [], error: null });

  useEffect(() => {
    let active = true;

    const load = async () => {
      const household = households?.[0];
      const householdId = household?.household_id ? String(household.household_id) : null;

      if (!householdId) {
        setState({ loading: false, reports: [], error: null });
        return;
      }

      try {
        const data = await apiFetch(`/api/v1/ai/summaries?household_id=${encodeURIComponent(householdId)}`, {
          method: "GET",
        });
        if (!active) return;
        setState({
          loading: false,
          reports: Array.isArray(data?.summaries) ? data.summaries : [],
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setState({ loading: false, reports: [], error });
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [households]);

  const latestReport = state.reports[0];

  return (
    <WidgetShell
      title="Summaries"
      description="Latest AI weekly summary output for your current household."
      actionLabel="Open summaries"
      onAction={() => navigate("/dashboard/summarys")}
    >
      {state.loading ? (
        <EmptyState message="Loading summaries..." />
      ) : state.error ? (
        <EmptyState message="Could not load summaries." />
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="rounded-xl border border-border bg-muted/25 p-4">
            <p className="text-xs text-muted-foreground">Saved reports</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{state.reports.length}</p>
          </div>
          {latestReport ? (
            <button
              type="button"
              onClick={() => navigate("/dashboard/summarys")}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:bg-muted/20"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Latest report</p>
                <Badge variant="outline">{latestReport.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatWeekdayDate(latestReport.week_start)}
              </p>
              {latestReport.model ? (
                <p className="mt-1 text-xs text-muted-foreground">{latestReport.model}</p>
              ) : null}
            </button>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              No saved summaries yet.
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

function SettingsOverviewWidget() {
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    preferences: null,
    notifications: null,
    reminderSummary: null,
    error: null,
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [preferences, notifications, reminderSummary] = await Promise.all([
          fetchPreferences(),
          fetchNotificationSettings(),
          fetchTaskReminderSummary().catch(() => null),
        ]);

        if (!active) return;
        setState({
          loading: false,
          preferences,
          notifications,
          reminderSummary,
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          preferences: null,
          notifications: null,
          reminderSummary: null,
          error,
        });
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const theme = typeof window !== "undefined"
    ? window.localStorage.getItem("theme_preference") || "system"
    : "system";

  const enabledNotifications = [
    Boolean(state.notifications?.goal_milestones),
    Boolean(state.notifications?.email_notifications),
    Boolean(state.notifications?.task_reminders),
    Boolean(state.notifications?.achievement_notifications),
    Boolean(state.notifications?.weekly_analytics_email),
  ].filter(Boolean).length;

  return (
    <WidgetShell
      title="Settings"
      description="Theme, preferences, and notification readiness."
      actionLabel="Open settings"
      onAction={() => navigate("/dashboard/settings")}
    >
      {state.loading ? (
        <EmptyState message="Loading settings..." />
      ) : state.error ? (
        <EmptyState message="Could not load settings." />
      ) : (
        <div className="grid h-full gap-3">
          <div className="rounded-xl border border-border bg-muted/25 p-4">
            <p className="text-xs text-muted-foreground">Theme</p>
            <p className="mt-1 text-lg font-semibold capitalize text-foreground">{theme}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/25 p-4">
            <p className="text-xs text-muted-foreground">Date format</p>
            <p className="mt-1 text-lg font-semibold uppercase text-foreground">
              {state.preferences?.date_format || "mdy"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/25 p-4">
            <p className="text-xs text-muted-foreground">Enabled notifications</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{enabledNotifications}</p>
            {state.reminderSummary?.overdue_task_count ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {state.reminderSummary.overdue_task_count} overdue reminder
                {state.reminderSummary.overdue_task_count === 1 ? "" : "s"} active
              </p>
            ) : null}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

function HomeOverviewWidget() {
  const navigate = useNavigate();
  const { households, membersFlat } = useHousehold();
  const { tasks, loading: tasksLoading } = useTaskboardTasks(null, { pageSize: 50 });
  const [goalState, setGoalState] = useState({ loading: true, goals: [], error: null });

  useEffect(() => {
    let active = true;

    const loadGoalsData = async () => {
      try {
        const data = await fetchGoals();
        if (!active) return;
        setGoalState({
          loading: false,
          goals: Array.isArray(data?.goals) ? data.goals : [],
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setGoalState({ loading: false, goals: [], error });
      }
    };

    loadGoalsData();
    return () => {
      active = false;
    };
  }, []);

  const activeGoals = goalState.goals.filter(
    (goal) => Number(goal?.current || 0) < Math.max(1, Number(goal?.target) || 1)
  ).length;
  const openTasks = tasks.filter((task) => task?.status !== "done").length;
  const memberCount = useMemo(() => {
    return new Set(
      membersFlat
        .map((member) => member?.user_id ?? member?.id ?? member?.username)
        .filter(Boolean)
    ).size;
  }, [membersFlat]);

  return (
    <WidgetShell
      title="Overview"
      description="The key signals from your workspace in one place."
      actionLabel="Open tasks"
      onAction={() => navigate("/dashboard/tasks")}
    >
      {tasksLoading || goalState.loading ? (
        <EmptyState message="Loading dashboard..." />
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-muted/25 p-4">
              <p className="text-xs text-muted-foreground">Open tasks</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{openTasks}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 p-4">
              <p className="text-xs text-muted-foreground">Active goals</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{activeGoals}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 p-4">
              <p className="text-xs text-muted-foreground">Households</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{households.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/25 p-4">
              <p className="text-xs text-muted-foreground">People</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{memberCount}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard/calendar")}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:bg-muted/20"
            >
              <CalendarDays className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">Plan the week</p>
              <p className="mt-1 text-xs text-muted-foreground">Jump into calendar and due dates.</p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard/goals")}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:bg-muted/20"
            >
              <Target className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">Track goals</p>
              <p className="mt-1 text-xs text-muted-foreground">Review progress and achievements.</p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard/analytics")}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:bg-muted/20"
            >
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">Check insights</p>
              <p className="mt-1 text-xs text-muted-foreground">See household load and trends.</p>
            </button>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

const allWidgets = [
  {
    id: "overview",
    title: "Overview",
    description: "Top-level dashboard signals",
    size: "large",
    component: HomeOverviewWidget,
  },
  {
    id: "tasks",
    title: "Tasks",
    description: "Live task board summary",
    size: "large",
    component: TasksOverviewWidget,
  },
  {
    id: "calendar",
    title: "Calendar",
    description: "Upcoming scheduled items",
    size: "medium",
    component: CalendarOverviewWidget,
  },
  {
    id: "goals",
    title: "Goals",
    description: "Goal progress and achievements",
    size: "medium",
    component: GoalsOverviewWidget,
  },
  {
    id: "mood",
    title: "Mood",
    description: "Mood tracker progress",
    size: "small",
    component: MoodOverviewWidget,
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Household metrics",
    size: "medium",
    component: AnalyticsOverviewWidget,
  },
  {
    id: "household",
    title: "Household",
    description: "People and households",
    size: "small",
    component: HouseholdOverviewWidget,
  },
  {
    id: "summaries",
    title: "Summaries",
    description: "AI weekly reports",
    size: "small",
    component: SummariesOverviewWidget,
  },
  {
    id: "settings",
    title: "Settings",
    description: "Theme, dates, notifications",
    size: "small",
    component: SettingsOverviewWidget,
  },
];

function SortableWidget({ widget, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Component = widget.component;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className={`widget-card relative group ${sizeClasses[widget.size]} ${
        isDragging ? "widget-card-dragging opacity-50" : ""
      }`}
    >
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onRemove(widget.id)}
          className="rounded-lg bg-muted/90 p-1.5 text-muted-foreground transition-colors hover:text-destructive"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab rounded-lg bg-muted/90 p-1.5 active:cursor-grabbing"
          role="button"
          tabIndex={0}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <Component />
    </motion.div>
  );
}

function WidgetOverlay({ widget }) {
  const Component = widget.component;
  return (
    <div className={`widget-card widget-card-dragging ${sizeClasses[widget.size]}`}>
      <Component />
    </div>
  );
}

export default function DashboardHomeGrid() {
  const defaultWidgetIds = useMemo(
    () => ["overview", "tasks", "calendar", "goals", "analytics", "mood", "household", "summaries"],
    []
  );

  const [activeWidgetIds, setActiveWidgetIds] = useState(() => readWidgetIds(defaultWidgetIds));
  const [activeId, setActiveId] = useState(null);
  const [isManageOpen, setIsManageOpen] = useState(false);

  useEffect(() => {
    writeWidgetIds(activeWidgetIds);
  }, [activeWidgetIds]);

  const activeWidgets = activeWidgetIds
    .map((id) => allWidgets.find((widget) => widget.id === id))
    .filter(Boolean);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    setActiveWidgetIds((items) => {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleRemove = (id) => {
    setActiveWidgetIds((current) => current.filter((widgetId) => widgetId !== id));
  };

  const handleAdd = (id) => {
    setActiveWidgetIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const handleReset = () => {
    setActiveWidgetIds(defaultWidgetIds);
  };

  const activeWidget = allWidgets.find((widget) => widget.id === activeId);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Drag widgets to reorder them. Hide or re-add widgets whenever you want.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleReset}>
            <Home className="h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsManageOpen(true)}>
            <Plus className="h-4 w-4" />
            Manage widgets
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={activeWidgetIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {activeWidgets.map((widget) => (
                <SortableWidget key={widget.id} widget={widget} onRemove={handleRemove} />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>

        <DragOverlay>{activeWidget ? <WidgetOverlay widget={activeWidget} /> : null}</DragOverlay>
      </DndContext>

      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Manage Dashboard Widgets</DialogTitle>
          </DialogHeader>

          <div className="mt-4 grid gap-3">
            {allWidgets.map((widget) => {
              const isActive = activeWidgetIds.includes(widget.id);

              return (
                <div
                  key={widget.id}
                  className="flex items-center justify-between rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{widget.title}</p>
                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                  </div>
                  <Button
                    variant={isActive ? "outline" : "default"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => (isActive ? handleRemove(widget.id) : handleAdd(widget.id))}
                  >
                    {isActive ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        Show
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
