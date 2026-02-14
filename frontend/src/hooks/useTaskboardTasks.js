import { useEffect, useState } from "react";
import { fetchKanbanTasks, isUserLoggedIn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

function normalizeStatus(s) {
    const v = String(s || "todo").toLowerCase();
    if (v === "in_progress") return "in-progress";
    if (v === "on_hold") return "on-hold";
    return v;
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
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleDateString();
}

function mapApiTaskToUi(t) {
    return {
        id: String(t.task_id),
        title: t.name || "",
        description: undefined,
        status: normalizeStatus(t.status),
        priority: normalizePriority(t),
        assignee: t.assignee_name || "Unassigned",
        dueDate: formatDueDate(t.due_date),
        category: t.category_name || "Other",
    };
}

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
                if (!alive) return;
                setTasks([]);
                setLoading(false);
                return;
            }

            try {
                const data = await fetchKanbanTasks();
                const uiTasks = Array.isArray(data?.tasks) ? data.tasks.map(mapApiTaskToUi) : [];
                if (!alive) return;
                setTasks(uiTasks);
            } catch (e) {
                if (!alive) return;

                // ✅ redirect on unauthorized
                if (e?.status === 401) {
                    navigate("/login", { replace: true });
                    return;
                }

                setError(e);
            } finally {
                if (!alive) return;
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
