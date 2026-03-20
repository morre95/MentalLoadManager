import { useEffect, useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import {
  Clock,
  AlertCircle,
  Check,
  Calendar,
  Home,
  Repeat,
  User,
  Tag,
  Flag,
  PauseCircle,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchHouseholdCategories,
  fetchKanbanAssignees,
  formatTaskRecurrence,
  resolveCurrentHouseholdId,
  cn,
} from "@/lib/utils";

import useFokus from '@/hooks/useFocus';
import RecurrenceOptionsDialog from "@/components/tasks/RecurrenceOptionsDialog";

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

const UNASSIGNED_ASSIGNEE_VALUE = "__unassigned__";
const CUSTOM_CATEGORY_VALUE = "__custom__";
const ARCHIVE_STATUS = "archive";
const FALLBACK_CATEGORY = "Other";
const fieldCardClassName =
  "widget-card group flex w-full items-start gap-3 p-4 text-left";
const fieldValueClassName = "mt-1 text-sm font-medium text-foreground";
const emptyValueClassName = "mt-1 text-sm italic text-muted-foreground";

const priorityLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const statusBadgeClasses = {
  todo: "status-badge-todo",
  "in-progress": "status-badge-doing",
  archive: "bg-lavender-light text-lavender border border-lavender/30",
  done: "status-badge-done",
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

function formatDisplayDate(value) {
  if (!value) return "No due date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
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
  onUpdateTaskRecurrence,
  onSkipTaskOccurrence,
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

  const [assignees, setAssignees] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([FALLBACK_CATEGORY]);
  const [assigneesError, setAssigneesError] = useState("");
  const [categoriesError, setCategoriesError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("todo");
  const [priorityDraft, setPriorityDraft] = useState("medium");
  const [assigneeIdDraft, setAssigneeIdDraft] = useState(UNASSIGNED_ASSIGNEE_VALUE);
  const [categoryDraft, setCategoryDraft] = useState("Other");
  const [customCategoryDraft, setCustomCategoryDraft] = useState("");
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [recurrenceDraft, setRecurrenceDraft] = useState("none");
  const [recurrenceIntervalDraft, setRecurrenceIntervalDraft] = useState(1);
  const [recurrenceWeekdaysDraft, setRecurrenceWeekdaysDraft] = useState([]);
  const [recurrenceConfigOpen, setRecurrenceConfigOpen] = useState(false);

  const [editingField, setEditingField] = useState(null);
  const [titleRef, setTitleFocus] = useFokus();
  const [descRef, setDescFocus] = useFokus();
  const [dueDateRef, setDueDateFocus] = useFokus();
  const [customCategoryRef, setCustomCategoryFocus] = useFokus();

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isRecurrenceOpen, setIsRecurrenceOpen] = useState(false);

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
    setRecurrenceDraft(task.recurrenceFrequency || "none");
    setRecurrenceIntervalDraft(task.recurrenceInterval || 1);
    setRecurrenceWeekdaysDraft([]);
  }, [open, task, normalizedPriority]);

  useEffect(() => {
    if (!open || !task) return;
    const currentCategory = task.category || FALLBACK_CATEGORY;
    if (availableCategories.includes(currentCategory)) {
      setCategoryDraft(currentCategory);
      setCustomCategoryDraft("");
    } else {
      setCategoryDraft(CUSTOM_CATEGORY_VALUE);
      setCustomCategoryDraft(currentCategory);
    }
  }, [open, task, availableCategories]);

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

  useEffect(() => {
    if (!open) return;

    const loadCategories = async () => {
      const householdId = task?.householdId || await resolveCurrentHouseholdId();
      if (!householdId) {
        setAvailableCategories([FALLBACK_CATEGORY]);
        setCategoriesError("No household found. Create or join a household first.");
        return;
      }

      setCategoriesError("");
      try {
        const data = await fetchHouseholdCategories(householdId);
        const categoryNames = Array.isArray(data?.categories)
          ? data.categories
            .map((item) => String(item?.name || "").trim())
            .filter(Boolean)
          : [];
        const uniqueCategoryNames = Array.from(new Set(categoryNames));
        if (!uniqueCategoryNames.includes(FALLBACK_CATEGORY)) {
          uniqueCategoryNames.push(FALLBACK_CATEGORY);
        }
        setAvailableCategories(uniqueCategoryNames);
      } catch (err) {
        setAvailableCategories([FALLBACK_CATEGORY]);
        setCategoriesError(err?.message || "Could not load household categories.");
      }
    };

    loadCategories();
  }, [open, task?.householdId]);

  if (!task) return null;

  const activeStatus = statusConfig[statusDraft] || statusConfig.todo;
  const ActiveStatusIcon = activeStatus.icon;
  const selectedAssignee = assignees.find((member) => member.user_id === assigneeIdDraft);
  const assigneeLabel =
    selectedAssignee?.display_name || selectedAssignee?.username || "Unassigned";
  const categoryLabel =
    categoryDraft === CUSTOM_CATEGORY_VALUE ? (customCategoryDraft || "Other") : categoryDraft;
  const hasDescription = Boolean(descriptionDraft.trim());
  const recurrenceLabel =
    recurrenceDraft !== "none"
      ? formatTaskRecurrence(recurrenceDraft, recurrenceIntervalDraft)
      : "Does not repeat";
  const activeOccurrenceDate = task?.occurrenceDate || task?.dueDateValue || null;
  const isProjectedOccurrence = Boolean(task?.isProjectedOccurrence);
  const displayDueDate = formatDisplayDate(isProjectedOccurrence ? activeOccurrenceDate : dueDateDraft);

  const runTaskUpdate = async (updater) => {
    setIsSaving(true);
    try {
      await updater();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (isSaving) return;
    onOpenChange(false);
  };

  const handleTitleBlur = async (value) => {
    const nextTitle = value.trim() || task.title || "";
    setTitleDraft(nextTitle);
    setEditingField(null);

    if (nextTitle === (task.title || "")) return;

    await runTaskUpdate(async () => {
      if (onUpdateTaskTitle) await onUpdateTaskTitle(task.id, nextTitle);
      else onUpdateTask?.(task.id, { title: nextTitle });
    });
  };

  const handleDescriptionBlur = async (value) => {
    const nextDescription = value.trim();
    setDescriptionDraft(nextDescription);
    setEditingField(null);

    if (nextDescription === (task.description || "")) return;

    await runTaskUpdate(async () => {
      if (onUpdateTaskDescription) {
        await onUpdateTaskDescription(task.id, nextDescription || null);
      } else {
        onUpdateTask?.(task.id, { description: nextDescription });
      }
    });
  };

  const handleStatusChange = async (value) => {
    if (isProjectedOccurrence) return;
    setStatusDraft(value);
    setIsStatusOpen(false);
    setEditingField(null);

    if (value === (task.status || "todo")) return;
    await runTaskUpdate(async () => onUpdateTaskStatus?.(task.id, value));
  };

  const handlePriorityChange = async (value) => {
    setPriorityDraft(value);
    setIsPriorityOpen(false);
    setEditingField(null);

    if (value === normalizedPriority) return;
    await runTaskUpdate(async () => onUpdateTaskPriority?.(task.id, value));
  };

  const handleAssigneeChange = async (value) => {
    setAssigneeIdDraft(value);
    setIsAssigneeOpen(false);
    setEditingField(null);

    const nextAssigneeId = value === UNASSIGNED_ASSIGNEE_VALUE ? null : value;
    const nextSelectedAssignee = assignees.find((member) => member.user_id === nextAssigneeId);
    const nextAssigneeLabel =
      nextSelectedAssignee?.display_name || nextSelectedAssignee?.username || "Unassigned";

    if ((nextAssigneeId || undefined) === task.assigneeId) return;

    await runTaskUpdate(async () => {
      await onUpdateTaskAssignee?.(
        task.id,
        nextAssigneeId,
        nextAssigneeLabel,
        nextSelectedAssignee || null
      );
    });
  };

  const handleCategoryChange = async (value) => {
    setCategoryDraft(value);
    if (value === CUSTOM_CATEGORY_VALUE) {
      setIsCategoryOpen(false);
      requestAnimationFrame(() => setCustomCategoryFocus());
      return;
    }

    setIsCategoryOpen(false);
    setEditingField(null);

    if (value === (task.category || "Other")) return;

    await runTaskUpdate(async () => {
      if (onUpdateTaskCategory) await onUpdateTaskCategory(task.id, value);
      else onUpdateTask?.(task.id, { category: value });
    });
  };

  const handleCustomCategoryBlur = async () => {
    const nextCategory = customCategoryDraft.trim() || "Other";
    setCustomCategoryDraft(nextCategory);
    setEditingField(null);

    if (nextCategory === (task.category || "Other")) return;

    await runTaskUpdate(async () => {
      if (onUpdateTaskCategory) await onUpdateTaskCategory(task.id, nextCategory);
      else onUpdateTask?.(task.id, { category: nextCategory });
    });
  };

  const handleDueDateChange = async (value) => {
    if (isProjectedOccurrence) return;
    setDueDateDraft(value);
    setEditingField(null);

    if (value === toDateInputValue(task.dueDate)) return;

    await runTaskUpdate(async () => {
      if (onUpdateTaskDueDate) await onUpdateTaskDueDate(task.id, value || null);
      else {
        const dueDate = value
          ? new Date(`${value}T00:00:00`).toLocaleDateString()
          : undefined;
        onUpdateTask?.(task.id, { dueDate });
      }
    });
  };

  const handleRecurrenceChange = (value) => {
    setIsRecurrenceOpen(false);
    setEditingField(null);

    const nextRecurrence = value === "none" ? null : value;

    if (!nextRecurrence) {
      // Turning off recurrence — save immediately
      setRecurrenceDraft("none");
      setRecurrenceIntervalDraft(1);
      setRecurrenceWeekdaysDraft([]);
      runTaskUpdate(async () => {
        await onUpdateTaskRecurrence?.(task.id, null, null);
      });
      return;
    }

    if (!dueDateDraft) {
      // Can't enable recurrence without a due date
      return;
    }

    // Opening config dialog — pre-set frequency and reset interval if switching type
    setRecurrenceDraft(value);
    if (value !== task.recurrenceFrequency) {
      setRecurrenceIntervalDraft(1);
      setRecurrenceWeekdaysDraft([]);
    }
    setRecurrenceConfigOpen(true);
  };

  const handleRecurrenceApply = async ({ interval, weekdays, suggestedDueDate }) => {
    setRecurrenceIntervalDraft(interval);
    setRecurrenceWeekdaysDraft(weekdays);

    if (suggestedDueDate && suggestedDueDate !== dueDateDraft) {
      setDueDateDraft(suggestedDueDate);
      await runTaskUpdate(async () => {
        await onUpdateTaskDueDate?.(task.id, suggestedDueDate);
      });
    }

    const nextFrequency = recurrenceDraft === "none" ? null : recurrenceDraft;
    await runTaskUpdate(async () => {
      await onUpdateTaskRecurrence?.(task.id, nextFrequency, nextFrequency ? interval : null);
    });
  };

  const handleArchive = async () => {
    if (isSaving || isProjectedOccurrence) return;

    setIsSaving(true);
    try {
      await onUpdateTaskStatus?.(task.id, ARCHIVE_STATUS);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipOccurrence = async () => {
    if (isSaving || !activeOccurrenceDate) return;

    setIsSaving(true);
    try {
      await onSkipTaskOccurrence?.(task.id, activeOccurrenceDate);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" key={task.id}>
        <DialogHeader className="space-y-4 border-b pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("gap-1.5", priorityColors[priorityDraft] || priorityColors.medium)}
                >
                  <Flag className="h-3 w-3" />
                  {priorityLabels[priorityDraft] || "Medium"} priority
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("gap-1.5", statusBadgeClasses[statusDraft] || statusBadgeClasses.todo)}
                >
                  <ActiveStatusIcon className="h-3 w-3" />
                  {activeStatus.label}
                </Badge>
              </div>

              <DialogTitle className="font-semibold tracking-tight font-display text-xl">
                {editingField === "title" ? (
                  <Input
                  ref={titleRef}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={(e) => handleTitleBlur(e.target.value)}
                  className="h-10 font-semibold tracking-tight font-display text-xl"
                />
                ) : (
                  <div
                    className="group flex cursor-pointer items-center gap-2 text-left"
                    onClick={() => {
                      setEditingField("title");
                      requestAnimationFrame(() => setTitleFocus());
                    }}
                  >
                    <span>{titleDraft || "Untitled task"}</span>
                    <Pencil className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                )}
              </DialogTitle>

              <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>{householdName}</span>
                <span>{assigneeLabel}</span>
                <span>{displayDueDate}</span>
                <span>{recurrenceLabel}</span>
                {isProjectedOccurrence ? <span>Future occurrence</span> : null}
              </DialogDescription>
            </div>

            <div className={cn("hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-widget sm:flex", activeStatus.color)}>
              <ActiveStatusIcon className="h-5 w-5" />
            </div>
          </div>
        </DialogHeader>

        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 space-y-6"
        >
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold tracking-tight font-display text-base">
                Details
              </p>
              <span className="text-xs text-muted-foreground">Click any field to edit</span>
            </div>

            {editingField === "description" ? (
              <div className="widget-card rounded-xl p-4">
                <Textarea
                  ref={descRef}
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  onBlur={(e) => handleDescriptionBlur(e.target.value)}
                  rows={5}
                  placeholder="Add a description..."
                  className="min-h-28 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
              </div>
            ) : (
              <button
                type="button"
                className="widget-card group w-full rounded-xl p-4 text-left"
                onClick={() => {
                  setEditingField("description");
                  requestAnimationFrame(() => setDescFocus());
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Description</p>
                  <Pencil className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className={hasDescription ? "text-sm leading-6 text-foreground" : emptyValueClassName}>
                  {hasDescription ? descriptionDraft : "Add a description..."}
                </p>
              </button>
            )}
          </section>

          <section className="space-y-3">
            <p className="font-semibold tracking-tight font-display text-base">
              Properties
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editingField === "status" ? (
                <div className={cn(fieldCardClassName, "border-primary/30 bg-primary/5 shadow-none")}>
                  <ActiveStatusIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                    <Select
                      value={statusDraft}
                      open={isStatusOpen}
                      onOpenChange={(openValue) => {
                        setIsStatusOpen(openValue);
                        if (!openValue) setEditingField(null);
                      }}
                      onValueChange={handleStatusChange}
                    >
                      <SelectTrigger className="mt-2 h-9 w-full">
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
                <button
                  type="button"
                  className={cn(fieldCardClassName, "hover:border-primary/30")}
                  onClick={() => {
                    if (isProjectedOccurrence) return;
                    setEditingField("status");
                    setIsStatusOpen(true);
                  }}
                >
                  <ActiveStatusIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className={fieldValueClassName}>
                      <Badge
                        variant="outline"
                        className={cn("gap-1.5", statusBadgeClasses[statusDraft] || statusBadgeClasses.todo)}
                      >
                        <ActiveStatusIcon className="h-3 w-3" />
                        {activeStatus.label}
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

              {editingField === "priority" ? (
                <div className={cn(fieldCardClassName, "border-primary/30 bg-primary/5 shadow-none")}>
                  <Flag className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority</p>
                    <Select
                      value={priorityDraft}
                      open={isPriorityOpen}
                      onOpenChange={(openValue) => {
                        setIsPriorityOpen(openValue);
                        if (!openValue) setEditingField(null);
                      }}
                      onValueChange={handlePriorityChange}
                    >
                      <SelectTrigger className="mt-2 h-9 w-full">
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
                <button
                  type="button"
                  className={cn(fieldCardClassName, "hover:border-primary/30")}
                  onClick={() => {
                    setEditingField("priority");
                    setIsPriorityOpen(true);
                  }}
                >
                  <Flag className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority</p>
                    <div className={fieldValueClassName}>
                      <Badge
                        variant="outline"
                        className={priorityColors[priorityDraft] || priorityColors.medium}
                      >
                        {priorityLabels[priorityDraft] || "Medium"}
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

              {editingField === "assignee" ? (
                <div className={cn(fieldCardClassName, "border-primary/30 bg-primary/5 shadow-none")}>
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned to</p>
                    <Select
                      value={assigneeIdDraft}
                      open={isAssigneeOpen}
                      onOpenChange={(openValue) => {
                        setIsAssigneeOpen(openValue);
                        if (!openValue) setEditingField(null);
                      }}
                      onValueChange={handleAssigneeChange}
                    >
                      <SelectTrigger className="mt-2 h-9 w-full">
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
                      <p className="mt-2 text-xs text-destructive">{assigneesError}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(fieldCardClassName, "hover:border-primary/30")}
                  onClick={() => {
                    setEditingField("assignee");
                    setIsAssigneeOpen(true);
                  }}
                >
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned to</p>
                    <p className={fieldValueClassName}>{assigneeLabel}</p>
                    {assigneesError ? (
                      <p className="mt-2 text-xs text-destructive">{assigneesError}</p>
                    ) : null}
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

              {editingField === "category" ? (
                <div className={cn(fieldCardClassName, "border-primary/30 bg-primary/5 shadow-none")}>
                  <Tag className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 w-full flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</p>
                    <Select
                      value={categoryDraft}
                      open={isCategoryOpen}
                      onOpenChange={(openValue) => {
                        setIsCategoryOpen(openValue);
                        if (!openValue && categoryDraft !== CUSTOM_CATEGORY_VALUE) {
                          setEditingField(null);
                        }
                      }}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger className="mt-2 h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((cat) => (
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
                        onBlur={handleCustomCategoryBlur}
                        placeholder="Write category"
                        className="mt-2 h-9 w-full"
                      />
                    ) : null}
                    {categoriesError ? (
                      <p className="mt-2 text-xs text-destructive">{categoriesError}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(fieldCardClassName, "hover:border-primary/30")}
                  onClick={() => {
                    setEditingField("category");
                    setIsCategoryOpen(true);
                  }}
                >
                  <Tag className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</p>
                    <p className={fieldValueClassName}>{categoryLabel}</p>
                    {categoriesError ? (
                      <p className="mt-2 text-xs text-destructive">{categoriesError}</p>
                    ) : null}
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

              {editingField === "dueDate" ? (
                <div className={cn(fieldCardClassName, "border-primary/30 bg-primary/5 shadow-none")}>
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 w-full flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due date</p>
                    <Input
                      ref={dueDateRef}
                      type="date"
                      value={dueDateDraft}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      onBlur={() => setEditingField(null)}
                      className="mt-2 h-9 w-full"
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(fieldCardClassName, "hover:border-primary/30")}
                  onClick={() => {
                    if (isProjectedOccurrence) return;
                    setEditingField("dueDate");
                    requestAnimationFrame(() => setDueDateFocus());
                  }}
                >
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due date</p>
                    <p className={dueDateDraft ? fieldValueClassName : emptyValueClassName}>
                      {displayDueDate}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

              {editingField === "recurrence" ? (
                <div className={cn(fieldCardClassName, "border-primary/30 bg-primary/5 shadow-none")}>
                  <Repeat className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Repeats</p>
                    <Select
                      value={recurrenceDraft}
                      open={isRecurrenceOpen}
                      onOpenChange={(openValue) => {
                        setIsRecurrenceOpen(openValue);
                        if (!openValue) setEditingField(null);
                      }}
                      onValueChange={handleRecurrenceChange}
                    >
                      <SelectTrigger className="mt-2 h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Does not repeat</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    {!dueDateDraft ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Add a due date before turning on repeats.
                      </p>
                    ) : null}
                    {recurrenceDraft !== "none" && dueDateDraft && (
                      <button
                        type="button"
                        onClick={() => setRecurrenceConfigOpen(true)}
                        className="mt-1 text-xs text-primary hover:underline"
                      >
                        Edit schedule…
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(fieldCardClassName, "hover:border-primary/30")}
                  onClick={() => {
                    setEditingField("recurrence");
                    setIsRecurrenceOpen(true);
                  }}
                >
                  <Repeat className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Repeats</p>
                    <p className={recurrenceDraft !== "none" ? fieldValueClassName : emptyValueClassName}>
                      {recurrenceLabel}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

              <div className={cn(fieldCardClassName, "cursor-default bg-card")}>
                <Home className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Household</p>
                  <p className={fieldValueClassName}>{householdName}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {task.recurrenceEnabled && activeOccurrenceDate ? (
                <Button
                  variant="outline"
                  className="border-status-todo/30 text-status-todo hover:bg-status-todo/10 hover:text-status-todo"
                  onClick={handleSkipOccurrence}
                  disabled={isSaving}
                >
                  Skip this occurrence
                </Button>
              ) : null}

              {isProjectedOccurrence ? null : statusDraft === "done" ? (
                <Button
                  variant="outline"
                  className="border-terracotta/30 text-terracotta hover:bg-terracotta/10 hover:text-terracotta"
                  onClick={handleArchive}
                  disabled={isSaving}
                >
                  Archive task
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={isSaving}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete task
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &quot;{task.title}&quot; will be permanently removed. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => onDeleteTask(task.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </section>
        </Motion.div>
      </DialogContent>

      <RecurrenceOptionsDialog
        open={recurrenceConfigOpen}
        onOpenChange={setRecurrenceConfigOpen}
        frequency={recurrenceDraft === "none" ? null : recurrenceDraft}
        interval={recurrenceIntervalDraft}
        weekdays={recurrenceWeekdaysDraft}
        dueDate={dueDateDraft}
        onApply={handleRecurrenceApply}
      />
    </Dialog>
  );
};

export default TaskDetailDialog;
