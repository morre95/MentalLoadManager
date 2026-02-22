import { useEffect, useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import {
  Clock,
  AlertCircle,
  Check,
  Calendar,
  Home,
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
import { fetchKanbanAssignees, resolveCurrentHouseholdId } from "@/lib/utils";

import useFokus from '@/hooks/useFocus';

const priorityColors = {
  low: "bg-sage-light text-sage border-sage/30",
  medium: "bg-status-todo/15 text-status-todo border-status-todo/30",
  high: "bg-terracotta-light text-terracotta border-terracotta/30",
};

const statusConfig = {
  todo: { icon: Clock, label: "To Do", color: "bg-status-todo" },
  "in-progress": { icon: AlertCircle, label: "In Progress", color: "bg-status-doing" },
  archive: { icon: PauseCircle, label: "Archive", color: "bg-[hsl(var(--lavender))]" },
  "on-hold": { icon: PauseCircle, label: "Archive", color: "bg-[hsl(var(--lavender))]" },
  done: { icon: Check, label: "Done", color: "bg-status-done" },
};

const categories = [
  "Shopping",
  "Cleaning",
  "Admin",
  "Health",
  "Maintenance",
  "Planning",
  "Other",
];

const UNASSIGNED_ASSIGNEE_VALUE = "__unassigned__";
const CUSTOM_CATEGORY_VALUE = "__custom__";
const ARCHIVE_STATUS = "archive";

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
  households = [],
  onOpenChange,
  onUpdateTask,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
  onUpdateTaskDueDate,
  onUpdateTaskDescription,
  onUpdateTaskTitle,
  onUpdateTaskAssignee,
  onUpdateTaskCategory,
  onDeleteTask,
}) => {
  const householdName = useMemo(() => {
    if (!task?.householdId) return "Unknown household";
    const taskHouseholdId = String(task.householdId);
    const matchedHousehold = (households || []).find((household) => {
      const householdId = household?.household_id ?? household?.id;
      return String(householdId) === taskHouseholdId;
    });
    return matchedHousehold?.name || task?.householdName || "Unknown household";
  }, [households, task?.householdId, task?.householdName]);

  const status = statusConfig[task?.status] || statusConfig.todo;
  const StatusIcon = status.icon;
  const [assignees, setAssignees] = useState([]);
  const [assigneesError, setAssigneesError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("todo");
  const [priorityDraft, setPriorityDraft] = useState("medium");
  const [assigneeIdDraft, setAssigneeIdDraft] = useState(UNASSIGNED_ASSIGNEE_VALUE);
  const [categoryDraft, setCategoryDraft] = useState("Other");
  const [customCategoryDraft, setCustomCategoryDraft] = useState("");
  const [dueDateDraft, setDueDateDraft] = useState("");


  const [editingField, setEditingField] = useState(null);
  const [titleRef, setTitleFocus] = useFokus();
  const [descRef, setDescFocus] = useFokus();
  const [dueDateRef, setDueDateFocus] = useFokus();
  const [customCategoryRef, setCustomCategoryFocus] = useFokus();

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const normalizedPriority = useMemo(() => {
    const value = String(task?.priority || "medium").toLowerCase();
    if (value === "low" || value === "high") return value;
    return "medium";
  }, [task?.priority]);

  useEffect(() => {
    if (!open || !task) return;

    setTitleDraft(task.title || "");
    setDescriptionDraft(task.description || "");
    setStatusDraft(task.status === "on-hold" ? "archive" : (task.status || "todo"));
    setPriorityDraft(normalizedPriority);
    setAssigneeIdDraft(task.assigneeId || UNASSIGNED_ASSIGNEE_VALUE);
    setDueDateDraft(toDateInputValue(task.dueDate));

    const currentCategory = task.category || "Other";
    if (categories.includes(currentCategory)) {
      setCategoryDraft(currentCategory);
      setCustomCategoryDraft("");
    } else {
      setCategoryDraft(CUSTOM_CATEGORY_VALUE);
      setCustomCategoryDraft(currentCategory);
    }
  }, [open, task, normalizedPriority]);

  useEffect(() => {
    if (!open) return;

    const loadAssignees = async () => {
      const householdId = task?.householdId || await resolveCurrentHouseholdId();
      if (!householdId) {
        setAssignees([]);
        setAssigneesError("No household found. Create or join a household first.");
        return;
      }

      setAssigneesError("");
      try {
        const data = await fetchKanbanAssignees(householdId);
        const nextAssignees = Array.isArray(data?.assignees) ? data.assignees : [];
        setAssignees(nextAssignees);
      } catch (err) {
        setAssignees([]);
        setAssigneesError(err?.message || "Could not load household members.");
      }
    };

    loadAssignees();
  }, [open, task?.householdId]);

  if (!task) return null;

  const handleSave = async () => {
    if (isSaving) return;

    const nextTitle = titleDraft.trim() || task.title || "";
    const nextDescription = descriptionDraft.trim();
    const nextCategory =
      categoryDraft === CUSTOM_CATEGORY_VALUE
        ? customCategoryDraft.trim() || "Other"
        : categoryDraft;
    const nextAssigneeId =
      assigneeIdDraft === UNASSIGNED_ASSIGNEE_VALUE ? null : assigneeIdDraft;
    const selectedAssignee = assignees.find(
      (member) => member.user_id === nextAssigneeId
    );
    const nextAssigneeLabel =
      selectedAssignee?.display_name || selectedAssignee?.username || "Unassigned";

    setIsSaving(true);
    try {
      if (nextTitle !== (task.title || "")) {
        if (onUpdateTaskTitle) await onUpdateTaskTitle(task.id, nextTitle);
        else onUpdateTask?.(task.id, { title: nextTitle });
      }

      if (statusDraft !== (task.status || "todo")) {
        await onUpdateTaskStatus?.(task.id, statusDraft);
      }

      if (priorityDraft !== normalizedPriority) {
        await onUpdateTaskPriority?.(task.id, priorityDraft);
      }

      if (nextDescription !== (task.description || "")) {
        if (onUpdateTaskDescription) {
          await onUpdateTaskDescription(task.id, nextDescription || null);
        } else {
          onUpdateTask?.(task.id, { description: nextDescription });
        }
      }

      if ((nextAssigneeId || undefined) !== task.assigneeId) {
        await onUpdateTaskAssignee?.(
          task.id,
          nextAssigneeId,
          nextAssigneeLabel,
          selectedAssignee || null
        );
      }

      if (nextCategory !== (task.category || "Other")) {
        if (onUpdateTaskCategory) await onUpdateTaskCategory(task.id, nextCategory);
        else onUpdateTask?.(task.id, { category: nextCategory });
      }

      if (dueDateDraft !== toDateInputValue(task.dueDate)) {
        if (onUpdateTaskDueDate) await onUpdateTaskDueDate(task.id, dueDateDraft || null);
        else {
          const dueDate = dueDateDraft
            ? new Date(`${dueDateDraft}T00:00:00`).toLocaleDateString()
            : undefined;
          onUpdateTask?.(task.id, { dueDate });
        }
      }

      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" key={task.id}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${status.color}`} />
            {editingField === "title" ? (
              <Input
                ref={titleRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={(e) => {
                  setTitleDraft(e.target.value);
                  setEditingField(null);
                }}
                className="h-9"
              />
            ) : (
              <div
                className="text-left cursor-pointer"
                onClick={() => {
                  setEditingField("title");
                  requestAnimationFrame(() => setTitleFocus());
                }}
              >
                {titleDraft}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5 mt-2"
        >
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
            {editingField == "description" ?
              (
                <Textarea
                  ref={descRef}
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  onBlur={(e) => {
                    setDescriptionDraft(e.target.value)
                    setEditingField(null);
                  }}
                  rows={4}
                />
              ) : (
                <div
                  className="text-foreground text-left w-full rounded-md hover:bg-muted/40 p-2 -ml-2 cursor-pointer"
                  onClick={() => {
                    setEditingField("description");
                    requestAnimationFrame(() => setDescFocus());
                  }}
                >
                  {descriptionDraft}
                </div>
              )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {editingField === "status" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <StatusIcon className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Status</p>

                  <Select
                    value={statusDraft}
                    open={isStatusOpen}
                    onOpenChange={(open) => {
                      setIsStatusOpen(open);
                      if (!open) setEditingField(null);
                    }}
                    onValueChange={(value) => {
                      setStatusDraft(value);
                      setIsStatusOpen(false);
                      setEditingField(null);
                    }}
                  >
                    <SelectTrigger className="h-8 mt-1 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="archive">Archive</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer"
                onClick={() => {
                  setEditingField("status");
                  setIsStatusOpen(true);
                }}
              >
                <StatusIcon className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Status</p>

                  <div
                    className="text-left"

                  >
                    {statusDraft}
                  </div>
                </div>
              </div>
            )}

            {editingField == "priority" ?
              (

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <Select
                      value={priorityDraft}
                      open={isPriorityOpen}
                      onOpenChange={(open) => {
                        setIsPriorityOpen(open);
                        if (!open) setEditingField(null);
                      }}
                      onValueChange={(value) => {
                        setPriorityDraft(value);
                        setIsPriorityOpen(false);
                        setEditingField(null);
                      }}
                    >
                      <SelectTrigger className="h-8 mt-1 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

              ) : (
                <div
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setEditingField("priority");
                    setIsPriorityOpen(true);
                  }}

                >
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Priority</p>

                    <div className="text-left">
                      <Badge
                        variant="outline"
                        className={`text-xs ${priorityColors[priorityDraft] || priorityColors.medium}`}
                      >
                        {priorityDraft}
                      </Badge>
                    </div>
                  </div>
                </div>

              )}


            {editingField === "assignee" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Assigned to</p>
                  <Select
                    value={assigneeIdDraft}
                    open={isAssigneeOpen}
                    onOpenChange={(open) => {
                      setIsAssigneeOpen(open);
                      if (!open) setEditingField(null);
                    }}
                    onValueChange={(value) => {
                      setAssigneeIdDraft(value);
                      setIsAssigneeOpen(false);
                      setEditingField(null);
                    }}
                  >
                    <SelectTrigger className="h-8 mt-1 w-44">
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_ASSIGNEE_VALUE}>Unassigned</SelectItem>
                      {assignees.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.display_name || member.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assigneesError ? (
                    <p className="text-xs text-destructive mt-1">{assigneesError}</p>
                  ) : null}

                </div>
              </div>

            ) : (
              <div
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer"
                onClick={() => {
                  setEditingField("assignee");
                  setIsAssigneeOpen(true);
                }}
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Assigned to</p>
                  <div
                    className="text-left"

                  >
                    {assignees.find((member) => member.user_id === assigneeIdDraft)?.display_name
                      || assignees.find((member) => member.user_id === assigneeIdDraft)?.username
                      || "Unassigned"}
                  </div>
                </div>
              </div>

            )}


            {editingField === "category" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 w-full">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <Select
                    value={categoryDraft}
                    open={isCategoryOpen}
                    onOpenChange={(open) => {
                      setIsCategoryOpen(open);
                      if (!open && categoryDraft !== CUSTOM_CATEGORY_VALUE) {
                        setEditingField(null);
                      }
                    }}
                    onValueChange={(value) => {
                      setCategoryDraft(value);
                      if (value === CUSTOM_CATEGORY_VALUE) {
                        setIsCategoryOpen(false);
                        requestAnimationFrame(() => setCustomCategoryFocus());
                        return;
                      }
                      setIsCategoryOpen(false);
                      setEditingField(null);
                    }}
                  >
                    <SelectTrigger className="h-8 mt-1 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_CATEGORY_VALUE}>Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                  {categoryDraft === CUSTOM_CATEGORY_VALUE ? (
                    <Input
                      ref={customCategoryRef}
                      value={customCategoryDraft}
                      onChange={(e) => setCustomCategoryDraft(e.target.value)}
                      onBlur={() => setEditingField(null)}
                      placeholder="Write category"
                      className="h-8 mt-2 w-44"
                    />
                  ) : null}
                </div>
              </div>

            ) : (
              <div
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer"
                onClick={() => {
                  setEditingField("category");
                  setIsCategoryOpen(true);
                }}
              >
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 w-full">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <div
                    className="text-left"
                  >
                    {categoryDraft === CUSTOM_CATEGORY_VALUE
                      ? (customCategoryDraft || "Other")
                      : categoryDraft}
                  </div>
                </div>
              </div>

            )}




            {editingField === "dueDate" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 w-full">
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <Input
                    ref={dueDateRef}
                    type="date"
                    value={dueDateDraft}
                    onChange={(e) => setDueDateDraft(e.target.value)}
                    onBlur={() => setEditingField(null)}
                    className="h-8 mt-1 w-44"
                  />
                </div>
              </div>

            ) : (
              <div
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer"
                onClick={() => {
                  setEditingField("dueDate");
                  requestAnimationFrame(() => setDueDateFocus());
                }}
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 w-full">
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <div
                    className="text-left"
                  >
                    {dueDateDraft || "No due date"}
                  </div>
                </div>
              </div>

            )}

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-not-allowed">
              <Home className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Household</p>
                <p className="text-sm truncate">{householdName}</p>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-4">
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Close
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>

            {task.status === "done" ? (
              <Button
                variant="destructive"
                className="bg-terracotta hover:bg-terracotta/90"
                onClick={() => onUpdateTaskStatus?.(task.id, ARCHIVE_STATUS)}
                disabled={isSaving}
              >
                Archive
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="bg-terracotta hover:bg-terracotta/90"
                onClick={() => {
                  const confirmed = window.confirm(
                    `Delete "${task.title}"? This cannot be undone.`
                  );
                  if (!confirmed) return;
                  onDeleteTask(task.id);
                }}
                disabled={isSaving}
              >
                Delete
              </Button>
            )}
          </div>
        </Motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailDialog;
