import { useMemo, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";

import { updateKanbanTaskOrder, updateKanbanTaskStatus } from "@/lib/utils";

const DEFAULT_VISIBLE_TASKS_PER_COLUMN = 5;

function toApiStatus(status) {
  return status === "in-progress" ? "in_progress" : status;
}

function normalizeColumnStatus(status) {
  return status === "on-hold" ? "archive" : String(status || "todo");
}

export function useMiniTaskboardDnd({ columns, tasks, setTasks }) {
  const [activeId, setActiveId] = useState(null);
  const [dragStartColumn, setDragStartColumn] = useState(null);
  const [dragSnapshot, setDragSnapshot] = useState(null);
  const [pinnedVisibleTaskId, setPinnedVisibleTaskId] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const grouped = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      tasks: (() => {
        const columnTasks = tasks
          .filter((task) => normalizeColumnStatus(task?.status) === column.id)
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
        prev.map((task) =>
          String(task.id) === activeTaskId
            ? { ...task, status: targetColumn }
            : task
        )
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

  return {
    activeTask,
    grouped,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    syncError,
  };
}
