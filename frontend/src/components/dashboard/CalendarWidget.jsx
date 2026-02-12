import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Helpers (no library needed)
function toISODate(d) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function addDays(isoDate, daysToAdd) {
    const d = new Date(`${isoDate}T00:00:00`);
    d.setDate(d.getDate() + daysToAdd);
    return toISODate(d);
}

function formatMonthLabel(isoDate) {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function getDayNumber(isoDate) {
    // shows the "6" in the calendar cell
    const d = new Date(`${isoDate}T00:00:00`);
    return d.getDate();
}

// Mock data (used when logged out / API fails)
const mock = {
    startDate: "2026-02-03",
    today: "2026-02-06",
    monthLabel: "Feb 2026",
    events: [
        { id: "1", date: "2026-02-06", title: "Dentist 14:00", person: "Erik" },
        { id: "2", date: "2026-02-07", title: "School meeting", person: "Maria" },
        { id: "3", date: "2026-02-10", title: "Car service", person: "Erik" },
    ],
};

const CalendarWidget = () => {
    const [startDate, setStartDate] = useState(mock.startDate);
    const [today, setToday] = useState(mock.today);
    const [monthLabel, setMonthLabel] = useState(mock.monthLabel);
    const [events, setEvents] = useState(mock.events);

    // Build 7-day strip as ISO dates
    const dates = useMemo(
        () => Array.from({ length: 7 }, (_, i) => addDays(startDate, i)),
        [startDate]
    );

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        let cancelled = false;

        async function load() {
            try {
                const res = await fetch(`${API_BASE_URL}/calendar-widget`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) return;

                const json = await res.json();
                if (!json || typeof json !== "object") return;

                if (cancelled) return;

                if (json.startDate) setStartDate(json.startDate);
                if (json.today) setToday(json.today);
                if (json.monthLabel) setMonthLabel(json.monthLabel);
                else if (json.startDate) setMonthLabel(formatMonthLabel(json.startDate));

                if (Array.isArray(json.events)) {
                    const normalized = json.events.map((e, idx) => ({
                        id: e.id ?? `${e.date}-${idx}`,
                        date: e.date, // YYYY-MM-DD
                        title: e.title ?? "",
                        person: e.person ?? "",
                    }));
                    setEvents(normalized);
                }
            } catch (err) {
                console.error("Failed to fetch calendar widget data:", err);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">Calendar</h3>

                <div className="flex items-center gap-1">
                    <button className="p-1 hover:bg-muted rounded transition-colors" type="button">
                        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    </button>

                    <span className="text-xs text-muted-foreground px-2">{monthLabel}</span>

                    <button className="p-1 hover:bg-muted rounded transition-colors" type="button">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-3">
                {days.map((day) => (
                    <div key={day} className="text-center text-xs text-muted-foreground py-1">
                        {day}
                    </div>
                ))}

                {dates.map((isoDate, index) => {
                    const hasEvent = events.some((e) => e.date === isoDate);
                    const isToday = isoDate === today;

                    return (
                        <motion.div
                            key={isoDate}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.03 }}
                            className={`
                text-center py-2 text-sm rounded-lg cursor-pointer transition-colors relative
                ${isToday
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "hover:bg-muted text-foreground"
                                }
            `}
                        >
                            {getDayNumber(isoDate)}

                            {hasEvent && !isToday && (
                                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-terracotta" />
                            )}
                        </motion.div>
                    );
                })}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-2">Upcoming</p>

                {events.slice(0, 3).map((event, index) => (
                    <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                        <div className="w-8 h-8 rounded-lg bg-terracotta-light flex items-center justify-center">
                            <span className="text-xs font-medium text-terracotta">
                                {getDayNumber(event.date)}
                            </span>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">
                                {event.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{event.person}</div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default CalendarWidget;
