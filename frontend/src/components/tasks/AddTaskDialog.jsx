import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
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
import { createKanbanTask } from "@/lib/utils";

const categories = [
    "Shopping",
    "Cleaning",
    "Admin",
    "Health",
    "Maintenance",
    "Planning",
    "Other",
];

const assignees = ["Maria", "Erik"];
const CUSTOM_CATEGORY_VALUE = "__custom__";

function resolveHouseholdId() {
    if (typeof window === "undefined") return null;

    try {
        const selectedHouseholdRaw = localStorage.getItem("household");
        if (selectedHouseholdRaw) {
            const selectedHousehold = JSON.parse(selectedHouseholdRaw);
            const selectedHouseholdId =
                selectedHousehold?.household_id ??
                selectedHousehold?.id ??
                selectedHousehold;
            if (selectedHouseholdId) return String(selectedHouseholdId);
        }
    } catch {
        // Ignore malformed local storage and fallback to households list.
    }

    try {
        const householdsRaw = localStorage.getItem("households");
        const households = householdsRaw ? JSON.parse(householdsRaw) : [];
        const firstHouseholdId = households?.[0]?.household_id ?? households?.[0]?.id;
        return firstHouseholdId ? String(firstHouseholdId) : null;
    } catch {
        return null;
    }
}

const AddTaskDialog = ({ open, onOpenChange, onAddTask }) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("medium");
    const [category, setCategory] = useState("Other");
    const [customCategory, setCustomCategory] = useState("");
    const [assignee, setAssignee] = useState("Maria");
    const [dueDate, setDueDate] = useState("");
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setSubmitError("");

        const householdId = resolveHouseholdId();
        if (!householdId) {
            setSubmitError("No household found. Create or join a household first.");
            return;
        }

        const dueDateIso = dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null;
        const finalCategory =
            category === CUSTOM_CATEGORY_VALUE
                ? customCategory.trim() || "Other"
                : category;

        setSaving(true);
        try {
            const createdTask = await createKanbanTask({
                household_id: householdId,
                name: title.trim(),
                status: "todo",
                description: description.trim() || null,
                priority,
                due_date: dueDateIso,
            });

            const newTask = {
                id: String(createdTask?.task_id || crypto.randomUUID()),
                title: title.trim(),
                description: description.trim() || "",
                status: "todo",
                priority,
                assignee,
                category: finalCategory,
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
        setAssignee("Maria");
        setDueDate("");
        setSubmitError("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl">
                        Add New Task
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Task Title *</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What needs to be done?"
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add more details..."
                            rows={2}
                        />
                    </div>

                    {/* Priority + Category */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
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
                            {category === CUSTOM_CATEGORY_VALUE ? (
                                <Input
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    placeholder="Write category"
                                />
                            ) : null}
                        </div>
                    </div>

                    {/* Assignee + Due Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Assign to</Label>
                            <Select value={assignee} onValueChange={setAssignee}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignees.map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input
                                id="dueDate"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={handleClose} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={!title.trim() || saving}>
                            <Plus className="h-4 w-4 mr-2" />
                            {saving ? "Saving..." : "Add Task"}
                        </Button>
                    </div>
                    {submitError ? (
                        <p className="text-sm text-destructive">{submitError}</p>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AddTaskDialog;
