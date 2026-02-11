import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    CheckCircle2,
    Circle,
    Clock,
    PauseCircle,
    MoreHorizontal,
} from "lucide-react";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ---------- Mock tasks (used when logged out / API fails) ----------
const mockTasks = [
    {
        task_id: "1",
        name: "Grocery shopping",
        status: "todo",
        due_date: "2026-02-06T12:00:00Z",
        assignee_name: "Maria",
        category_name: "Shopping",
    },
    {
        task_id: "2",
        name: "Schedule dentist",
        status: "todo",
        due_date: "2026-02-07T09:00:00Z",
        assignee_name: "Erik",
        category_name: "Health",
    },
    {
        task_id: "3",
        name: "Kids' school forms",
        status: "in_progress",
        due_date: "2026-02-06T18:00:00Z",
        assignee_name: "Maria",
        category_name: "Admin",
    },
    {
        task_id: "4",
        name: "Book vet appointment",
        status: "done",
        due_date: "2026-02-05T10:00:00Z",
        assignee_name: "Erik",
        category_name: "Pets",
    },
    {
        task_id: "5",
        name: "Renew car insurance",
        status: "on_hold",
        due_date: "2026-02-10T10:00:00Z",
        assignee_name: "Maria",
        category_name: "Bills",
    },
    {
        task_id: "6",
        name: "Grocery shopping",
        status: "todo",
        due_date: "2026-02-06T12:00:00Z",
        assignee_name: "Maria",
        category_name: "Shopping",
    },
    {
        task_id: "7",
        name: "Grocery shopping",
        status: "todo",
        due_date: "2026-02-06T12:00:00Z",
        assignee_name: "Maria",
        category_name: "Shopping",
    },
];

// ---------- UI helpers ----------
const columns = [
    { id: "todo", title: "To Do", icon: Circle },
    { id: "in_progress", title: "In Progress", icon: Clock },
    { id: "done", title: "Done", icon: CheckCircle2 },
    { id: "on_hold", title: "On Hold", icon: PauseCircle },
];

const categoryColors = {
    Shopping: "bg-terracotta-light text-terracotta border-terracotta/30",
    Health: "bg-lavender-light text-lavender border-lavender/30",
    Bills: "bg-sky-light text-sky border-sky/30",
    Family: "bg-sage-light text-sage border-sage/30",
    Admin: "bg-sand-light text-sand border-sand/30",
    Pets: "bg-lavender-light text-lavender border-lavender/30",
};

// fallback badge style if category not in map
function getCategoryClass(categoryName) {
    return (
        categoryColors[categoryName] ||
        "bg-muted text-muted-foreground border-border"
    );
}

function getInitial(name) {
    return (name || "?").trim().slice(0, 1).toUpperCase();
}

function normalizeTasks(apiTasks) {
    if (!Array.isArray(apiTasks)) return [];

    return apiTasks.map((t) => ({
        id: t.task_id,
        title: t.name,
        status: t.status,
        dueDate: t.due_date || null,
        assignee: t.assignee_name || "Unassigned",
        category: t.category_name || "General",
    }));
}

const TaskCard = ({ task, index }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-card rounded-lg p-3 shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer group"
    >
        <div className="flex items-start justify-between mb-2">
            <span
                className={`text-xs px-2 py-0.5 rounded-full border ${getCategoryClass(
                    task.category,
                )}`}
            >
                {task.category}
            </span>

            <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                aria-label="More"
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>
        </div>

        <h4 className="text-sm font-medium text-foreground mb-2">{task.title}</h4>

        <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[10px] font-medium text-primary">
                    {getInitial(task.assignee)}
                </span>
            </div>
            <span className="text-xs text-muted-foreground">{task.assignee}</span>
        </div>
    </motion.div>
);

const KanbanBoard = () => {
    const [tasks, setTasks] = useState(normalizeTasks(mockTasks));

    useEffect(() => {
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
        if (!token) return; // logged out -> keep mock

        let cancelled = false;

        async function load() {
            try {
                const res = await fetch(`${API_BASE_URL}/kanban-board`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;

                const json = await res.json();
                const normalized = normalizeTasks(json.tasks);

                if (!cancelled && normalized.length) {
                    setTasks(normalized);
                }
            } catch (err) {
                console.error("Failed to fetch kanban tasks:", err);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, []);

    const tasksByStatus = useMemo(() => {
        const grouped = {
            todo: [],
            in_progress: [],
            done: [],
            on_hold: [],
        };

        for (const t of tasks) {
            if (grouped[t.status]) grouped[t.status].push(t);
            else grouped.todo.push(t); // fallback if unknown status
        }

        return grouped;
    }, [tasks]);

    const counts = {
        todo: tasksByStatus.todo.length,
        in_progress: tasksByStatus.in_progress.length,
        done: tasksByStatus.done.length,
        on_hold: tasksByStatus.on_hold.length,
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">
                    Task Board
                </h3>
                <button type="button" className="text-xs text-primary hover:underline">
                    View all
                </button>
            </div>

            <div className="flex-1 grid grid-cols-4 gap-3 min-h-0">
                {columns.map((column) => (
                    <div key={column.id} className="flex flex-col min-h-0">
                        <div className="flex items-center gap-2 mb-3">
                            <column.icon
                                className={`w-4 h-4 ${column.id === "todo"
                                        ? "text-status-todo"
                                        : column.id === "in_progress"
                                            ? "text-status-doing"
                                            : column.id === "done"
                                                ? "text-status-done"
                                                : "text-muted-foreground"
                                    }`}
                            />
                            <span className="text-xs font-medium text-foreground">
                                {column.title}
                            </span>

                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                {counts[column.id]}
                            </span>
                        </div>

                        <div className="flex-1 space-y-2 overflow-y-auto">
                            {tasksByStatus[column.id].map((task, index) => (
                                <TaskCard key={task.id} task={task} index={index} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KanbanBoard;
