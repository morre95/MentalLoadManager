import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    parseISO,
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
    const [view, setView] = useState("month"); // "month" | "week"

    const {
        monthEvents,
        weekEvents,
        eventsByDayKey,
        loadingMonth,
        loadingWeek,
        error,
        loadMonth,
        loadWeekRange,
    } = useCalendarPage();

    // Month + week boundaries
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);
    const paddingDays = Array(startDayOfWeek).fill(null);

    const weekStart = startOfWeek(currentWeek);
    const weekEnd = endOfWeek(currentWeek);
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });


    // Load month events whenever currentMonth changes
    useEffect(() => {
        loadMonth(currentMonth);
    }, [currentMonth, loadMonth]);

    // Load “Upcoming this week” based on currentWeek (robust across months)
    const weekStartKey = format(weekStart, "yyyy-MM-dd");
    const weekEndKey = format(weekEnd, "yyyy-MM-dd");

    useEffect(() => {
        loadWeekRange(weekStartKey, weekEndKey);
    }, [weekStartKey, weekEndKey, loadWeekRange]);

    // Helper: events for a day from month cache
    const getEventsForDate = (date) => {
        const key = format(date, "yyyy-MM-dd");
        return eventsByDayKey.get(key) || [];
    };

    const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

    const navigateBack = () => {
        if (view === "month") setCurrentMonth(subMonths(currentMonth, 1));
        else setCurrentWeek(subWeeks(currentWeek, 1));
    };

    const navigateForward = () => {
        if (view === "month") setCurrentMonth(addMonths(currentMonth, 1));
        else setCurrentWeek(addWeeks(currentWeek, 1));
    };

    const headerTitle =
        view === "month"
            ? format(currentMonth, "MMMM yyyy")
            : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

    const todayStart = startOfDay(new Date());

    const renderDayCell = (day, isInRange = true) => {
        const dayEvents = getEventsForDate(day);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isCurrentDay = isToday(day);

        // overdue: any event on this day AND day is before today
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

                {view === "week" && dayEvents.length > 0 && (
                    <div className="mt-1 space-y-1 w-full">
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
                )}

                {view === "month" && dayEvents.length > 0 && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((event, i) => (
                            <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : ""}`}
                                style={{ backgroundColor: isSelected ? undefined : `hsl(var(--${event.color}))` }}
                                title={event.householdName}
                            />
                        ))}
                    </div>
                )}
            </motion.button>
        );
    };

    // Upcoming this week: use range endpoint results
    const upcomingThisWeek = useMemo(() => {
        // weekEvents are already range-filtered; just sort
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

                    {loadingMonth && <p className="text-sm text-muted-foreground mt-2">Loading month…</p>}
                    {error && (
                        <p className="text-sm text-destructive mt-2">
                            {error?.message || "Failed to load calendar"}
                        </p>
                    )}
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
                                    <Tabs value={view} onValueChange={(v) => setView(v)}>
                                        <TabsList className="h-8">
                                            <TabsTrigger value="month" className="text-xs px-3">
                                                Month
                                            </TabsTrigger>
                                            <TabsTrigger value="week" className="text-xs px-3">
                                                Week
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
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
                            ) : (
                                <div className="grid grid-cols-7 gap-1">
                                    {daysInWeek.map((day) => renderDayCell(day))}
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
                                                        {overdue ? "overdue" : "task"}
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
                                            <div
                                                key={event.id}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
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
                                            </div>
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