import { useCallback, useEffect, useState } from "react";
import { motion as Motion } from "framer-motion";
import {
  ListTodo,
  Plus,
  Repeat,
  GripVertical,
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import AddTaskDialog from "@/components/tasks/AddTaskDialog";
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";

import { useTaskboardTasks } from "@/hooks/useTaskboardTasks";
import { useHousehold } from "@/hooks/useHouseHold";
import {
  deleteKanbanTask,
  formatTaskRecurrence,
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

function toApiStatus(status) {
  if (status === "in-progress") return "in_progress";
  if (status === "on-hold") return "on_hold";
  return status;
}

function toDisplayDueDate(dateInputValue) {
  if (!dateInputValue) return undefined;
  return new Date(`${dateInputValue}T00:00:00`).toLocaleDateString();
}

const SortableTaskCard = ({ task, onToggleStatus, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const assigneeLabel = task?.assigneeLabel || "Unassigned";

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
            <div className="flex items-center gap-2 flex-wrap">
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
  const { tasks, setTasks, loading, error } = useTaskboardTasks(selectedHouseholdFilter);

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

  const handleUpdateTaskRecurrence = async (taskId, recurrenceFrequency, recurrenceInterval) => {
    const rollbackTasks = tasks;
    setSyncError(null);

    handleUpdateTaskDetails(taskId, {
      recurrenceEnabled: Boolean(recurrenceFrequency),
      recurrenceFrequency: recurrenceFrequency || null,
      recurrenceInterval: recurrenceFrequency ? (recurrenceInterval || 1) : null,
      recurrenceLabel: recurrenceFrequency
        ? formatTaskRecurrence(recurrenceFrequency, recurrenceInterval || 1)
        : "",
    });

    try {
      await updateKanbanTaskRecurrence(taskId, recurrenceFrequency || null, recurrenceInterval || 1);
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
      ? tasks.filter((task) => task.status === ARCHIVE_COLUMN_ID)
      : tasks.filter((task) => task.status === status);

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
          <p className="text-muted-foreground mt-1">Drag tasks between columns to update status</p>
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
          <select
            id="tasks-household-filter"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedHouseholdId}
            onChange={(event) => setSelectedHouseholdId(event.target.value)}
          >
            <option value={ALL_HOUSEHOLDS_VALUE}>All households</option>
            {(households || []).map((household) => (
              <option key={household.household_id} value={String(household.household_id)}>
                {household.name}
              </option>
            ))}
          </select>
        </div>
      </Motion.div>

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
        onDeleteTask={handleDeleteTask}
      />
    </div>
  );
};

export default Tasks;
