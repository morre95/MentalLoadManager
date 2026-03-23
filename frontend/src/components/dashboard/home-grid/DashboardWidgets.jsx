import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, ChevronLeft, ChevronRight, GripVertical, Loader2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import MoodArtwork from "@/components/mood/MoodArtwork";
import GoalTrackerRenderer from "@/components/goals/GoalTrackerRenderer";
import { Badge } from "@/components/ui/badge";
import {
  formatRelativeDate,
  formatWeekdayDate,
  moodTokenStyles,
  normalizeGoalForWidget,
  priorityStyles,
} from "@/components/dashboard/home-grid/helpers";
import { EmptyState, WidgetShell } from "@/components/dashboard/home-grid/WidgetCard";
import { updateKanbanTaskOrder, updateKanbanTaskStatus } from "@/lib/utils";

const DEFAULT_VISIBLE_TASKS_PER_COLUMN = 5;
const EMPTY_ARRAY = [];
const MOOD_TOKEN_COLOR_CLASS = {
  accent: "bg-accent",
  sky: "bg-sky",
  sage: "bg-sage",
  lavender: "bg-lavender",
  terracotta: "bg-terracotta",
  primary: "bg-primary",
  sand: "bg-sand",
  "status-todo": "bg-status-todo",
  "status-doing": "bg-status-doing",
  "status-done": "bg-status-done",
};

function toApiStatus(status) {
  return status === "in-progress" ? "in_progress" : status;
}

function normalizeColumnStatus(status) {
  return status === "on-hold" ? "archive" : String(status || "todo");
}

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToIso(isoDate, daysToAdd) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  return toLocalIsoDate(date);
}

function formatWeekdayOnly(value) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { weekday: "short" });
}

function MiniTaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""}>
      <div className="rounded-xl border border-border bg-background p-2.5">
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted active:cursor-grabbing"
            role="button"
            tabIndex={0}
            aria-label={`Move ${task.title}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs font-medium text-foreground">{task.title}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] text-muted-foreground">
                {task.assigneeLabel || "Unassigned"}
              </span>
              {task.priority ? (
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${priorityStyles[String(task.priority).toLowerCase()] || priorityStyles.medium}`}>
                  {String(task.priority)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniTaskOverlay({ task }) {
  if (!task) return null;

  return (
    <div className="w-52 rounded-xl border border-border bg-card p-2.5 shadow-xl ring-2 ring-primary/15">
      <p className="truncate text-xs font-medium text-foreground">{task.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {task.assigneeLabel || "Unassigned"}
        </span>
        {task.priority ? (
          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${priorityStyles[String(task.priority).toLowerCase()] || priorityStyles.medium}`}>
            {String(task.priority)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MiniTaskColumn({ column, tasks }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className={`flex min-h-0 flex-col rounded-2xl bg-muted/25 p-3 transition-colors ${isOver ? "ring-2 ring-primary/25 bg-primary/5" : ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${column.tone}`} />
        <p className="text-xs font-medium text-foreground">{column.title}</p>
        <Badge variant="outline" className="ml-auto h-5 rounded-full px-1.5 text-[10px]">
          {tasks.length}
        </Badge>
      </div>

      <div ref={setNodeRef} className="min-h-[5.5rem] space-y-2 overflow-y-auto">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background/60 p-2 text-[11px] text-muted-foreground">
              Empty
            </div>
          ) : (
            tasks.map((task) => <MiniTaskCard key={task.id} task={task} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function MiniTaskboardWidget({ tasks, setTasks, loading, error }) {
  const columns = useMemo(() => ([
    { id: "todo", title: "To Do", tone: "bg-status-todo" },
    { id: "in-progress", title: "Doing", tone: "bg-status-doing" },
    { id: "done", title: "Done", tone: "bg-status-done" },
  ]), []);
  const [activeId, setActiveId] = useState(null);
  const [dragStartColumn, setDragStartColumn] = useState(null);
  const [dragSnapshot, setDragSnapshot] = useState(null);
  const [pinnedVisibleTaskId, setPinnedVisibleTaskId] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const grouped = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      tasks: (() => {
        const columnTasks = tasks
        .filter((task) => {
          const status = normalizeColumnStatus(task?.status);
          return status === column.id;
        })
          .slice();

        const taskToKeepVisible = activeId || pinnedVisibleTaskId;
        const pinnedIndex = taskToKeepVisible
          ? columnTasks.findIndex((task) => String(task.id) === String(taskToKeepVisible))
          : -1;
        const visibleCount =
          pinnedIndex >= DEFAULT_VISIBLE_TASKS_PER_COLUMN
            ? pinnedIndex + 1
            : DEFAULT_VISIBLE_TASKS_PER_COLUMN;

        return columnTasks.slice(0, visibleCount);
      })(),
    }));
  }, [activeId, columns, pinnedVisibleTaskId, tasks]);

  const findColumnForTask = (taskId) => {
    const task = tasks.find((item) => String(item.id) === String(taskId));
    return task ? normalizeColumnStatus(task.status) : undefined;
  };

  const persistTaskStatus = async (taskId, nextStatus, rollbackTasks) => {
    try {
      await updateKanbanTaskStatus(taskId, toApiStatus(nextStatus));
    } catch (syncException) {
      if (Array.isArray(rollbackTasks)) {
        setTasks(rollbackTasks);
      }
      setSyncError(syncException);
    }
  };

  const persistTaskOrder = async (columnStatus, orderedTaskIds, rollbackTasks) => {
    try {
      await updateKanbanTaskOrder(toApiStatus(columnStatus), orderedTaskIds);
    } catch (syncException) {
      if (Array.isArray(rollbackTasks)) {
        setTasks(rollbackTasks);
      }
      setSyncError(syncException);
    }
  };

  const handleDragStart = (event) => {
    const taskId = String(event.active.id);
    setActiveId(taskId);
    setPinnedVisibleTaskId(null);
    setDragStartColumn(findColumnForTask(taskId));
    setDragSnapshot(tasks);
    setSyncError(null);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = String(active.id);
    const overId = String(over.id);
    const isOverColumn = columns.some((column) => column.id === overId);
    const targetColumn = isOverColumn ? overId : findColumnForTask(overId);
    if (!targetColumn) return;

    const activeColumn = findColumnForTask(activeTaskId);
    if (activeColumn !== targetColumn) {
      setTasks((prev) =>
        prev.map((task) => (
          String(task.id) === activeTaskId
            ? { ...task, status: targetColumn }
            : task
        ))
      );
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      if (Array.isArray(dragSnapshot)) {
        setTasks(dragSnapshot);
      }
      setDragStartColumn(null);
      setDragSnapshot(null);
      return;
    }

    const activeIdValue = String(active.id);
    setPinnedVisibleTaskId(activeIdValue);
    const overId = String(over.id);
    const isOverColumn = columns.some((column) => column.id === overId);
    const overColumn = isOverColumn ? overId : findColumnForTask(overId);
    const movedAcrossColumns =
      Boolean(dragStartColumn) && Boolean(overColumn) && dragStartColumn !== overColumn;

    if (!movedAcrossColumns && !isOverColumn && activeIdValue !== overId && dragStartColumn) {
      const columnTasks = tasks.filter((task) => normalizeColumnStatus(task.status) === dragStartColumn);
      const oldIndex = columnTasks.findIndex((task) => String(task.id) === activeIdValue);
      const newIndex = columnTasks.findIndex((task) => String(task.id) === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedColumnTasks = arrayMove(columnTasks, oldIndex, newIndex);
        const orderedTaskIds = reorderedColumnTasks.map((task) => task.id);

        let reorderCursor = 0;
        const nextTasks = tasks.map((task) => {
          if (normalizeColumnStatus(task.status) !== dragStartColumn) return task;
          const reorderedTask = reorderedColumnTasks[reorderCursor];
          reorderCursor += 1;
          return reorderedTask;
        });

        setTasks(nextTasks);
        await persistTaskOrder(dragStartColumn, orderedTaskIds, dragSnapshot);
      }
    }

    if (movedAcrossColumns && overColumn) {
      await persistTaskStatus(activeIdValue, overColumn, dragSnapshot);
    }

    setDragStartColumn(null);
    setDragSnapshot(null);
  };

  const activeTask = tasks.find((task) => String(task.id) === String(activeId));

  return (
    <WidgetShell
      title="Mini Taskboard"
      description="A compact task board with drag-and-drop moves."
      accent="h-9 w-9 rounded-2xl bg-primary/10"
    >
      {loading ? (
        <EmptyState message="Loading taskboard..." />
      ) : error ? (
        <EmptyState message="Could not load tasks." />
      ) : (
        <div className="flex h-full flex-col gap-3">
          {syncError ? (
            <p className="text-xs text-destructive">
              Couldn&apos;t sync the last task move. The board was restored.
            </p>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-3">
              {grouped.map((column) => (
                <MiniTaskColumn key={column.id} column={column} tasks={column.tasks} />
              ))}
            </div>
            <DragOverlay>
              <MiniTaskOverlay task={activeTask} />
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </WidgetShell>
  );
}

export function UpcomingTasksWidget({ tasks, loading, error }) {
  const upcomingTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => !["done", "archive", "on-hold"].includes(String(task?.status || "")) && task?.dueDateValue)
      .sort((left, right) => String(left.dueDateValue).localeCompare(String(right.dueDateValue)))
      .slice(0, 6);
  }, [tasks]);

  return (
    <WidgetShell
      title="Upcoming Tasks"
      description="What needs attention next."
      accent="h-9 w-9 rounded-2xl bg-status-todo/15"
    >
      {loading ? (
        <EmptyState message="Loading tasks..." />
      ) : error ? (
        <EmptyState message="Could not load upcoming tasks." />
      ) : upcomingTasks.length === 0 ? (
        <EmptyState message="No upcoming due dates." />
      ) : (
        <div className="space-y-2 overflow-y-auto">
          {upcomingTasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.category || "Uncategorized"}
                    {task.assigneeLabel ? ` · ${task.assigneeLabel}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {formatRelativeDate(task.dueDateValue)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

export function MiniCalendarWidget({ state, tasks = [], tasksLoading = false, tasksError = null }) {
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [weekAnchorDate, setWeekAnchorDate] = useState(todayIso);

  const weekDates = useMemo(() => {
    const anchorDate = new Date(`${weekAnchorDate}T00:00:00`);
    const mondayOffset = (anchorDate.getDay() + 6) % 7;
    const weekStart = new Date(anchorDate);
    weekStart.setDate(anchorDate.getDate() - mondayOffset);
    const weekStartIso = toLocalIsoDate(weekStart);

    return Array.from({ length: 7 }, (_, index) => addDaysToIso(weekStartIso, index));
  }, [weekAnchorDate]);

  const dueTasksByDate = useMemo(() => {
    return (tasks || []).reduce((acc, task) => {
      const dueDate = String(task?.dueDateValue || "");
      if (!dueDate) return acc;
      if (["done", "archive", "on-hold"].includes(String(task?.status || ""))) return acc;

      acc[dueDate] = [...(acc[dueDate] || []), task];
      return acc;
    }, {});
  }, [tasks]);

  const selectedDateTasks = dueTasksByDate[selectedDate] || [];
  const isLoading = state.loading || tasksLoading;
  const hasError = state.error || tasksError;
  const selectedDateLabel = formatWeekdayDate(selectedDate);
  const monthLabel = useMemo(() => {
    const activeDate = new Date(`${weekDates[3] || selectedDate}T00:00:00`);
    return activeDate.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }, [selectedDate, weekDates]);

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setWeekAnchorDate(date);
  };

  return (
    <WidgetShell
      title="Mini Calendar"
      description="Select a day to see tasks due this week."
      accent="h-9 w-9 rounded-2xl bg-sky-light"
    >
      {isLoading ? (
        <EmptyState message="Loading calendar..." />
      ) : hasError ? (
        <EmptyState message="Could not load calendar." />
      ) : (
        <div className="flex h-full flex-col gap-3">
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              className="rounded p-1 transition-colors hover:bg-muted"
              onClick={() => setWeekAnchorDate((current) => addDaysToIso(current, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="px-2 text-xs text-muted-foreground">{monthLabel}</span>
            <button
              type="button"
              className="rounded p-1 transition-colors hover:bg-muted"
              onClick={() => setWeekAnchorDate((current) => addDaysToIso(current, 7))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date) => (
              <div key={`${date}-label`} className="py-1 text-center text-xs text-muted-foreground">
                {formatWeekdayOnly(date)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date) => {
              const dayTasks = dueTasksByDate[date] || [];
              const isSelected = selectedDate === date;
              const isCurrentDay = todayIso === date;

              return (
                <motion.button
                  key={date}
                  type="button"
                  onClick={() => handleSelectDate(date)}
                  whileTap={{ scale: 0.98 }}
                  className={`relative rounded-lg py-2 text-center text-sm transition-colors ${
                    isSelected
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className={isCurrentDay && !isSelected ? "font-medium text-primary" : undefined}>
                    {new Date(`${date}T00:00:00`).getDate()}
                  </span>
                  {dayTasks.length > 0 ? (
                    <div className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                      isSelected ? "bg-primary-foreground" : "bg-terracotta"
                    }`} />
                  ) : null}
                </motion.button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-background/80 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{selectedDateLabel || "Selected day"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedDateTasks.length > 0
                    ? `${selectedDateTasks.length} task${selectedDateTasks.length === 1 ? "" : "s"} due`
                    : "Nothing due on this day"}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                This week
              </Badge>
            </div>

            <div className="space-y-2 overflow-y-auto">
              {selectedDateTasks.map((task, index) => {
                const priority = String(task.priority || "").toLowerCase();
                const priorityClass =
                  priority === "high"
                    ? "bg-terracotta-light text-terracotta border-terracotta/30"
                    : priority === "low"
                      ? "bg-sage-light text-sage border-sage/30"
                      : "bg-sky-light text-sky border-sky/30";

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-xl border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">{task.title}</p>
                      {task.priority ? (
                        <Badge variant="outline" className={`shrink-0 ${priorityClass}`}>
                          {String(task.priority)}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {task.category ? (
                        <span className="rounded-full bg-background px-2 py-0.5">
                          {task.category}
                        </span>
                      ) : null}
                      {task.assigneeLabel ? <span>{task.assigneeLabel}</span> : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {selectedDateTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                No tasks due on this day.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

export function MiniMoodWidget({ state }) {
  const dates = Array.isArray(state?.tracker?.dates) ? state.tracker.dates : EMPTY_ARRAY;
  const [selectedDate, setSelectedDate] = useState(() => dates.find((item) => item?.date)?.date || "");

  const effectiveSelectedDate = useMemo(() => {
    if (dates.some((item) => item?.date === selectedDate)) return selectedDate;
    return dates.find((item) => item?.date)?.date || "";
  }, [dates, selectedDate]);

  const paintedDays = Array.isArray(state?.tracker?.painted_days) ? state.tracker.painted_days : EMPTY_ARRAY;
  const paintedByRegion = Object.fromEntries(paintedDays.map((entry) => [entry.region_id, entry]));

  return (
    <WidgetShell
      title="Mood Miniature"
      description="A compact mood board for the current week."
      accent="h-9 w-9 rounded-2xl bg-sage-light"
    >
      {state.loading ? (
        <EmptyState message="Loading mood board..." />
      ) : state.error ? (
        <EmptyState message="Could not load mood tracker." />
      ) : (
        <div className="flex h-full flex-col gap-3">
          <div className="grid grid-cols-7 gap-1">
            {dates.slice(0, 7).map((item) => (
              <div key={`${item.date}-label`} className="py-1 text-center text-xs text-muted-foreground">
                {formatWeekdayOnly(item.date)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dates.slice(0, 7).map((item) => {
              const isSelected = item.date === effectiveSelectedDate;
              const moodDotClass = item.is_future
                ? "bg-muted"
                : item.color_token
                  ? MOOD_TOKEN_COLOR_CLASS[item.color_token] || moodTokenStyles[item.color_token] || "bg-primary"
                  : item.is_painted
                    ? "bg-primary"
                    : "bg-border";

              return (
                <motion.button
                  key={item.date}
                  type="button"
                  onClick={() => setSelectedDate(item.date)}
                  whileTap={{ scale: 0.98 }}
                  className={`relative rounded-lg py-2 text-center text-sm transition-colors ${
                    isSelected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{new Date(`${item.date}T00:00:00`).getDate()}</span>
                  <div className="mt-2 flex justify-center">
                    <span
                      className={`h-4 w-4 rounded-full border border-card ${moodDotClass}`}
                    />
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-background/80 p-3">
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="aspect-[1.15/1] overflow-hidden rounded-xl bg-background/80 p-2">
                <MoodArtwork
                  periodType={state?.tracker?.period_type || "weekly"}
                  imageId={state?.tracker?.image_id}
                  regionIds={state?.tracker?.region_ids || []}
                  paintedByRegion={paintedByRegion}
                  selectedDate={effectiveSelectedDate || null}
                  onRegionClick={() => {}}
                  onRegionHover={() => {}}
                  svgMarkup={state?.tracker?.svg_markup}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

export function AnalyticsStatWidget({ stat }) {
  const trendClass =
    stat?._trend === "up"
      ? "bg-sage-light text-sage"
      : stat?._trend === "down"
        ? "bg-terracotta-light text-terracotta"
        : "bg-muted text-muted-foreground";

  return (
    <WidgetShell
      title={stat?.title || "Analytics"}
      description={stat?.description || "Live household metric."}
      accent="h-9 w-9 rounded-2xl bg-primary/10"
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            {stat?._changeText ? (
              <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${trendClass}`}>
                {stat._changeText}
              </span>
            ) : null}
          </div>

          <p className="mt-6 text-3xl font-bold text-foreground">{stat?.value ?? "—"}</p>
          {stat?.compareLabel ? (
            <p className="mt-2 text-xs text-muted-foreground">{stat.compareLabel}</p>
          ) : null}
        </div>
      </div>
    </WidgetShell>
  );
}

export function GoalWidget({ goal }) {
  const normalizedGoal = useMemo(() => normalizeGoalForWidget(goal), [goal]);
  const safeCurrent = Math.max(0, Number(goal?.current) || 0);
  const safeTarget = Math.max(1, Number(goal?.target) || 1);
  const progress = Math.min(100, Math.round((safeCurrent / safeTarget) * 100));

  return (
    <WidgetShell
      title={goal?.name || "Goal"}
      description={`${goal?.trackingStyle || "custom"} goal`}
      accent="h-9 w-9 rounded-2xl bg-sage-light"
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex min-h-[130px] items-center justify-center overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/15 px-2 py-3">
          <GoalTrackerRenderer goal={normalizedGoal} />
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-muted/15 p-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Now</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{safeCurrent}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{safeTarget}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Done</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{progress}%</p>
          </div>
        </div>

        <div className="mt-auto">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

export function WidgetLoadingCard({ title }) {
  return (
    <WidgetShell title={title} description="Loading widget..." accent="h-9 w-9 rounded-2xl bg-muted">
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    </WidgetShell>
  );
}

export function AnalyticsChartWidget({ title, description, chart }) {
  return (
    <WidgetShell
      title={title}
      description={description}
      accent="h-9 w-9 rounded-2xl bg-primary/10"
    >
      <div className="h-full min-w-0">
        {chart}
      </div>
    </WidgetShell>
  );
}
