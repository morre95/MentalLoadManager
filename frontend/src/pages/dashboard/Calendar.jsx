import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, subDays } from "date-fns";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    isToday,
    getDay,
    isBefore,
    startOfDay,
} from "date-fns";

import { useCalendarPage } from "@/hooks/useCalendarPage";
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";
import { useTaskboardTasks } from "@/hooks/useTaskboardTasks";
import { useHousehold } from "@/hooks/useHouseHold";
import {
    deleteKanbanTask,
    updateKanbanTaskAssignee,
    updateKanbanTaskCategory,
    updateKanbanTaskDescription,
    updateKanbanTaskDueDate,
    updateKanbanTaskName,
    updateKanbanTaskPriority,
    updateKanbanTaskStatus,
} from "@/lib/utils";

const eventColorClasses = {
    terracotta: "bg-terracotta-light text-terracotta border-terracotta/30",
    lavender: "bg-lavender-light text-lavender border-lavender/30",
    sky: "bg-sky-light text-sky border-sky/30",
    "status-todo": "bg-status-todo/15 text-status-todo border-status-todo/30",
};

function toApiStatus(status) {
    if (status === "in-progress") return "in_progress";
    if (status === "on-hold") return "on_hold";
    return status;
}

function toDisplayDueDate(dateInputValue) {
    if (!dateInputValue) return undefined;
    return new Date(`${dateInputValue}T00:00:00`).toLocaleDateString();
}

