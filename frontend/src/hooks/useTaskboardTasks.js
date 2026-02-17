import { useEffect, useState } from "react";
import { fetchKanbanTasks, isUserLoggedIn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function useTaskboardTasks() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      if (!isUserLoggedIn()) {
        if (alive) {
          setTasks([]);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await fetchKanbanTasks();
        const uiTasks = Array.isArray(data?.tasks) ? data.tasks : [];
        if (alive) {
          setTasks(uiTasks);
        }
      } catch (err) {
        if (alive) {
          if (err?.status === 401) {
            navigate("/login", { replace: true });
            return;
          }

          setError(err);
        }
      }

      if (alive) {
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [navigate]);

  return { tasks, setTasks, loading, error };
}
