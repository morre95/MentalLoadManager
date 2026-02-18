import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function toDateInputValue(value) {
  if (!value) return "";
  if (value === "Today") {
    return new Date().toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

const TaskDetailDialog = ({
  task,
  open,
  onOpenChange,
  onToggleStatus,
  onUpdateTask,
  onUpdateTaskPriority,
  onUpdateTaskDueDate,
  onUpdateTaskDescription,
  onUpdateTaskTitle,
}) => {
  const status = statusConfig[task?.status] || statusConfig.todo;
  const StatusIcon = status.icon;
  const [editingField, setEditingField] = useState(null);
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");

  const normalizedPriority = useMemo(() => {
    const value = String(task?.priority || "medium").toLowerCase();
    if (value === "low" || value === "high") return value;
    return "medium";
  }, [task?.priority]);

  if (!task) return null;

  const saveAssignee = () => {
    const nextAssignee = assigneeDraft.trim() || "Unassigned";
    onUpdateTask?.(task.id, { assignee: nextAssignee });
    setEditingField(null);
  };

  const saveCategory = () => {
    const nextCategory = categoryDraft.trim() || "Other";
    onUpdateTask?.(task.id, { category: nextCategory });
    setEditingField(null);
  };

  const saveDueDate = () => {
    if (onUpdateTaskDueDate) {
      onUpdateTaskDueDate(task.id, dueDateDraft || null);
    } else {
      const dueDate = dueDateDraft
        ? new Date(`${dueDateDraft}T00:00:00`).toLocaleDateString()
        : undefined;
      onUpdateTask?.(task.id, { dueDate });
    }
    setEditingField(null);
  };

  const saveDescription = () => {
    const nextDescription = descriptionDraft.trim();
    if (onUpdateTaskDescription) {
      onUpdateTaskDescription(task.id, nextDescription || null);
    } else {
      onUpdateTask?.(task.id, { description: nextDescription });
    }
    setEditingField(null);
  };

  const saveTitle = () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleDraft(task.title || "");
      setEditingField(null);
      return;
    }
    if (onUpdateTaskTitle) {
      onUpdateTaskTitle(task.id, nextTitle);
    } else {
      onUpdateTask?.(task.id, { title: nextTitle });
    }
    setEditingField(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" key={task.id}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${status.color}`} />
            {editingField === "title" ? (
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitleDraft(task.title || "");
                    setEditingField(null);
                  }
                }}
                autoFocus
                className="h-9"
              />
            ) : (
              <button
                type="button"
                className="text-left"
                onClick={() => {
                  setTitleDraft(task.title || "");
                  setEditingField("title");
                }}
              >
                {task.title}
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5 mt-2"
        >
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Description
            </p>
            {editingField === "description" ? (
              <div className="space-y-2">
                <Textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={4}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingField(null);
                      setDescriptionDraft(task.description || "");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveDescription}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-foreground text-left w-full rounded-md hover:bg-muted/40 p-2 -ml-2"
                onClick={() => {
                  setDescriptionDraft(task.description || "");
                  setEditingField("description");
                }}
              >
                {task.description || "Click to add description"}
              </button>
            )}
          </div>

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
                {editingField === "priority" ? (
                  <Select
                    value={normalizedPriority}
                    onValueChange={(nextPriority) => {
                      onUpdateTaskPriority?.(task.id, nextPriority);
                      setEditingField(null);
                    }}
                  >
                    <SelectTrigger className="h-8 w-36 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => setEditingField("priority")}
                  >
                    <Badge
                      variant="outline"
                      className={`text-xs ${priorityColors[task.priority] || priorityColors.medium}`}
                    >
                      {task.priority || "medium"}
                    </Badge>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Assigned to</p>
                {editingField === "assignee" ? (
                  <Input
                    value={assigneeDraft}
                    onChange={(e) => setAssigneeDraft(e.target.value)}
                    onBlur={saveAssignee}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveAssignee();
                      if (e.key === "Escape") {
                        setAssigneeDraft(task.assignee || "");
                        setEditingField(null);
                      }
                    }}
                    autoFocus
                    className="h-8 mt-1 w-40"
                  />
                ) : (
                  <button
                    type="button"
                    className="text-sm font-medium text-foreground text-left"
                    onClick={() => {
                      setAssigneeDraft(task.assignee || "");
                      setEditingField("assignee");
                    }}
                  >
                    {task.assignee}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                {editingField === "category" ? (
                  <Input
                    value={categoryDraft}
                    onChange={(e) => setCategoryDraft(e.target.value)}
                    onBlur={saveCategory}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCategory();
                      if (e.key === "Escape") {
                        setCategoryDraft(task.category || "");
                        setEditingField(null);
                      }
                    }}
                    autoFocus
                    className="h-8 mt-1 w-40"
                  />
                ) : (
                  <button
                    type="button"
                    className="text-sm font-medium text-foreground text-left"
                    onClick={() => {
                      setCategoryDraft(task.category || "");
                      setEditingField("category");
                    }}
                  >
                    {task.category}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Due Date</p>
              {editingField === "dueDate" ? (
                <Input
                  type="date"
                  value={dueDateDraft}
                  onChange={(e) => setDueDateDraft(e.target.value)}
                  onBlur={saveDueDate}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveDueDate();
                    if (e.key === "Escape") {
                      setDueDateDraft(toDateInputValue(task.dueDate));
                      setEditingField(null);
                    }
                  }}
                  autoFocus
                  className="h-8 mt-1 w-44"
                />
              ) : (
                <button
                  type="button"
                  className={`text-sm font-medium text-left ${task.dueDate === "Today" ? "text-terracotta" : "text-foreground"}`}
                  onClick={() => {
                    setDueDateDraft(toDateInputValue(task.dueDate));
                    setEditingField("dueDate");
                  }}
                >
                  {task.dueDate || "No due date"}
                </button>
              )}
            </div>
          </div>

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
