import React, { useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Plus, X, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import KanbanBoard from "./KanbanBoard";
import ResponsibilityChart from "./ResponsibilityChart";
import CalendarWidget from "./CalendarWidget";
import QuickStats from "./QuickStats";
import WeeklyProgress from "./WeeklyProgress";
import RecentActivity from "./RecentActivity";
import UpcomingDeadlines from "./UpcomingDeadlines";
import MoodTracker from "./MoodTracker";

// ---- Widget registry ----
const allWidgets = [
    {
        id: "kanban",
        title: "Task Board",
        component: KanbanBoard,
        size: "large",
        description: "Kanban board with task columns",
    },
    {
        id: "stats",
        title: "Quick Stats",
        component: QuickStats,
        size: "medium",
        description: "Overview of key metrics",
    },
    {
        id: "responsibility",
        title: "Responsibility Split",
        component: ResponsibilityChart,
        size: "small",
        description: "Pie chart of household responsibility",
    },
    {
        id: "calendar",
        title: "Calendar",
        component: CalendarWidget,
        size: "medium",
        description: "Upcoming events and dates",
    },
    {
        id: "progress",
        title: "Weekly Progress",
        component: WeeklyProgress,
        size: "medium",
        description: "Weekly task completion chart",
    },
    {
        id: "activity",
        title: "Recent Activity",
        component: RecentActivity,
        size: "small",
        description: "Latest actions and updates",
    },
    {
        id: "deadlines",
        title: "Upcoming Deadlines",
        component: UpcomingDeadlines,
        size: "small",
        description: "Tasks due soon",
    },
    {
        id: "mood",
        title: "Mood Tracker",
        component: MoodTracker,
        size: "small",
        description: "Track daily mood and energy",
    },
];

const sizeClasses = {
    small: "col-span-1 row-span-1",
    medium: "col-span-1 row-span-1 md:col-span-1",
    large: "col-span-1 md:col-span-2 row-span-1 md:row-span-1",
};

// ---- Sortable widget card ----
const SortableWidget = ({ widget, onRemove }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: widget.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const Component = widget.component;

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`widget-card relative group ${sizeClasses[widget.size]} ${widget.id === "stats" ? "max-h-[360px]" : ""
                } ${isDragging ? "widget-card-dragging opacity-50" : ""}`}
        >
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                    onClick={() => onRemove(widget.id)}
                    className="p-1.5 rounded-lg bg-muted/80 text-muted-foreground hover:text-destructive transition-colors"
                    type="button"
                >
                    <X className="w-3.5 h-3.5" />
                </button>

                {/* drag handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="p-1.5 rounded-lg bg-muted/80 cursor-grab active:cursor-grabbing"
                    role="button"
                    tabIndex={0}
                >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                </div>
            </div>

            <Component />
        </motion.div>
    );
};

const WidgetOverlay = ({ widget }) => {
    const Component = widget.component;
    return (
        <div className={`widget-card widget-card-dragging ${sizeClasses[widget.size]}`}>
            <Component />
        </div>
    );
};

// ---- Main grid ----
const DashboardGrid = () => {
    const [activeWidgetIds, setActiveWidgetIds] = useState([
        "kanban",
        "stats",
        "responsibility",
        "calendar",
        "progress",
    ]);

    const [activeId, setActiveId] = useState(null);
    const [isManageOpen, setIsManageOpen] = useState(false);

    const activeWidgets = activeWidgetIds
        .map((id) => allWidgets.find((w) => w.id === id))
        .filter(Boolean);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event) => {
        setActiveId(String(event.active.id));
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            setActiveWidgetIds((items) => {
                const oldIndex = items.indexOf(String(active.id));
                const newIndex = items.indexOf(String(over.id));
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleRemove = (id) => {
        setActiveWidgetIds((prev) => prev.filter((wid) => wid !== id));
    };

    const handleAdd = (id) => {
        setActiveWidgetIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    const activeWidget = allWidgets.find((w) => w.id === activeId);

    return (
        <>
            <div className="flex items-center justify-end mb-4">
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsManageOpen(true)}
                >
                    <Plus className="w-4 h-4" /> Manage Widgets
                </Button>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={activeWidgetIds} strategy={rectSortingStrategy}>
                    {/* ✅ MATCH OLD GRID ROW HEIGHT */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[360px]">
                        <AnimatePresence>
                            {activeWidgets.map((widget) => (
                                <SortableWidget
                                    key={widget.id}
                                    widget={widget}
                                    onRemove={handleRemove}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </SortableContext>

                <DragOverlay>
                    {activeWidget ? <WidgetOverlay widget={activeWidget} /> : null}
                </DragOverlay>
            </DndContext>

            <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-display text-xl">
                            Manage Widgets
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-4">
                        {allWidgets.map((widget) => {
                            const isActive = activeWidgetIds.includes(widget.id);

                            return (
                                <div
                                    key={widget.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            {widget.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {widget.description}
                                        </p>
                                    </div>

                                    <Button
                                        variant={isActive ? "outline" : "default"}
                                        size="sm"
                                        onClick={() =>
                                            isActive ? handleRemove(widget.id) : handleAdd(widget.id)
                                        }
                                        className="gap-1.5 flex-shrink-0"
                                    >
                                        {isActive ? (
                                            <>
                                                <EyeOff className="w-3.5 h-3.5" /> Hide
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-3.5 h-3.5" /> Show
                                            </>
                                        )}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default DashboardGrid;
