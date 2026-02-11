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
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";

import KanbanBoard from "./KanbanBoard";
import ResponsibilityChart from "./ResponsibilityChart";
import CalendarWidget from "./CalendarWidget";
import QuickStats from "./QuickStats";
import WeeklyProgress from "./WeeklyProgress";

// Widgets config (JSX version)
const initialWidgets = [
    { id: "kanban", title: "Task Board", component: KanbanBoard, size: "large" },
    { id: "stats", title: "Quick Stats", component: QuickStats, size: "medium" },
    { id: "responsibility", title: "Responsibility", component: ResponsibilityChart, size: "small" },
    { id: "calendar", title: "Calendar", component: CalendarWidget, size: "medium" },
    { id: "progress", title: "Weekly Progress", component: WeeklyProgress, size: "medium" },
];

const sizeClasses = {
    small: "col-span-1 row-span-1",
    medium: "col-span-1 row-span-1 md:col-span-1",
    mediumTall: "col-span-1 row-span-2",
    large: "col-span-1 md:col-span-2 row-span-1 md:row-span-1",
};

const SortableWidget = ({ widget }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: widget.id });

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
            className={`
        widget-card relative group
        ${sizeClasses[widget.size]}
        ${widget.id === "stats" ? "max-h-[360px]" : ""}
        ${isDragging ? "widget-card-dragging opacity-50" : ""}
      `}
        >
            <div
                {...attributes}
                {...listeners}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
            >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
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

const DashboardGrid = () => {
    const [widgets, setWidgets] = useState(initialWidgets);
    const [activeId, setActiveId] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
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
            setWidgets((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const activeWidget = widgets.find((w) => w.id === activeId);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[360px]">
                    {widgets.map((widget) => (
                        <SortableWidget key={widget.id} widget={widget} />
                    ))}
                </div>
            </SortableContext>

            <DragOverlay>
                {activeWidget ? <WidgetOverlay widget={activeWidget} /> : null}
            </DragOverlay>
        </DndContext>
    );
};

export default DashboardGrid;
