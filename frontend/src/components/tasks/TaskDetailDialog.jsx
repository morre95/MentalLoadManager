import { motion } from "framer-motion";
import {
    Clock,
    AlertCircle,
    Check,
    Calendar,
    User,
    Tag,
    Flag,
    PauseCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const priorityColors = {
    low: "bg-sage-light text-sage border-sage/30",
    medium: "bg-status-todo/15 text-status-todo border-status-todo/30",
    high: "bg-terracotta-light text-terracotta border-terracotta/30",
};

const statusConfig = {
    todo: { icon: Clock, label: "To Do", color: "bg-status-todo" },
    "in-progress": { icon: AlertCircle, label: "In Progress", color: "bg-status-doing" },
    "on-hold": { icon: PauseCircle, label: "On Hold", color: "bg-[hsl(var(--lavender))]" },
    done: { icon: Check, label: "Done", color: "bg-status-done" },
};

const TaskDetailDialog = ({ task, open, onOpenChange, onToggleStatus }) => {
    if (!task) return null;

    const status = statusConfig[task.status] || statusConfig.todo;
    const StatusIcon = status.icon;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${status.color}`} />
                        {task.title}
                    </DialogTitle>
                </DialogHeader>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5 mt-2"
                >
                    {task.description ? (
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                Description
                            </p>
                            <p className="text-foreground">{task.description}</p>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <StatusIcon className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Status</p>
                                <p className="text-sm font-medium text-foreground">{status.label}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Flag className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Priority</p>
                                <Badge
                                    variant="outline"
                                    className={`text-xs ${priorityColors[task.priority] || priorityColors.medium}`}
                                >
                                    {task.priority || "medium"}
                                </Badge>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Assigned to</p>
                                <p className="text-sm font-medium text-foreground">{task.assignee}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Category</p>
                                <p className="text-sm font-medium text-foreground">{task.category}</p>
                            </div>
                        </div>
                    </div>

                    {task.dueDate ? (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Due Date</p>
                                <p
                                    className={`text-sm font-medium ${task.dueDate === "Today" ? "text-terracotta" : "text-foreground"
                                        }`}
                                >
                                    {task.dueDate}
                                </p>
                            </div>
                        </div>
                    ) : null}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                        <Button
                            onClick={() => {
                                onToggleStatus(task.id);
                                onOpenChange(false);
                            }}
                        >
                            {task.status === "done" ? "Reopen Task" : "Mark as Done"}
                        </Button>
                    </div>
                </motion.div>
            </DialogContent>
        </Dialog>
    );
};

export default TaskDetailDialog;
