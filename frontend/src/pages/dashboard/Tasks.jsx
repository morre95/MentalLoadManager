import { useCallback, useEffect, useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import {
  ListTodo,
  Plus,
  Repeat,
  GripVertical,
  Trash2,
  PauseCircle,
  Clock,
  CheckCircle2,
  Circle,
} from "lucide-react";

import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import AddTaskDialog from "@/components/tasks/AddTaskDialog";
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";

import { useTaskboardTasks } from "@/hooks/useTaskboardTasks";
import { useHousehold } from "@/hooks/useHouseHold";
import {
  deleteKanbanTask,
  formatTaskRecurrence,
  skipKanbanTaskOccurrence,
  toUtcDateOnlyIso,
  updateKanbanTaskDescription,
  updateKanbanTaskAssignee,
  updateKanbanTaskCategory,
  updateKanbanTaskDueDate,
  updateKanbanTaskName,
  updateKanbanTaskOrder,
  updateKanbanTaskPriority,
  updateKanbanTaskRecurrence,
  updateKanbanTaskStatus,
} from "@/lib/utils";

import { NoHouseholdState } from "@/components/ui/noHouseHoldState";

const priorityColors = {
  low: "bg-sage-light text-sage border-sage/30",
  medium: "bg-status-todo/15 text-status-todo border-status-todo/30",
  high: "bg-terracotta-light text-terracotta border-terracotta/30",
};

const columns = [
  { id: "todo", title: "To Do", colorClass: "bg-status-todo", icon: Circle },
  { id: "in-progress", title: "In Progress", colorClass: "bg-status-doing", icon: Clock },
  { id: "done", title: "Done", colorClass: "bg-status-done", icon: CheckCircle2 },
  { id: "archive", title: "Archive", colorClass: "bg-[hsl(var(--lavender))]", icon: PauseCircle },
];

const ARCHIVE_COLUMN_ID = "archive";
const ALL_HOUSEHOLDS_VALUE = "__all_households__";
const MAX_VISIBLE_TASKS_PER_COLUMN = 8;
const TASK_CREATED_EVENT = "kanban-task-created";
const STATUS_TOKEN_MAP = {
  todo: "todo",
  "to-do": "todo",
  done: "done",
  completed: "done",
  complete: "done",
  "in-progress": "in-progress",
  inprogress: "in-progress",
  progress: "in-progress",
  archive: "archive",
  archived: "archive",
};

const PRIORITY_TOKEN_MAP = {
  low: "low",
  medium: "medium",
  med: "medium",
  high: "high",
};

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function getTaskSearchText(task) {
  return [
    task?.title,
    task?.description,
    task?.category,
    task?.assigneeLabel,
    task?.dueDate,
  ]
    .map((field) => normalizeSearchValue(field))
    .filter(Boolean)
    .join(" ");
}

function parseTaskSearchQuery(rawQuery) {
  const tokens = normalizeSearchValue(rawQuery).split(/\s+/).filter(Boolean);
  const filters = {
    textTerms: [],
    statuses: [],
    priorities: [],
    dueStates: [],
    recurringOnly: false,
  };

  tokens.forEach((token) => {
    if (STATUS_TOKEN_MAP[token]) {
      filters.statuses.push(STATUS_TOKEN_MAP[token]);
      return;
    }

    if (PRIORITY_TOKEN_MAP[token]) {
      filters.priorities.push(PRIORITY_TOKEN_MAP[token]);
      return;
    }

    if (token === "overdue" || token === "today" || token === "upcoming") {
      filters.dueStates.push(token);
      return;
    }

    if (token === "recurring" || token === "repeat" || token === "repeats") {
      filters.recurringOnly = true;
      return;
    }

    filters.textTerms.push(token);
  });

  return {
    ...filters,
    statuses: [...new Set(filters.statuses)],
    priorities: [...new Set(filters.priorities)],
    dueStates: [...new Set(filters.dueStates)],
  };
}

function getTaskDueState(task) {
  if (!task?.dueDateValue) return null;

  const dueDate = new Date(`${task.dueDateValue}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dueDate.getTime() < today.getTime()) return "overdue";
  if (dueDate.getTime() === today.getTime()) return "today";
  return "upcoming";
}

function taskMatchesFilters(task, filters) {
  const taskStatus = task?.status === "on-hold" ? "archive" : normalizeSearchValue(task?.status);
  const taskPriority = normalizeSearchValue(task?.priority);
  const taskDueState = getTaskDueState(task);
  const taskSearchText = getTaskSearchText(task);

  if (filters.statuses.length > 0 && !filters.statuses.includes(taskStatus)) {
    return false;
  }

  if (filters.priorities.length > 0 && !filters.priorities.includes(taskPriority)) {
    return false;
  }

  if (filters.dueStates.length > 0 && !filters.dueStates.includes(taskDueState)) {
    return false;
  }

  if (filters.recurringOnly && !task?.recurrenceEnabled) {
    return false;
  }

  return filters.textTerms.every((term) => taskSearchText.includes(term));
}

function buildSearchFilterBadges(filters) {
  return [
    ...filters.statuses.map((status) => ({ key: `status-${status}`, label: `Status: ${status}` })),
    ...filters.priorities.map((priority) => ({ key: `priority-${priority}`, label: `Priority: ${priority}` })),
    ...filters.dueStates.map((dueState) => ({ key: `due-${dueState}`, label: `Due: ${dueState}` })),
    ...(filters.recurringOnly ? [{ key: "recurring", label: "Recurring" }] : []),
    ...filters.textTerms.map((term) => ({ key: `term-${term}`, label: `Text: ${term}` })),
  ];
}

function toApiStatus(status) {
  if (status === "in-progress") return "in_progress";
  if (status === "on-hold") return "on_hold";
  return status;
}

function toDisplayDueDate(dateInputValue) {
  if (!dateInputValue) return undefined;
  return new Date(`${dateInputValue}T00:00:00`).toLocaleDateString();
}

const SortableTaskCard = ({ task, onToggleStatus, onClick, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const assigneeLabel = task?.assigneeLabel || "Unassigned";
  const isArchived = task.status === ARCHIVE_COLUMN_ID;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""}>
      <div
        className={`p-3 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer ${task.status === "done" ? "opacity-60" : ""
          }`}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex items-center gap-2 pt-0.5 flex-shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <Checkbox
              checked={task.status === "done"}
              onCheckedChange={() => onToggleStatus(task.id)}
            />
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-start gap-2">
              <div className="flex flex-1 min-w-0 items-center gap-2 flex-wrap">
                <span
                  className={`font-medium truncate ${task.status === "done"
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                    }`}
                >
                  {task.title}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs flex-shrink-0 ${priorityColors[task.priority] || priorityColors.medium}`}
                >
                  {task.priority}
                </Badge>
              </div>

              {isArchived && onDelete ? (
                <button
                  type="button"
                  aria-label={`Delete ${task.title}`}
                  className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(task.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {task.description ? (
              <p className="text-sm text-muted-foreground mt-1 truncate">{task.description}</p>
            ) : null}

            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-muted truncate max-w-[100px]">
                {task.category}
              </span>
              <span className="truncate">{assigneeLabel}</span>
              {task.recurrenceEnabled ? (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <Repeat className="h-3 w-3" />
                  <span className="truncate">{task.recurrenceLabel || "Repeats"}</span>
                </span>
              ) : null}
              {task.dueDate ? (
                <span
                  className={`flex-shrink-0 ${task.dueDate === "Today" ? "text-terracotta font-medium" : ""}`}
                >
                  {task.dueDate}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TaskOverlayCard = ({ task }) => (
  <div className="p-3 rounded-lg border bg-card shadow-xl ring-2 ring-primary/20 w-72">
    <div className="flex items-center gap-2">
      <span className="font-medium truncate text-foreground">{task.title}</span>
      <Badge variant="outline" className={`text-xs flex-shrink-0 ${priorityColors[task.priority] || priorityColors.medium}`}>
        {task.priority}
      </Badge>
    </div>
  </div>
);

const DroppableColumn = ({
  id,
  title,
  colorClass,
  tasks,
  isExpanded,
  onToggleExpand,
  onToggleStatus,
  onClickTask,
  onDeleteTask,
  onAddTask,
  showArchiveButton,
  isArchiveVisible,
  onToggleArchive,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hasOverflow = tasks.length > MAX_VISIBLE_TASKS_PER_COLUMN;
  const visibleTasks = hasOverflow && !isExpanded ? tasks.slice(0, MAX_VISIBLE_TASKS_PER_COLUMN) : tasks;
  const hiddenCount = tasks.length - visibleTasks.length;

  return (
    <Card className={`border-border min-w-0 transition-colors ${isOver ? "ring-2 ring-primary/30 bg-primary/5" : ""}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colorClass}`} />
          <span className="truncate">{title}</span>
          <Badge variant="secondary" className="ml-auto flex-shrink-0">
            {tasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent ref={setNodeRef} className="space-y-3 min-h-[60px]">
        <SortableContext items={visibleTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {visibleTasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onToggleStatus={onToggleStatus}
              onClick={() => onClickTask(task)}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>

        {hasOverflow ? (
          <Button
            variant="ghost"
            className="w-full border border-border text-muted-foreground hover:text-foreground"
            onClick={onToggleExpand}
          >
            {isExpanded ? "Show less" : `+${hiddenCount} more`}
          </Button>
        ) : null}

        {id === "todo" && onAddTask ? (
          <Button
            variant="ghost"
            className="w-full border-2 border-dashed border-border text-muted-foreground hover:text-foreground"
            onClick={onAddTask}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Task
          </Button>
        ) : null}

        {showArchiveButton ? (
          <Button
            variant="ghost"
            className="w-full border border-border text-muted-foreground hover:text-foreground"
            onClick={onToggleArchive}
          >
            {isArchiveVisible ? "Hide Archive" : "Show Archive"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
};

const Tasks = () => {
  const location = useLocation();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(() => {
    try {
      const selectedHouseholdRaw = localStorage.getItem("household");
      if (!selectedHouseholdRaw) return ALL_HOUSEHOLDS_VALUE;
      const selectedHousehold = JSON.parse(selectedHouseholdRaw);
      const householdId = selectedHousehold?.household_id ?? selectedHousehold?.id ?? selectedHousehold;
      return householdId ? String(householdId) : ALL_HOUSEHOLDS_VALUE;
    } catch {
      return ALL_HOUSEHOLDS_VALUE;
    }
  });

  const selectedHouseholdFilter =
    selectedHouseholdId === ALL_HOUSEHOLDS_VALUE ? null : selectedHouseholdId;

  const { households } = useHousehold();
  const {
    tasks,
    setTasks,
    loading,
    loadingMore,
    error,
    total,
    hasMore,
    loadMoreTasks,
  } = useTaskboardTasks(selectedHouseholdFilter);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [dragStartColumn, setDragStartColumn] = useState(null);
  const [dragSnapshot, setDragSnapshot] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState({});

  const visibleColumns = showArchive
    ? columns
    : columns.filter((column) => column.id !== ARCHIVE_COLUMN_ID);

  const rawSearchQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get("search") || "").trim();
  }, [location.search]);

  const searchTerm = useMemo(() => {
    return normalizeSearchValue(rawSearchQuery);
  }, [rawSearchQuery]);

  const activeSearchFilters = useMemo(
    () => parseTaskSearchQuery(rawSearchQuery),
    [rawSearchQuery]
  );

  const activeSearchBadges = useMemo(
    () => buildSearchFilterBadges(activeSearchFilters),
    [activeSearchFilters]
  );

  const filteredTasks = useMemo(
    () => tasks.filter((task) => taskMatchesFilters(task, activeSearchFilters)),
    [activeSearchFilters, tasks]
  );

  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId) || null
    : null;

  const toggleExpandedColumn = (columnId) => {
    setExpandedColumns((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  useEffect(() => {
    if (!selectedHouseholdFilter) return;
    if (!Array.isArray(households) || households.length === 0) return;

    const exists = households.some(
      (household) => String(household.household_id) === selectedHouseholdFilter
    );

    if (!exists) {
      queueMicrotask(() => setSelectedHouseholdId(ALL_HOUSEHOLDS_VALUE));
    }
  }, [selectedHouseholdFilter, households]);

  useEffect(() => {
    if (!selectedHouseholdFilter) return;

    const selectedHousehold = (households || []).find(
      (household) => String(household.household_id) === selectedHouseholdFilter
    );

    if (!selectedHousehold) return;
    localStorage.setItem("household", JSON.stringify(selectedHousehold));
  }, [selectedHouseholdFilter, households]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  const handleUpdateTaskDetails = (taskId, updates) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
  };

  const handleToggleStatus = async (id) => {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return;

    const rollbackTasks = tasks;
    const currentStatus = currentTask.status;
    const nextStatus = currentStatus === "done" ? "todo" : "done";

    setSyncError(null);
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, status: nextStatus } : task))
    );

    await persistTaskStatus(id, nextStatus, rollbackTasks);
  };

  const handleUpdateTaskStatus = async (taskId, nextStatus) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || !nextStatus) return;

    const rollbackTasks = tasks;
    setSyncError(null);

    handleUpdateTaskDetails(taskId, { status: nextStatus });

    try {
      await updateKanbanTaskStatus(taskId, toApiStatus(nextStatus));
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const handleAddTask = useCallback(
    (newTask) => {
      const taskHouseholdId = newTask?.householdId ? String(newTask.householdId) : null;
      const shouldShowInCurrentView =
        !selectedHouseholdFilter || taskHouseholdId === selectedHouseholdFilter;

      if (!shouldShowInCurrentView) return;
      setTasks((prev) => [newTask, ...prev]);
    },
    [selectedHouseholdFilter, setTasks]
  );

  useEffect(() => {
    const handleTaskCreated = (event) => {
      const newTask = event?.detail;
      if (!newTask) return;
      handleAddTask(newTask);
    };

    window.addEventListener(TASK_CREATED_EVENT, handleTaskCreated);
    return () => window.removeEventListener(TASK_CREATED_EVENT, handleTaskCreated);
  }, [handleAddTask]);

  const handleUpdateTaskPriority = async (taskId, nextPriority) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    handleUpdateTaskDetails(taskId, { priority: nextPriority });

    try {
      await updateKanbanTaskPriority(taskId, nextPriority);
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const handleUpdateTaskDueDate = async (taskId, dueDateInputValue) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    handleUpdateTaskDetails(taskId, {
      dueDateValue: dueDateInputValue || null,
      dueDate: toDisplayDueDate(dueDateInputValue),
    });

    try {
      const dueDateIso = toUtcDateOnlyIso(dueDateInputValue);
      await updateKanbanTaskDueDate(taskId, dueDateIso);
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const handleUpdateTaskRecurrence = async (taskId, recurrenceFrequency, recurrenceInterval, recurrenceEndDate = null) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    handleUpdateTaskDetails(taskId, {
      recurrenceEnabled: Boolean(recurrenceFrequency),
      recurrenceFrequency: recurrenceFrequency || null,
      recurrenceInterval: recurrenceFrequency ? (recurrenceInterval || 1) : null,
      recurrenceEndDate: recurrenceFrequency ? recurrenceEndDate : null,
      recurrenceLabel: recurrenceFrequency
        ? formatTaskRecurrence(recurrenceFrequency, recurrenceInterval || 1)
        : "",
    });

    try {
      await updateKanbanTaskRecurrence(taskId, recurrenceFrequency || null, recurrenceInterval || 1, recurrenceEndDate);
      window.dispatchEvent(new Event("kanban-task-updated"));
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const handleSkipTaskOccurrence = async (taskId, occurrenceDate) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    const targetTask = tasks.find((task) => String(task.id) === String(taskId));
    if (!targetTask || !occurrenceDate) return;

    try {
      const result = await skipKanbanTaskOccurrence(taskId, occurrenceDate);
      const nextDueDateIso = result?.next_due_date
        ? new Date(result.next_due_date).toISOString().slice(0, 10)
        : targetTask.dueDateValue;

      handleUpdateTaskDetails(taskId, {
        dueDateValue: nextDueDateIso || null,
        dueDate: nextDueDateIso ? toDisplayDueDate(nextDueDateIso) : undefined,
      });

      window.dispatchEvent(new Event("kanban-task-updated"));
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const handleUpdateTaskDescription = async (taskId, nextDescription) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    handleUpdateTaskDetails(taskId, { description: nextDescription || "" });

    try {
      await updateKanbanTaskDescription(taskId, nextDescription || null);
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const handleUpdateTaskTitle = async (taskId, nextTitle) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    handleUpdateTaskDetails(taskId, { title: nextTitle });

    try {
      await updateKanbanTaskName(taskId, nextTitle);
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const handleUpdateTaskAssignee = async (taskId, assigneeId, assigneeLabel) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    handleUpdateTaskDetails(taskId, {
      assigneeId: assigneeId || undefined,
      assigneeLabel: assigneeLabel || "Unassigned",
    });

    try {
      await updateKanbanTaskAssignee(taskId, assigneeId || null);
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const handleUpdateTaskCategory = async (taskId, nextCategory) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    handleUpdateTaskDetails(taskId, { category: nextCategory || "Other" });

    try {
      await updateKanbanTaskCategory(taskId, nextCategory || null);
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const handleDeleteTask = async (taskId) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setSelectedTaskId(null);

    try {
      await deleteKanbanTask(taskId);
    } catch (syncException) {
      setTasks(rollbackTasks);
      setSyncError(syncException);
    }
  };

  const findColumnForTask = (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    return task ? task.status : undefined;
  };

  const handleDragStart = (event) => {
    const taskId = String(event.active.id);
    setActiveId(taskId);
    setDragStartColumn(findColumnForTask(taskId));
    setDragSnapshot(tasks);
    setSyncError(null);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = String(active.id);
    const overId = String(over.id);

    const isOverColumn = visibleColumns.some((column) => column.id === overId);
    const targetColumn = isOverColumn ? overId : findColumnForTask(overId);
    if (!targetColumn) return;

    const activeColumn = findColumnForTask(activeTaskId);
    if (activeColumn !== targetColumn) {
      setTasks((prev) =>
        prev.map((task) => (task.id === activeTaskId ? { ...task, status: targetColumn } : task))
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
    const overId = String(over.id);

    const isOverColumn = visibleColumns.some((column) => column.id === overId);
    const targetColumn = isOverColumn ? overId : findColumnForTask(overId);
    const overColumn = isOverColumn ? overId : findColumnForTask(overId);
    const movedAcrossColumns =
      Boolean(dragStartColumn) && Boolean(overColumn) && dragStartColumn !== overColumn;

    if (!movedAcrossColumns && !isOverColumn && activeIdValue !== overId && dragStartColumn) {
      const columnTasks = tasks.filter((task) => task.status === dragStartColumn);
      const oldIndex = columnTasks.findIndex((task) => task.id === activeIdValue);
      const newIndex = columnTasks.findIndex((task) => task.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedColumnTasks = arrayMove(columnTasks, oldIndex, newIndex);
        const orderedTaskIds = reorderedColumnTasks.map((task) => task.id);

        let reorderCursor = 0;
        const nextTasks = tasks.map((task) => {
          if (task.status !== dragStartColumn) return task;
          const reorderedTask = reorderedColumnTasks[reorderCursor];
          reorderCursor += 1;
          return reorderedTask;
        });

        setTasks(nextTasks);
        await persistTaskOrder(dragStartColumn, orderedTaskIds, dragSnapshot);
      }
    }

    if (movedAcrossColumns && targetColumn) {
      await persistTaskStatus(activeIdValue, targetColumn, dragSnapshot);
    }

    setDragStartColumn(null);
    setDragSnapshot(null);
  };

  const activeTask = tasks.find((task) => task.id === activeId);

  const getColumnTasks = (status) =>
    status === ARCHIVE_COLUMN_ID
      ? filteredTasks.filter((task) => task.status === ARCHIVE_COLUMN_ID)
      : filteredTasks.filter((task) => task.status === status);

  if (!Array.isArray(households) || households.length === 0) {
    return <NoHouseholdState />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center"
      >
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <ListTodo className="h-7 w-7 text-primary" /> Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
            Drag tasks between columns to update status. 
          </p>
          {loading ? <p className="text-sm text-muted-foreground mt-2">Loading tasks…</p> : null}
          {error?.status === 401 ? (
            <p className="text-sm text-red-600 mt-2">Your session has expired. Please log in again.</p>
          ) : error ? (
            <p className="text-sm text-red-600 mt-2">Couldn’t load tasks. Check console/network.</p>
          ) : null}
          {syncError ? (
            <p className="text-sm text-red-600 mt-2">Couldn’t sync task changes. Changes were reverted.</p>
          ) : null}
        </div>

        <div className="w-full max-w-[280px]">
          <label htmlFor="tasks-household-filter" className="text-xs text-muted-foreground">
            Household view
          </label>
          <Select value={selectedHouseholdId} onValueChange={setSelectedHouseholdId}>
            <SelectTrigger
              id="tasks-household-filter"
              className="mt-1 text-muted-foreground"
            >
              <SelectValue placeholder="Select household" />
            </SelectTrigger>
            <SelectContent className="text-muted-foreground">
              <SelectItem value={ALL_HOUSEHOLDS_VALUE} className="text-muted-foreground">
                All households
              </SelectItem>
              {(households || []).map((household) => (
                <SelectItem
                  key={household.household_id}
                  value={String(household.household_id)}
                  className="text-muted-foreground"
                >
                  {household.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Motion.div>

      {!loading && tasks.length > 0 ? (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <span className="block">
              {searchTerm
                ? `Showing ${filteredTasks.length} matching tasks from ${tasks.length} loaded`
                : `Showing ${tasks.length} of ${total} tasks`}
            </span>
            {activeSearchBadges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeSearchBadges.map((badge) => (
                  <Badge key={badge.key} variant="outline" className="bg-background">
                    {badge.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          {hasMore ? (
            <Button
              variant="outline"
              onClick={() => loadMoreTasks().catch(() => {})}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load More"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!loading && tasks.length > 0 && searchTerm && filteredTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          No tasks matched "{rawSearchQuery}". Try a task title, category, or assignee, and combine it with filters like `overdue`, `high`, `done`, or `recurring`.
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`grid grid-cols-1 sm:grid-cols-2 ${showArchive ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}
        >
          {visibleColumns.map((column) => (
            <DroppableColumn
              key={column.id}
              id={column.id}
              title={column.title}
              colorClass={column.colorClass}
              tasks={getColumnTasks(column.id)}
              isExpanded={Boolean(expandedColumns[column.id])}
              onToggleExpand={() => toggleExpandedColumn(column.id)}
              onToggleStatus={handleToggleStatus}
              onClickTask={(task) => setSelectedTaskId(task?.id ?? null)}
              onDeleteTask={handleDeleteTask}
              onAddTask={column.id === "todo" ? () => setIsAddDialogOpen(true) : undefined}
              showArchiveButton={column.id === "done"}
              isArchiveVisible={showArchive}
              onToggleArchive={() => setShowArchive((prev) => !prev)}
            />
          ))}
        </Motion.div>

        <DragOverlay>{activeTask ? <TaskOverlayCard task={activeTask} /> : null}</DragOverlay>
      </DndContext>

      <AddTaskDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddTask={handleAddTask}
        householdId={selectedHouseholdFilter}
        households={households}
      />

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTaskId && !!selectedTask}
        households={households}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        onUpdateTask={handleUpdateTaskDetails}
        onUpdateTaskStatus={handleUpdateTaskStatus}
        onUpdateTaskPriority={handleUpdateTaskPriority}
        onUpdateTaskDueDate={handleUpdateTaskDueDate}
        onUpdateTaskDescription={handleUpdateTaskDescription}
        onUpdateTaskTitle={handleUpdateTaskTitle}
        onUpdateTaskAssignee={handleUpdateTaskAssignee}
        onUpdateTaskCategory={handleUpdateTaskCategory}
        onUpdateTaskRecurrence={handleUpdateTaskRecurrence}
        onSkipTaskOccurrence={handleSkipTaskOccurrence}
        onDeleteTask={handleDeleteTask}
      />
    </div>
  );
};

export default Tasks;
