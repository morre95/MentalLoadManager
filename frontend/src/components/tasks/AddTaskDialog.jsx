import { useEffect, useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import {
  Calendar,
  Check,
  Clock,
  Flag,
  Home,
  Plus,
  Tag,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cn,
  createKanbanTask,
  fetchHouseholdCategories,
  fetchKanbanAssignees,
  resolveCurrentHouseholdId,
  toUtcDateOnlyIso,
} from "@/lib/utils";

const CUSTOM_CATEGORY_VALUE = "__custom__";
const UNASSIGNED_ASSIGNEE_VALUE = "__unassigned__";
const FALLBACK_CATEGORY = "Other";

const priorityColors = {
  low: "bg-sage-light text-sage border-sage/30",
  medium: "bg-status-todo/15 text-status-todo border-status-todo/30",
  high: "bg-terracotta-light text-terracotta border-terracotta/30",
};

const priorityLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const statusConfig = {
  todo: { icon: Clock, label: "To Do", color: "bg-status-todo" },
  done: { icon: Check, label: "Done", color: "bg-status-done" },
};

const fieldCardClassName = "widget-card flex w-full items-start gap-3 p-4 text-left";
const fieldValueClassName = "mt-1 text-sm font-medium text-foreground";
const emptyValueClassName = "mt-1 text-sm italic text-muted-foreground";

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

const AddTaskDialog = ({
  open,
  onOpenChange,
  onAddTask,
  householdId,
  households = [],
  initialDueDate = "",
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("Other");
  const [customCategory, setCustomCategory] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [assigneesError, setAssigneesError] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [availableCategories, setAvailableCategories] = useState([FALLBACK_CATEGORY]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");

  const householdOptions = useMemo(() => {
    const nextHouseholds = Array.isArray(households) ? households : [];
    const mapped = nextHouseholds
      .map((household) => {
        const id = household?.household_id ?? household?.id;
        if (!id) return null;
        return {
          id: String(id),
          name: household?.name || "Unnamed household",
        };
      })
      .filter(Boolean);

    if (householdId && !mapped.some((household) => household.id === String(householdId))) {
      mapped.push({
        id: String(householdId),
        name: "Selected household",
      });
    }

    return mapped;
  }, [householdId, households]);

  const selectedHousehold = householdOptions.find(
    (household) => household.id === String(selectedHouseholdId)
  );
  const selectedAssignee = assignees.find((member) => member.user_id === assigneeId);
  const assigneeLabel =
    selectedAssignee?.display_name || selectedAssignee?.username || "Unassigned";
  const categoryLabel =
    category === CUSTOM_CATEGORY_VALUE ? (customCategory.trim() || FALLBACK_CATEGORY) : category;
  const displayDueDate = formatDisplayDate(dueDate);
  const activeStatus = statusConfig.todo;
  const ActiveStatusIcon = activeStatus.icon;
  const isHouseholdSelectDisabled = householdOptions.length <= 1;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const initializeHousehold = async () => {
      const knownIds = householdOptions.map((household) => household.id);
      const preferredId = householdId ? String(householdId) : "";
      const resolvedHouseholdId = await resolveCurrentHouseholdId();
      const resolvedId = resolvedHouseholdId ? String(resolvedHouseholdId) : "";

      let fallbackId = "";
      if (preferredId && knownIds.includes(preferredId)) {
        fallbackId = preferredId;
      } else if (knownIds.includes(resolvedId)) {
        fallbackId = resolvedId;
      } else {
        fallbackId = knownIds[0] || preferredId || resolvedId;
      }

      if (cancelled) return;

      setSelectedHouseholdId((previousHouseholdId) => {
        if (!previousHouseholdId) return fallbackId;
        if (knownIds.length === 0) return previousHouseholdId;
        if (knownIds.includes(previousHouseholdId)) return previousHouseholdId;
        return fallbackId;
      });
    };

    initializeHousehold();

    return () => {
      cancelled = true;
    };
  }, [open, householdId, householdOptions]);

  useEffect(() => {
    if (!open) return;

    const loadAssignees = async () => {
      const activeHouseholdId = selectedHouseholdId;
      if (!activeHouseholdId) {
        setAssignees([]);
        setAssigneeId("");
        setAssigneesError("No household found. Create or join a household first.");
        return;
      }

      setLoadingAssignees(true);
      setAssigneesError("");

      try {
        const data = await fetchKanbanAssignees(activeHouseholdId);
        const nextAssignees = Array.isArray(data?.assignees) ? data.assignees : [];
        setAssignees(nextAssignees);

        setAssigneeId((previousAssigneeId) => {
          if (
            previousAssigneeId &&
            nextAssignees.some((member) => member.user_id === previousAssigneeId)
          ) {
            return previousAssigneeId;
          }
          return "";
        });
      } catch (err) {
        setAssignees([]);
        setAssigneeId("");
        setAssigneesError(err?.message || "Could not load household members.");
      } finally {
        setLoadingAssignees(false);
      }
    };

    loadAssignees();
  }, [open, selectedHouseholdId]);

  useEffect(() => {
    if (!open) return;

    const loadCategories = async () => {
      const activeHouseholdId = selectedHouseholdId;
      if (!activeHouseholdId) {
        setAvailableCategories([FALLBACK_CATEGORY]);
        setCategoriesError("No household found. Create or join a household first.");
        return;
      }

      setLoadingCategories(true);
      setCategoriesError("");
      try {
        const data = await fetchHouseholdCategories(activeHouseholdId);
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
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [open, selectedHouseholdId]);

  useEffect(() => {
    if (!open) return;
    setDueDate(initialDueDate || "");
  }, [open, initialDueDate]);

  useEffect(() => {
    if (!open) return;
    setCategory((previousCategory) => {
      if (previousCategory === CUSTOM_CATEGORY_VALUE) return previousCategory;
      if (availableCategories.includes(previousCategory)) return previousCategory;
      return availableCategories[0] || FALLBACK_CATEGORY;
    });
  }, [open, availableCategories]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitError("");

    const activeHouseholdId = selectedHouseholdId || await resolveCurrentHouseholdId();
    if (!activeHouseholdId) {
      setSubmitError("No household found. Create or join a household first.");
      return;
    }

    const dueDateIso = toUtcDateOnlyIso(dueDate);
    const finalCategory =
      category === CUSTOM_CATEGORY_VALUE ? customCategory.trim() || "Other" : category;

    setSaving(true);
    try {
      const createdTask = await createKanbanTask({
        household_id: activeHouseholdId,
        name: title.trim(),
        status: "todo",
        description: description.trim() || null,
        priority,
        due_date: dueDateIso,
        category_name: finalCategory,
        assigns_to: assigneeId || null,
      });

      const createdAssignee = assignees.find((member) => member.user_id === assigneeId);
      const createdAssigneeLabel =
        createdAssignee?.display_name || createdAssignee?.username || "Unassigned";
      const createdHousehold = householdOptions.find(
        (household) => household.id === String(activeHouseholdId)
      );

      const newTask = {
        id: String(createdTask?.task_id || crypto.randomUUID()),
        householdId: activeHouseholdId,
        householdName: createdHousehold?.name || "Unknown household",
        title: title.trim(),
        description: description.trim() || "",
        status: "todo",
        priority,
        assigneeId: assigneeId || undefined,
        assigneeLabel: createdAssigneeLabel,
        category: finalCategory,
        dueDateValue: dueDate || null,
        dueDate: dueDate ? new Date(dueDateIso).toLocaleDateString() : "",
      };

      onAddTask(newTask);
      handleClose();
    } catch (err) {
      setSubmitError(err?.message || "Could not create task.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setTitle("");
    setDescription("");
    setPriority("medium");
    setCategory("Other");
    setCustomCategory("");
    setAssigneeId("");
    setAssigneesError("");
    setSelectedHouseholdId("");
    setDueDate("");
    setSubmitError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="space-y-4 border-b pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("gap-1.5", priorityColors[priority] || priorityColors.medium)}
                >
                  <Flag className="h-3 w-3" />
                  {priorityLabels[priority] || "Medium"} priority
                </Badge>
                <Badge variant="outline" className="gap-1.5 status-badge-todo">
                  <ActiveStatusIcon className="h-3 w-3" />
                  {activeStatus.label}
                </Badge>
              </div>

              <DialogTitle className="font-display text-xl font-semibold tracking-tight">
                Add New Task
              </DialogTitle>

              <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>{selectedHousehold?.name || "Select a household"}</span>
                <span>{assigneeLabel}</span>
                <span>{displayDueDate}</span>
              </DialogDescription>
            </div>

            <div
              className={cn(
                "hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-widget sm:flex",
                activeStatus.color
              )}
            >
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
              <p className="font-display text-base font-semibold tracking-tight">Details</p>
              <span className="text-xs text-muted-foreground">Set up the task before saving</span>
            </div>

            <div className="widget-card rounded-xl p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Title</p>
                <span className="text-xs text-muted-foreground">Required</span>
              </div>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                className="h-10 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="widget-card rounded-xl p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Description</p>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add a description..."
                rows={5}
                className="min-h-28 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="font-display text-base font-semibold tracking-tight">Properties</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={fieldCardClassName}>
                <Home className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 w-full flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Household
                  </p>
                  <Select
                    value={selectedHouseholdId}
                    onValueChange={setSelectedHouseholdId}
                    disabled={isHouseholdSelectDisabled}
                  >
                    <SelectTrigger className="mt-2 h-9 w-full">
                      <SelectValue placeholder="Select household" />
                    </SelectTrigger>
                    <SelectContent>
                      {householdOptions.map((household) => (
                        <SelectItem key={household.id} value={household.id}>
                          {household.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={fieldCardClassName}>
                <Flag className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 w-full flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Priority
                  </p>
                  <Select value={priority} onValueChange={setPriority}>
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

              <div className={fieldCardClassName}>
                <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 w-full flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Assigned to
                  </p>
                  <Select
                    value={assigneeId || UNASSIGNED_ASSIGNEE_VALUE}
                    onValueChange={(value) =>
                      setAssigneeId(value === UNASSIGNED_ASSIGNEE_VALUE ? "" : value)
                    }
                  >
                    <SelectTrigger className="mt-2 h-9 w-full">
                      <SelectValue
                        placeholder={loadingAssignees ? "Loading members..." : "Select assignee"}
                      />
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

              <div className={fieldCardClassName}>
                <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 w-full flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Due date
                  </p>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="mt-2 h-9 w-full"
                  />
                  <p className={dueDate ? fieldValueClassName : emptyValueClassName}>
                    {displayDueDate}
                  </p>
                </div>
              </div>

              <div className={cn(fieldCardClassName, "sm:col-span-2")}>
                <Tag className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 w-full flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Category
                  </p>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="mt-2 h-9 w-full">
                      <SelectValue
                        placeholder={loadingCategories ? "Loading categories..." : "Select category"}
                      />
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
                  {category === CUSTOM_CATEGORY_VALUE ? (
                    <Input
                      value={customCategory}
                      onChange={(event) => setCustomCategory(event.target.value)}
                      placeholder="Write category"
                      className="mt-2 h-9 w-full"
                    />
                  ) : null}
                  <p className={fieldValueClassName}>{categoryLabel}</p>
                  {categoriesError ? (
                    <p className="mt-2 text-xs text-destructive">{categoriesError}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          <section className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim() || saving}>
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Add Task"}
            </Button>
          </section>
        </Motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default AddTaskDialog;
