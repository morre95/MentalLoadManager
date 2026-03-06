import { useCallback, useEffect, useState } from "react";
import { isUserLoggedIn } from "@/lib/auth";
import { fetchKanbanTasks } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function useTaskboardTasks(householdId) {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isUserLoggedIn()) {
      setTasks([]);
      setLoading(false);
      return [];
    }

    try {
      const data = await fetchKanbanTasks(householdId || undefined);
      const uiTasks = Array.isArray(data?.tasks) ? data.tasks : [];
      setTasks(uiTasks);
      return uiTasks;
    } catch (err) {
      if (err?.status === 401) {
        navigate("/login", { replace: true });
        return [];
      }

      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [navigate, householdId]);

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

  return {
    tasks,
    setTasks,
    loading,
    error,
    refreshTasks: loadTasks,
  };
}
