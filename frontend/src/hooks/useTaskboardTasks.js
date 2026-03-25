import { useCallback, useEffect, useRef, useState } from "react";
import { fetchKanbanTasks } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const TASK_UPDATED_EVENT = "kanban-task-updated";
const DEFAULT_PAGE_SIZE = 5000;

export function useTaskboardTasks(householdId, options = {}) {
  const navigate = useNavigate();
  const pageSize = Number(options.pageSize) > 0 ? Number(options.pageSize) : DEFAULT_PAGE_SIZE;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const tasksRef = useRef([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const loadTasks = useCallback(async ({ append = false } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const currentTasks = append ? tasksRef.current : [];
      const data = await fetchKanbanTasks(householdId || undefined, {
        limit: pageSize,
        offset: currentTasks.length,
      });
      const uiTasks = Array.isArray(data?.tasks) ? data.tasks : [];
      const nextTasks = append ? [...currentTasks, ...uiTasks] : uiTasks;
      setTasks(nextTasks);
      setTotal(Number.isFinite(Number(data?.total)) ? Number(data.total) : nextTasks.length);
      return nextTasks;
    } catch (err) {
      if (err?.status === 401) {
        navigate("/login", { replace: true });
        return [];
      }

      setError(err);
      throw err;
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [navigate, householdId, pageSize]);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const nextTasks = await loadTasks();
        if (!alive) return;
        setTasks(nextTasks);
      } catch {
        if (!alive) return;
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [loadTasks]);

  useEffect(() => {
    const handleTaskUpdated = () => {
      loadTasks().catch(() => {});
    };

    window.addEventListener(TASK_UPDATED_EVENT, handleTaskUpdated);
    return () => window.removeEventListener(TASK_UPDATED_EVENT, handleTaskUpdated);
  }, [loadTasks]);

  return {
    tasks,
    setTasks,
    loading,
    loadingMore,
    error,
    total,
    hasMore: tasks.length < total,
    loadMoreTasks: () => loadTasks({ append: true }),
    refreshTasks: loadTasks,
  };
}
