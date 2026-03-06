import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react";
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

const eventColorClasses = {
    sage: "bg-sage-light text-sage border-sage/30",
    terracotta: "bg-terracotta-light text-terracotta border-terracotta/30",
    lavender: "bg-lavender-light text-lavender border-lavender/30",
    sky: "bg-sky-light text-sky border-sky/30",
};

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
    } = useCalendarPage();

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);
    const paddingDays = Array(startDayOfWeek).fill(null);

    const weekStart = startOfWeek(currentWeek);
    const weekEnd = endOfWeek(currentWeek);
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

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
        const isOverdueDay = dayEvents.length > 0 && isBefore(startOfDay(day), todayStart);

        return (
            <motion.button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`p-1 rounded-lg relative transition-colors ${view === "month" ? "aspect-square" : "min-h-[100px] flex flex-col items-start"
                    } ${isSelected
                        ? "bg-primary text-primary-foreground"
                        : isCurrentDay
                            ? "bg-sage-light"
                            : "hover:bg-muted"
                    } ${!isInRange ? "opacity-40" : ""} ${!isSelected && isOverdueDay ? "ring-1 ring-terracotta/40" : ""
                    }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <span className={`text-sm font-medium ${!isInRange ? "text-muted-foreground/50" : ""}`}>
                    {format(day, "d")}
                </span>

                {view === "week" && dayEvents.length > 0 ? (
                    <div className="mt-2 space-y-2 w-full">
                        {dayEvents.map((event) => (
                            <div
                                key={event.id}
                                className={`text-xs px-1.5 py-0.5 rounded truncate ${isSelected
                                        ? "bg-primary-foreground/20 text-primary-foreground"
                                        : eventColorClasses[event.color]
                                    }`}
                                title={`${event.title} • ${event.householdName}`}
                            >
                                {event.title}
                            </div>
                        ))}
                    </div>
                ) : null}

                {view === "month" && dayEvents.length > 0 ? (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                            <div
                                key={event.id}
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
                </div>

                <div className="flex items-center gap-3">
                    <Button className="gap-2" disabled>
                        <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Event</span>
                    </Button>
                </div>
            </motion.div>

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
                                        const overdue = isBefore(startOfDay(event.date), todayStart);

                                        return (
                                            <motion.div
                                                key={event.id}
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={`p-3 rounded-lg border ${eventColorClasses[event.color]} ${overdue ? "ring-1 ring-terracotta/40" : ""
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <span className="font-medium block truncate">{event.title}</span>
                                                        {event.householdName ? (
                                                            <span className="text-xs text-muted-foreground block truncate">
                                                                {event.householdName}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <Badge variant="outline" className="text-xs capitalize shrink-0">
                                                        {overdue ? "overdue" : event.type}
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
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => {
                                                    setSelectedDate(event.date);
                                                    setCurrentWeek(event.date);
                                                    setCurrentMonth(event.date);
                                                    setView("week");
                                                }}
                                                onKeyDown={(keyboardEvent) => {
                                                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                                                        keyboardEvent.preventDefault();
                                                        setSelectedDate(event.date);
                                                        setCurrentWeek(event.date);
                                                        setCurrentMonth(event.date);
                                                        setView("week");
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
        </div>
    );
};

export default Calendar;