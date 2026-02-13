import { useState } from "react";
import { motion } from "framer-motion";
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

const AddTaskDialog = ({ open, onOpenChange, onAddTask }) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("medium");
    const [category, setCategory] = useState("Other");
    const [assignee, setAssignee] = useState("Maria");
    const [dueDate, setDueDate] = useState("");

    const handleSubmit = () => {
        if (!title.trim()) return;

        const newTask = {
            id: crypto.randomUUID(),
            title: title.trim(),
            description: description.trim() || "",
            status: "todo",
            priority,
            assignee,
            category,
            dueDate: dueDate || "",
        };

        onAddTask(newTask);
        handleClose();
    };

    const handleClose = () => {
        setTitle("");
        setDescription("");
        setPriority("medium");
        setCategory("Other");
        setAssignee("Maria");
        setDueDate("");
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

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 mt-4"
                >
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
                                </SelectContent>
                            </Select>
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
                        <Button variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={!title.trim()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Task
                        </Button>
                    </div>
                </motion.div>
            </DialogContent>
        </Dialog>
    );
};

export default AddTaskDialog;