const Calendar = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [currentWeek, setCurrentWeek] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState("month");

    const {
        weekEvents,
        monthEventsByDayKey,
        rangeEventsByDayKey,
        loadingMonth,
        loadingWeek,
        monthError,
        weekError,
        loadMonth,
        loadWeekRange,
        householdColorById,
        householdPalette,
    } = useCalendarPage();
    const { households } = useHousehold();
    const { tasks, setTasks } = useTaskboardTasks(null);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [draggedTaskId, setDraggedTaskId] = useState(null);
    const [dragOverDayKey, setDragOverDayKey] = useState(null);
    const [syncError, setSyncError] = useState(null);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);
    const paddingDays = Array(startDayOfWeek).fill(null);

    const weekStart = startOfWeek(currentWeek);
    const weekEnd = endOfWeek(currentWeek);
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const selectedTask = selectedTaskId
        ? tasks.find((task) => String(task.id) === String(selectedTaskId)) || null
        : null;

    const refreshCalendarData = async () => {
        await Promise.all([
            loadMonth(currentMonth, { force: true }),
            loadWeekRange(weekStart, weekEnd, { force: true }),
        ]);
    };

    const handleUpdateTaskDetails = (taskId, updates) => {
        setTasks((prev) =>
            prev.map((task) => (String(task.id) === String(taskId) ? { ...task, ...updates } : task))
        );
    };

    const findTaskByEvent = (event) => {
        return tasks.find((task) => String(task.id) === String(event?.id)) || null;
    };

    const openTaskDialogFromEvent = (event) => {
        const task = findTaskByEvent(event);
        if (!task) return;
        setSelectedTaskId(task.id);
        setSyncError(null);
    };

    const moveTaskToDate = async (taskId, targetDate) => {
        const rollbackTasks = tasks;
        setSyncError(null);

        handleUpdateTaskDetails(taskId, {
            dueDateValue: targetDate,
            dueDate: toDisplayDueDate(targetDate),
        });

        try {
            const dueDateIso = targetDate
                ? new Date(`${targetDate}T00:00:00`).toISOString()
                : null;
            await updateKanbanTaskDueDate(taskId, dueDateIso);
            await refreshCalendarData();
        } catch (error) {
            setTasks(rollbackTasks);
            setSyncError(error);
        }
    };

    useEffect(() => {
        loadMonth(currentMonth).catch(() => { });
    }, [currentMonth, loadMonth]);

    useEffect(() => {
        loadWeekRange(weekStart, weekEnd).catch(() => { });
    }, [weekStart, weekEnd, loadWeekRange]);

    useEffect(() => {
        if (view !== "day") return;

        queueMicrotask(() => {
            setCurrentWeek(selectedDate);
            setCurrentMonth(selectedDate);
        });
    }, [view, selectedDate]);

    const getEventsForDate = (date) => {
        const key = format(date, "yyyy-MM-dd");

        if (view === "week" || view === "day") {
            return rangeEventsByDayKey.get(key) || [];
        }

        return monthEventsByDayKey.get(key) || [];
    };

    const handleUpdateTaskStatus = async (taskId, nextStatus) => {
        const rollbackTasks = tasks;
        setSyncError(null);
        handleUpdateTaskDetails(taskId, { status: nextStatus });

        try {
            await updateKanbanTaskStatus(taskId, toApiStatus(nextStatus));
            await refreshCalendarData();
        } catch (error) {
            setTasks(rollbackTasks);
            setSyncError(error);
        }
    };

    const handleUpdateTaskPriority = async (taskId, nextPriority) => {
        const rollbackTasks = tasks;
        setSyncError(null);
        handleUpdateTaskDetails(taskId, { priority: nextPriority });

        try {
            await updateKanbanTaskPriority(taskId, nextPriority);
        } catch (error) {
            setTasks(rollbackTasks);
            setSyncError(error);
        }
    };

    const handleUpdateTaskDueDate = async (taskId, dueDateInputValue) => {
        await moveTaskToDate(taskId, dueDateInputValue || null);
    };

    const handleUpdateTaskDescription = async (taskId, nextDescription) => {
        const rollbackTasks = tasks;
        setSyncError(null);
        handleUpdateTaskDetails(taskId, { description: nextDescription || "" });

        try {
            await updateKanbanTaskDescription(taskId, nextDescription || null);
        } catch (error) {
            setTasks(rollbackTasks);
            setSyncError(error);
        }
    };

    const handleUpdateTaskTitle = async (taskId, nextTitle) => {
        const rollbackTasks = tasks;
        setSyncError(null);
        handleUpdateTaskDetails(taskId, { title: nextTitle });

        try {
            await updateKanbanTaskName(taskId, nextTitle);
            await refreshCalendarData();
        } catch (error) {
            setTasks(rollbackTasks);
            setSyncError(error);
        }
    };

    const handleUpdateTaskAssignee = async (taskId, assigneeId, assigneeLabel) => {
        const rollbackTasks = tasks;
        setSyncError(null);
        handleUpdateTaskDetails(taskId, {
            assigneeId: assigneeId || undefined,
            assigneeLabel: assigneeLabel || "Unassigned",
        });

        try {
            await updateKanbanTaskAssignee(taskId, assigneeId || null);
        } catch (error) {
            setTasks(rollbackTasks);
            setSyncError(error);
        }
    };

    const handleUpdateTaskCategory = async (taskId, nextCategory) => {
        const rollbackTasks = tasks;
        setSyncError(null);
        handleUpdateTaskDetails(taskId, { category: nextCategory || "Other" });

        try {
            await updateKanbanTaskCategory(taskId, nextCategory || null);
        } catch (error) {
            setTasks(rollbackTasks);
            setSyncError(error);
        }
    };

    const handleDeleteTask = async (taskId) => {
        const rollbackTasks = tasks;
        setSyncError(null);
        setTasks((prev) => prev.filter((task) => String(task.id) !== String(taskId)));
        setSelectedTaskId(null);

        try {
            await deleteKanbanTask(taskId);
            await refreshCalendarData();
        } catch (error) {
            setTasks(rollbackTasks);
            setSyncError(error);
        }
    };

    const handleTaskDragStart = (dragEvent, event) => {
        const task = findTaskByEvent(event);
        if (!task) return;

        const taskId = String(task.id);
        dragEvent.dataTransfer.setData("text/task-id", taskId);
        dragEvent.dataTransfer.effectAllowed = "move";
        setDraggedTaskId(taskId);
    };

    const handleTaskDragEnd = () => {
        setDraggedTaskId(null);
        setDragOverDayKey(null);
    };

    const handleDayDragOver = (dragEvent, day) => {
        if (!draggedTaskId) return;
        dragEvent.preventDefault();
        setDragOverDayKey(format(day, "yyyy-MM-dd"));
    };

    const handleDayDrop = async (dragEvent, day) => {
        dragEvent.preventDefault();
        const dropTaskId = dragEvent.dataTransfer.getData("text/task-id") || draggedTaskId;
        const nextDate = format(day, "yyyy-MM-dd");

        setDragOverDayKey(null);
        setDraggedTaskId(null);

        if (!dropTaskId) return;

        const targetTask = tasks.find((task) => String(task.id) === String(dropTaskId));
        if (!targetTask) return;
        if (targetTask.dueDateValue === nextDate) return;

        await moveTaskToDate(dropTaskId, nextDate);
    };

    const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

    const navigateBack = () => {
        if (view === "month") {
            setCurrentMonth(subMonths(currentMonth, 1));
            return;
        }

        if (view === "week") {
            setCurrentWeek(subWeeks(currentWeek, 1));
            return;
        }

        const nextDate = subDays(selectedDate, 1);
        setSelectedDate(nextDate);
        setCurrentWeek(nextDate);
        setCurrentMonth(nextDate);
    };

    const navigateForward = () => {
        if (view === "month") {
            setCurrentMonth(addMonths(currentMonth, 1));
            return;
        }

        if (view === "week") {
            setCurrentWeek(addWeeks(currentWeek, 1));
            return;
        }

        const nextDate = addDays(selectedDate, 1);
        setSelectedDate(nextDate);
        setCurrentWeek(nextDate);
        setCurrentMonth(nextDate);
    };

    const goToToday = () => {
        const now = new Date();
        setCurrentMonth(now);
        setCurrentWeek(now);
        setSelectedDate(now);
    };

    const headerTitle =
        view === "month"
            ? format(currentMonth, "MMMM yyyy")
            : view === "week"
                ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
                : format(selectedDate, "EEEE, MMM d, yyyy");

    const todayStart = startOfDay(new Date());

    const renderDayCell = (day, isInRange = true) => {
        const dayEvents = getEventsForDate(day);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isCurrentDay = isToday(day);
        const dayKey = format(day, "yyyy-MM-dd");
        const isDragTarget = draggedTaskId && dragOverDayKey === dayKey;
        const isDayView = view === "day";
        const showSelectedStyle = isSelected && !isDayView;

        return (
            <motion.button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                onDragOver={(dragEvent) => handleDayDragOver(dragEvent, day)}
                onDragEnter={(dragEvent) => handleDayDragOver(dragEvent, day)}
                onDragLeave={() => {
                    if (dragOverDayKey === dayKey) setDragOverDayKey(null);
                }}
                onDrop={(dragEvent) => handleDayDrop(dragEvent, day)}
                className={`p-1 rounded-lg relative transition-colors ${view === "month" ? "aspect-square" : "min-h-[100px] flex flex-col items-start"
                    } ${isDayView
                        ? "hover:bg-muted/30"
                        : showSelectedStyle
                        ? "bg-primary text-primary-foreground"
                        : isCurrentDay
                            ? "bg-sage-light"
                            : "hover:bg-muted"
                    } ${!isInRange ? "opacity-40" : ""} ${isDragTarget ? "ring-2 ring-primary/60 bg-primary/10" : ""
                    }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <span className={`text-sm font-medium ${!isInRange ? "text-muted-foreground/50" : ""}`}>
                    {format(day, "d")}
                </span>

                {(view === "week" || view === "day") && dayEvents.length > 0 ? (
                    <div className="mt-2 space-y-2 w-full">
                        {dayEvents.map((event) => {
                            const linkedTask = findTaskByEvent(event);
                            const category = linkedTask?.category || "Other";
                            const isWeekView = view === "week";
                            const isDraggingTask = String(event.id) === String(draggedTaskId || "");

                            return (
                                <div
                                    key={event.id}
                                    draggable
                                    onDragStart={(dragEvent) => handleTaskDragStart(dragEvent, event)}
                                    onDragEnd={handleTaskDragEnd}
                                    onClick={(mouseEvent) => {
                                        mouseEvent.stopPropagation();
                                        openTaskDialogFromEvent(event);
                                    }}
                                    className={`text-sm px-2 py-1.5 rounded-md whitespace-normal break-words transition-all relative ${showSelectedStyle
                                            ? "bg-primary-foreground/20 text-primary-foreground"
                                            : eventColorClasses[event.color]
                                        } ${isWeekView ? "cursor-grab active:cursor-grabbing border-dashed hover:shadow-md hover:-translate-y-0.5" : ""
                                        } ${isDraggingTask ? "opacity-60 ring-2 ring-primary/40" : ""}`}
                                    title={`${event.title} • ${event.householdName}`}
                                >
                                    {isWeekView ? (
                                        <GripVertical className="pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 opacity-70" />
                                    ) : null}
                                    <div className="font-medium leading-snug">{event.title}</div>
                                    <div className="text-xs opacity-80 mt-0.5">{category}</div>
                                </div>
                            );
                        })}
                    </div>
                ) : null}

                {view === "month" && dayEvents.length > 0 ? (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                            <div
                                key={event.id}
                                draggable
                                onDragStart={(dragEvent) => handleTaskDragStart(dragEvent, event)}
                                onDragEnd={handleTaskDragEnd}
                                onClick={(mouseEvent) => {
                                    mouseEvent.stopPropagation();
                                    openTaskDialogFromEvent(event);
                                }}
                                className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : ""}`}
                                style={{ backgroundColor: isSelected ? undefined : `hsl(var(--${event.color}))` }}
                                title={event.householdName}
                            />
                        ))}
                    </div>
                ) : null}
            </motion.button>
        );
    };

    const upcomingThisWeek = useMemo(() => {
        return [...weekEvents].sort((a, b) => a.date - b.date);
    }, [weekEvents]);
    const overdueEvents = useMemo(() => {
        const allMonthEvents = [];
        monthEventsByDayKey.forEach((events) => {
            allMonthEvents.push(...events);
        });

        return allMonthEvents
            .filter((event) => isBefore(startOfDay(event.date), todayStart))
            .sort((a, b) => a.date - b.date);
    }, [monthEventsByDayKey, todayStart]);
    const householdLegend = useMemo(() => {
        const list = Array.isArray(households) ? households : [];
        const used = new Set();
        const fallbackQueue = Array.isArray(householdPalette) ? [...householdPalette] : ["terracotta"];

        return list.map((household) => {
            const householdId = household?.household_id ?? household?.id ?? null;
            const householdIdKey = householdId ? String(householdId) : "";
            let color = householdColorById.get(householdIdKey);

            if (!color) {
                const nextUnused = fallbackQueue.find((c) => !used.has(c));
                color = nextUnused || fallbackQueue[0];
            }

            used.add(color);

            return {
                id: householdId ? String(householdId) : household?.name || "household",
                name: household?.name || "Unnamed household",
                color,
            };
        });
    }, [households, householdColorById, householdPalette]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between flex-wrap gap-3"
            >
                <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                        <CalendarIcon className="h-7 w-7 text-primary" /> Calendar
                    </h1>
                    <p className="text-muted-foreground mt-1">View scheduled tasks and deadlines</p>

                    {loadingMonth ? <p className="text-sm text-muted-foreground mt-2">Loading month…</p> : null}
                    {monthError ? (
                        <p className="text-sm text-destructive mt-2">
                            {monthError?.message || "Failed to load calendar month"}
                        </p>
                    ) : null}
                    {!monthError && weekError ? (
                        <p className="text-sm text-destructive mt-2">
                            {weekError?.message || "Failed to load selected week"}
                        </p>
                    ) : null}
                    {syncError ? (
                        <p className="text-sm text-destructive mt-2">
                            {syncError?.message || "Couldn't sync task update. Changes were reverted."}
                        </p>
                    ) : null}
                </div>

                <div className="flex items-center gap-3">
                    <Button className="gap-2" disabled>
                        <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Event</span>
                    </Button>
                </div>
            </motion.div>

            {householdLegend.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                    {householdLegend.map((household) => (
                        <div
                            key={household.id}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs"
                        >
                            <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: `hsl(var(--${household.color}))` }}
                            />
                            <span className="text-foreground">{household.name}</span>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2"
                >
                    <Card className="border-border">
                        <CardContent className="p-4 md:p-6">
                            <div className="flex items-center justify-between mb-6">
                                <Button variant="ghost" size="icon" onClick={navigateBack}>
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>

                                <div className="flex items-center gap-4">
                                    <h2 className="font-display text-lg md:text-xl font-semibold text-foreground">
                                        {headerTitle}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={goToToday}>
                                            Today
                                        </Button>

                                        <Tabs
                                            value={view}
                                            onValueChange={(nextView) => {
                                                setView(nextView);

                                                if (nextView === "day") {
                                                    const anchor = selectedDate ?? new Date();
                                                    setSelectedDate(anchor);
                                                    setCurrentWeek(anchor);
                                                    setCurrentMonth(anchor);
                                                }
                                            }}
                                        >
                                            <TabsList className="h-8">
                                                <TabsTrigger value="month" className="text-xs px-3">
                                                    Month
                                                </TabsTrigger>
                                                <TabsTrigger value="week" className="text-xs px-3">
                                                    Week
                                                </TabsTrigger>
                                                <TabsTrigger value="day" className="text-xs px-3">
                                                    Day
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                </div>

                                <Button variant="ghost" size="icon" onClick={navigateForward}>
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                                    <div
                                        key={day}
                                        className="text-center text-xs md:text-sm font-medium text-muted-foreground py-2"
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {view === "month" ? (
                                <div className="grid grid-cols-7 gap-1">
                                    {paddingDays.map((_, index) => (
                                        <div key={`padding-${index}`} className="aspect-square" />
                                    ))}
                                    {daysInMonth.map((day) => renderDayCell(day, isSameMonth(day, currentMonth)))}
                                </div>
                            ) : view === "week" ? (
                                <div className="grid grid-cols-7 gap-1 auto-rows-fr min-h-[420px]">
                                    {daysInWeek.map((day) => renderDayCell(day))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-1 auto-rows-fr min-h-[420px]">
                                    {renderDayCell(selectedDate, true)}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <Card className="border-border h-full">
                        <CardContent className="p-6">
                            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
                                {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a date"}
                            </h3>

                            {selectedDateEvents.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedDateEvents.map((event) => {
                                        const linkedTask = findTaskByEvent(event);
                                        const category = linkedTask?.category || "Other";

                                        return (
                                            <motion.div
                                                key={event.id}
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                role="button"
                                                tabIndex={0}
                                                draggable
                                                onDragStart={(dragEvent) => handleTaskDragStart(dragEvent, event)}
                                                onDragEnd={handleTaskDragEnd}
                                                onClick={() => openTaskDialogFromEvent(event)}
                                                onKeyDown={(keyboardEvent) => {
                                                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                                                        keyboardEvent.preventDefault();
                                                        openTaskDialogFromEvent(event);
                                                    }
                                                }}
                                                className={`p-3 rounded-lg border ${eventColorClasses[event.color]} cursor-pointer`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <span className="font-medium block truncate">{event.title}</span>
                                                        <span className="text-xs text-muted-foreground block truncate">
                                                            {category}
                                                        </span>
                                                        {event.householdName ? (
                                                            <span className="text-xs text-muted-foreground block truncate">
                                                                {event.householdName}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <Badge variant="outline" className="text-xs capitalize shrink-0">
                                                        {event.type}
                                                    </Badge>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-muted-foreground">No tasks due</p>
                                </div>
                            )}

                            <div className="mt-6">
                                <h4 className="font-medium text-foreground mb-3">Overdue</h4>

                                <div className="space-y-2">
                                    {overdueEvents.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No overdue tasks.</p>
                                    ) : (
                                        overdueEvents.slice(0, 6).map((event) => (
                                            <motion.div
                                                key={`overdue-${event.id}`}
                                                role="button"
                                                tabIndex={0}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => {
                                                    setSelectedDate(event.date);
                                                    setCurrentWeek(event.date);
                                                    setCurrentMonth(event.date);
                                                    openTaskDialogFromEvent(event);
                                                }}
                                                onKeyDown={(keyboardEvent) => {
                                                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                                                        keyboardEvent.preventDefault();
                                                        setSelectedDate(event.date);
                                                        setCurrentWeek(event.date);
                                                        setCurrentMonth(event.date);
                                                        openTaskDialogFromEvent(event);
                                                    }
                                                }}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                            >
                                                <div
                                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: `hsl(var(--${event.color}))` }}
                                                    title={event.householdName}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(event.date, "MMM d")}
                                                        {event.householdName ? ` • ${event.householdName}` : ""}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="mt-6">
                                <h4 className="font-medium text-foreground mb-3 flex items-center justify-between">
                                    Upcoming This Week
                                    {loadingWeek ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
                                </h4>

                                <div className="space-y-2">
                                    {upcomingThisWeek.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Nothing due this week.</p>
                                    ) : (
                                        upcomingThisWeek.slice(0, 6).map((event) => (
                                            <motion.div
                                                key={event.id}
                                                role="button"
                                                tabIndex={0}
                                                draggable
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onDragStart={(dragEvent) => handleTaskDragStart(dragEvent, event)}
                                                onDragEnd={handleTaskDragEnd}
                                                onClick={() => {
                                                    setSelectedDate(event.date);
                                                    setCurrentWeek(event.date);
                                                    setCurrentMonth(event.date);
                                                    setView("week");
                                                    openTaskDialogFromEvent(event);
                                                }}
                                                onKeyDown={(keyboardEvent) => {
                                                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                                                        keyboardEvent.preventDefault();
                                                        setSelectedDate(event.date);
                                                        setCurrentWeek(event.date);
                                                        setCurrentMonth(event.date);
                                                        setView("week");
                                                        openTaskDialogFromEvent(event);
                                                    }
                                                }}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                            >
                                                <div
                                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: `hsl(var(--${event.color}))` }}
                                                    title={event.householdName}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(event.date, "MMM d")}
                                                        {event.householdName ? ` • ${event.householdName}` : ""}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            <TaskDetailDialog
                task={selectedTask}
                open={!!selectedTaskId && !!selectedTask}
                households={households}
                onOpenChange={(open) => !open && setSelectedTaskId(null)}
                onUpdateTask={handleUpdateTaskDetails}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                onUpdateTaskPriority={handleUpdateTaskPriority}
                onUpdateTaskDueDate={handleUpdateTaskDueDate}
                onUpdateTaskDescription={handleUpdateTaskDescription}
                onUpdateTaskTitle={handleUpdateTaskTitle}
                onUpdateTaskAssignee={handleUpdateTaskAssignee}
                onUpdateTaskCategory={handleUpdateTaskCategory}
                onDeleteTask={handleDeleteTask}
            />
        </div>
    );
};

export default Calendar;
