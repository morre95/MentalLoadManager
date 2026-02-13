import { useState } from "react";
import { motion } from "framer-motion";
import {
    ListTodo,
    Plus,
    GripVertical,
    PauseCircle,
    Clock,
    CheckCircle2,
    Circle,
} from "lucide-react";

import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    useDroppable,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import AddTaskDialog from "@/components/tasks/AddTaskDialog";
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";

import { useTaskboardTasks } from "@/hooks/useTaskboardTasks";

const priorityColors = {
    low: "bg-sage-light text-sage border-sage/30",
    medium: "bg-status-todo/15 text-status-todo border-status-todo/30",
    high: "bg-terracotta-light text-terracotta border-terracotta/30",
};

const columns = [
    { id: "todo", title: "To Do", colorClass: "bg-status-todo", icon: Circle },
    { id: "in-progress", title: "In Progress", colorClass: "bg-status-doing", icon: Clock },
    { id: "on-hold", title: "On Hold", colorClass: "bg-[hsl(var(--lavender))]", icon: PauseCircle },
    { id: "done", title: "Done", colorClass: "bg-status-done", icon: CheckCircle2 },
];

// Sortable task card
const SortableTaskCard = ({ task, onToggleStatus, onClick }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""}>
            <div
                className={`p-3 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer ${task.status === "done" ? "opacity-60" : ""
                    }`}
                onClick={onClick}
            >
                <div className="flex items-start gap-3">
                    <div
                        className="flex items-center gap-2 pt-0.5 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
                            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                        <Checkbox
                            checked={task.status === "done"}
                            onCheckedChange={() => onToggleStatus(task.id)}
                        />
                    </div>

                    <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className={`font-medium truncate ${task.status === "done"
                                        ? "line-through text-muted-foreground"
                                        : "text-foreground"
                                    }`}
                            >
                                {task.title}
                            </span>
                            <Badge
                                variant="outline"
                                className={`text-xs flex-shrink-0 ${priorityColors[task.priority]}`}
                            >
                                {task.priority}
                            </Badge>
                        </div>

                        {task.description ? (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                                {task.description}
                            </p>
                        ) : null}

                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-muted truncate max-w-[100px]">
                                {task.category}
                            </span>
                            <span className="truncate">{task.assignee}</span>
                            {task.dueDate ? (
                                <span className={`flex-shrink-0 ${task.dueDate === "Today" ? "text-terracotta font-medium" : ""}`}>
                                    {task.dueDate}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Overlay card while dragging
const TaskOverlayCard = ({ task }) => (
    <div className="p-3 rounded-lg border bg-card shadow-xl ring-2 ring-primary/20 w-72">
        <div className="flex items-center gap-2">
            <span className="font-medium truncate text-foreground">{task.title}</span>
            <Badge variant="outline" className={`text-xs flex-shrink-0 ${priorityColors[task.priority]}`}>
                {task.priority}
            </Badge>
        </div>
    </div>
);

// Droppable column
const DroppableColumn = ({
    id,
    title,
    colorClass,
    tasks,
    onToggleStatus,
    onClickTask,
    onAddTask,
}) => {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <Card className={`border-border min-w-0 transition-colors ${isOver ? "ring-2 ring-primary/30 bg-primary/5" : ""}`}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colorClass}`} />
                    <span className="truncate">{title}</span>
                    <Badge variant="secondary" className="ml-auto flex-shrink-0">
                        {tasks.length}
                    </Badge>
                </CardTitle>
            </CardHeader>

            <CardContent ref={setNodeRef} className="space-y-3 min-h-[60px]">
                <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map((task) => (
                        <SortableTaskCard
                            key={task.id}
                            task={task}
                            onToggleStatus={onToggleStatus}
                            onClick={() => onClickTask(task)}
                        />
                    ))}
                </SortableContext>

                {id === "todo" && onAddTask ? (
                    <Button
                        variant="ghost"
                        className="w-full border-2 border-dashed border-border text-muted-foreground hover:text-foreground"
                        onClick={onAddTask}
                    >
                        <Plus className="h-4 w-4 mr-2" /> Add Task
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    );
};

const Tasks = () => {
    const { tasks, setTasks, loading, error } = useTaskboardTasks();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [activeId, setActiveId] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleToggleStatus = (id) => {
        setTasks((prev) =>
            prev.map((task) =>
                task.id === id
                    ? { ...task, status: task.status === "done" ? "todo" : "done" }
                    : task
            )
        );
    };

    const handleAddTask = (newTask) => {
        setTasks((prev) => [newTask, ...prev]);
    };

    const findColumnForTask = (taskId) => {
        const t = tasks.find((x) => x.id === taskId);
        return t ? t.status : undefined;
    };

    const handleDragStart = (event) => {
        setActiveId(String(event.active.id));
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeTaskId = String(active.id);
        const overId = String(over.id);

        const isOverColumn = columns.some((c) => c.id === overId);
        const targetColumn = isOverColumn ? overId : findColumnForTask(overId);
        if (!targetColumn) return;

        const activeColumn = findColumnForTask(activeTaskId);
        if (activeColumn !== targetColumn) {
            setTasks((prev) =>
                prev.map((t) => (t.id === activeTaskId ? { ...t, status: targetColumn } : t))
            );
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const aId = String(active.id);
        const oId = String(over.id);

        const isOverColumn = columns.some((c) => c.id === oId);

        // Reorder within same column
        if (!isOverColumn && aId !== oId) {
            const activeColumn = findColumnForTask(aId);
            const overColumn = findColumnForTask(oId);

            if (activeColumn && activeColumn === overColumn) {
                setTasks((prev) => {
                    const columnTasks = prev.filter((t) => t.status === activeColumn);
                    const otherTasks = prev.filter((t) => t.status !== activeColumn);
                    const oldIndex = columnTasks.findIndex((t) => t.id === aId);
                    const newIndex = columnTasks.findIndex((t) => t.id === oId);
                    return [...otherTasks, ...arrayMove(columnTasks, oldIndex, newIndex)];
                });
            }
        }
    };

    const activeTask = tasks.find((t) => t.id === activeId);

    const getColumnTasks = (status) => tasks.filter((t) => t.status === status);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                        <ListTodo className="h-7 w-7 text-primary" /> Tasks
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Drag tasks between columns to update status
                    </p>
                    {loading ? (
                        <p className="text-sm text-muted-foreground mt-2">Loading tasks…</p>
                    ) : null}
                    {error ? (
                        <p className="text-sm text-red-600 mt-2">Error: {error}</p>
                    ) : null}
                </div>

                <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Task</span>
                </Button>
            </motion.div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                    {columns.map((col) => (
                        <DroppableColumn
                            key={col.id}
                            id={col.id}
                            title={col.title}
                            colorClass={col.colorClass}
                            tasks={getColumnTasks(col.id)}
                            onToggleStatus={handleToggleStatus}
                            onClickTask={setSelectedTask}
                            onAddTask={col.id === "todo" ? () => setIsAddDialogOpen(true) : undefined}
                        />
                    ))}
                </motion.div>

                <DragOverlay>
                    {activeTask ? <TaskOverlayCard task={activeTask} /> : null}
                </DragOverlay>
            </DndContext>

            <AddTaskDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onAddTask={handleAddTask}
            />

            <TaskDetailDialog
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
                onToggleStatus={handleToggleStatus}
            />
        </div>
    );
};

export default Tasks;
