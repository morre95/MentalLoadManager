import { useEffect, useState } from "react";
import { GET_API_BASE_URL } from "@/components/ui/base_url";
import { getAccessToken, isUserLoggedIn } from "@/lib/utils";

const API_BASE_URL = GET_API_BASE_URL();

// Mock tasks used whenever the user is logged out
const mockTasks = [
    { id: "1", title: "Grocery shopping", description: "Weekly groceries from the supermarket", status: "todo", priority: "high", assignee: "Maria", dueDate: "Today", category: "Shopping" },
    { id: "2", title: "Pay electricity bill", description: "Due by end of week", status: "todo", priority: "high", assignee: "Erik", dueDate: "Feb 12", category: "Admin" },
    { id: "3", title: "Clean bathroom", status: "in-progress", priority: "medium", assignee: "Maria", category: "Cleaning" },
    { id: "4", title: "Schedule dentist appointment", status: "todo", priority: "low", assignee: "Erik", category: "Health" },
    { id: "5", title: "Laundry", description: "Wash and fold weekly laundry", status: "done", priority: "medium", assignee: "Maria", category: "Cleaning" },
    { id: "6", title: "Fix leaky faucet", status: "in-progress", priority: "medium", assignee: "Erik", category: "Maintenance" },
    { id: "7", title: "Plan weekend meals", status: "done", priority: "low", assignee: "Maria", category: "Planning" },
    { id: "8", title: "Wait for plumber quote", status: "on-hold", priority: "medium", assignee: "Erik", category: "Maintenance" },
];

// Convert API status -> UI status
function mapStatus(apiStatus) {
    const s = String(apiStatus || "").toLowerCase();

    // If your backend already returns these exact values, this will just pass through.
    if (s === "todo") return "todo";
    if (s === "in-progress" || s === "in_progress" || s === "doing") return "in-progress";
    if (s === "on-hold" || s === "on_hold" || s === "hold" || s === "paused") return "on-hold";
    if (s === "done" || s === "completed") return "done";

    // Fallback: treat unknown as todo
    return "todo";
}

// Format ISO date -> nice short label
function formatDueDate(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";

    // If it's today, show "Today"
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();

    if (sameDay) return "Today";

    // Otherwise show something compact like "Feb 13"
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeTask(apiTask) {
    return {
        id: String(apiTask.task_id),
        title: apiTask.name || "",
        description: "", // your API doesn't include it (yet)
        status: mapStatus(apiTask.status),
        priority: "medium", // your API doesn't include priority (yet)
        assignee: apiTask.assignee_name || "Unassigned",
        dueDate: formatDueDate(apiTask.due_date),
        category: apiTask.category_name || "General",
    };
}

export function useTaskboardTasks() {
    const [tasks, setTasks] = useState(mockTasks);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchTasks = async () => {
        setError(null);

        // Logged out -> mock tasks
        if (!isUserLoggedIn()) {
            setTasks(mockTasks);
            return;
        }

        const token = getAccessToken();
        setLoading(true);

        try {
            // ✅ Updated endpoint
            const res = await fetch(`${API_BASE_URL}/api/kanban/tasks`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `Failed to fetch tasks (${res.status})`);
            }

            const data = await res.json();

            // ✅ Your shape is { tasks: [...] }
            const list = Array.isArray(data?.tasks) ? data.tasks : [];

            setTasks(list.map(normalizeTask));
        } catch (e) {
            setError(e.message || "Failed to fetch tasks");
            setTasks(mockTasks); // fallback
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();

        // Refresh on login/logout if you dispatch "auth:changed"
        const onAuthChanged = () => fetchTasks();
        window.addEventListener("auth:changed", onAuthChanged);
        return () => window.removeEventListener("auth:changed", onAuthChanged);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { tasks, setTasks, loading, error, refresh: fetchTasks };
}
