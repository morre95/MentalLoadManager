import { useState } from "react";
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
} from "date-fns";

const sampleEvents = [
    { id: "1", title: "Pay electricity bill", date: new Date(2026, 1, 12), type: "task", color: "terracotta" },
    { id: "2", title: "Dentist appointment", date: new Date(2026, 1, 15), type: "event", color: "lavender" },
    { id: "3", title: "Grocery shopping", date: new Date(2026, 1, 9), type: "task", color: "sage" },
    { id: "4", title: "Team dinner", date: new Date(2026, 1, 20), type: "event", color: "sky" },
    { id: "5", title: "Car service", date: new Date(2026, 1, 25), type: "reminder", color: "terracotta" },
    { id: "6", title: "Weekly review", date: new Date(2026, 1, 14), type: "task", color: "sage" },
    { id: "7", title: "Movie night", date: new Date(2026, 1, 21), type: "event", color: "lavender" },
    { id: "8", title: "Laundry day", date: new Date(2026, 1, 11), type: "task", color: "sage" },
    { id: "9", title: "Birthday party", date: new Date(2026, 1, 28), type: "event", color: "terracotta" },
];

const eventColorClasses = {
    sage: "bg-sage-light text-sage border-sage/30",
    terracotta: "bg-terracotta-light text-terracotta border-terracotta/30",
    lavender: "bg-lavender-light text-lavender border-lavender/30",
    sky: "bg-sky-light text-sky border-sky/30",
};

const Calendar = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date(2026, 1, 1));
    const [currentWeek, setCurrentWeek] = useState(new Date(2026, 1, 9));
    const [selectedDate, setSelectedDate] = useState(new Date(2026, 1, 9));
    const [view, setView] = useState("month"); // "month" | "week"
    const [googleConnected, setGoogleConnected] = useState(false);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);
    const paddingDays = Array(startDayOfWeek).fill(null);

    const weekStart = startOfWeek(currentWeek);
    const weekEnd = endOfWeek(currentWeek);
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const getEventsForDate = (date) => sampleEvents.filter((event) => isSameDay(event.date, date));
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

    const renderDayCell = (day, isInRange = true) => {
        const dayEvents = getEventsForDate(day);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isCurrentDay = isToday(day);

        return (
            <motion.button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`p-1 rounded-lg relative transition-colors ${view === "month" ? "aspect-square" : "min-h-[100px] flex flex-col items-start"
                    } ${isSelected ? "bg-primary text-primary-foreground" : isCurrentDay ? "bg-sage-light" : "hover:bg-muted"
                    } ${!isInRange ? "opacity-40" : ""}`}
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
                                className={`text-xs px-1.5 py-0.5 rounded truncate ${isSelected ? "bg-primary-foreground/20 text-primary-foreground" : eventColorClasses[event.color]
                                    }`}
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
                            />
                        ))}
                    </div>
                )}
            </motion.button>
        );
    };

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
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant={googleConnected ? "default" : "outline"}
                        size="sm"
                        className="gap-2"
                        onClick={() => setGoogleConnected(!googleConnected)}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        {googleConnected ? "Google Connected" : "Connect Google Calendar"}
                    </Button>

                    <Button className="gap-2">
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
                                    <h2 className="font-display text-lg md:text-xl font-semibold text-foreground">{headerTitle}</h2>
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
                                    <div key={day} className="text-center text-xs md:text-sm font-medium text-muted-foreground py-2">
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
                                    {selectedDateEvents.map((event) => (
                                        <motion.div
                                            key={event.id}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className={`p-3 rounded-lg border ${eventColorClasses[event.color]}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{event.title}</span>
                                                <Badge variant="outline" className="text-xs capitalize">
                                                    {event.type}
                                                </Badge>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-muted-foreground">No events scheduled</p>
                                    <Button variant="outline" size="sm" className="mt-3 gap-2">
                                        <Plus className="h-4 w-4" /> Add Event
                                    </Button>
                                </div>
                            )}

                            {googleConnected && (
                                <div className="mt-6 p-4 rounded-lg border border-dashed border-sky/30 bg-sky-light">
                                    <div className="flex items-center gap-2 text-sky text-sm font-medium mb-2">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                                            <path
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                fill="#34A853"
                                            />
                                            <path
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                fill="#EA4335"
                                            />
                                        </svg>
                                        Google Calendar
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Google Calendar events will appear here once you complete the integration setup.
                                    </p>
                                </div>
                            )}

                            <div className="mt-6">
                                <h4 className="font-medium text-foreground mb-3">Upcoming This Week</h4>
                                <div className="space-y-2">
                                    {sampleEvents.slice(0, 4).map((event) => (
                                        <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                            <div
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: `hsl(var(--${event.color}))` }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                                                <p className="text-xs text-muted-foreground">{format(event.date, "MMM d")}</p>
                                            </div>
                                        </div>
                                    ))}
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