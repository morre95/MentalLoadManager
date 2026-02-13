import { motion } from "framer-motion";
import {
    CheckCircle2,
    Circle,
    Clock,
    PauseCircle,
    MoreHorizontal,
} from "lucide-react";

const mockTasks = [
    { id: "1", title: "Grocery shopping", assignee: "Maria", category: "Shopping", color: "terracotta", status: "todo" },
    { id: "2", title: "Schedule dentist", assignee: "Erik", category: "Health", color: "lavender", status: "todo" },
    { id: "3", title: "Pay electricity bill", assignee: "Maria", category: "Bills", color: "sky", status: "todo" },
    { id: "4", title: "Plan weekend trip", assignee: "Erik", category: "Family", color: "sage", status: "in-progress" },
    { id: "5", title: "Kids' school forms", assignee: "Maria", category: "Admin", color: "sand", status: "in-progress" },
    { id: "8", title: "Wait for plumber quote", assignee: "Erik", category: "Maintenance", color: "terracotta", status: "on-hold" },
    { id: "6", title: "Book vet appointment", assignee: "Erik", category: "Pets", color: "lavender", status: "done" },
    { id: "7", title: "Renew car insurance", assignee: "Maria", category: "Bills", color: "sky", status: "done" },
];

const columns = [
    { id: "todo", title: "To Do", icon: Circle },
    { id: "in-progress", title: "In Progress", icon: Clock },
    { id: "on-hold", title: "On Hold", icon: PauseCircle },
    { id: "done", title: "Done", icon: CheckCircle2 },
];

const categoryColors = {
    terracotta: "bg-terracotta-light text-terracotta border-terracotta/30",
    lavender: "bg-lavender-light text-lavender border-lavender/30",
    sky: "bg-sky-light text-sky border-sky/30",
    sage: "bg-sage-light text-sage border-sage/30",
    sand: "bg-sand-light text-sand border-sand/30",
};

const TaskCard = ({ task, index }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-card rounded-lg p-3 shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer group"
    >
        <div className="flex items-start justify-between mb-2">
            <span
                className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[task.color] || categoryColors.sky
                    }`}
            >
                {task.category}
            </span>
            <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>
        </div>
        <h4 className="text-sm font-medium text-foreground mb-2">{task.title}</h4>
        <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[10px] font-medium text-primary">
                    {task.assignee[0]}
                </span>
            </div>
            <span className="text-xs text-muted-foreground">{task.assignee}</span>
        </div>
    </motion.div>
);

const KanbanBoard = () => {
    const tasksByStatus = (status) => mockTasks.filter((t) => t.status === status);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">Task Board</h3>
                <button type="button" className="text-xs text-primary hover:underline">
                    View all
                </button>
            </div>

            {/* 4 columns now */}
            <div className="flex-1 grid grid-cols-4 gap-3 min-h-0">
                {columns.map((column) => {
                    const Icon = column.icon;
                    const colTasks = tasksByStatus(column.id);

                    return (
                        <div key={column.id} className="flex flex-col min-h-0">
                            <div className="flex items-center gap-2 mb-3">
                                <Icon
                                    className={`w-4 h-4 ${column.id === "todo"
                                            ? "text-status-todo"
                                            : column.id === "in-progress"
                                                ? "text-status-doing"
                                                : column.id === "on-hold"
                                                    ? "text-[hsl(var(--lavender))]"
                                                    : "text-status-done"
                                        }`}
                                />
                                <span className="text-xs font-medium text-foreground">
                                    {column.title}
                                </span>
                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                    {colTasks.length}
                                </span>
                            </div>

                            <div className="flex-1 space-y-2 overflow-y-auto">
                                {colTasks.map((task, index) => (
                                    <TaskCard key={task.id} task={task} index={index} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default KanbanBoard;
