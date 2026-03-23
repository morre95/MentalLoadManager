import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatWeekdayDate } from "@/components/dashboard/home-grid/helpers";
import { EmptyState, WidgetShell } from "@/components/dashboard/home-grid/WidgetCard";
import { addDaysToIso, formatWeekdayOnly, toLocalIsoDate } from "@/components/dashboard/home-grid/widgets/widgetDateUtils";

export function MiniCalendarWidget({ state, tasks = [], tasksLoading = false, tasksError = null }) {
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [weekAnchorDate, setWeekAnchorDate] = useState(todayIso);

  const weekDates = useMemo(() => {
    const anchorDate = new Date(`${weekAnchorDate}T00:00:00`);
    const mondayOffset = (anchorDate.getDay() + 6) % 7;
    const weekStart = new Date(anchorDate);
    weekStart.setDate(anchorDate.getDate() - mondayOffset);
    const weekStartIso = toLocalIsoDate(weekStart);

    return Array.from({ length: 7 }, (_, index) => addDaysToIso(weekStartIso, index));
  }, [weekAnchorDate]);

  const dueTasksByDate = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const dueDate = String(task?.dueDateValue || "");
      if (!dueDate) return acc;
      if (["done", "archive", "on-hold"].includes(String(task?.status || ""))) return acc;

      acc[dueDate] = [...(acc[dueDate] || []), task];
      return acc;
    }, {});
  }, [tasks]);

  const selectedDateTasks = dueTasksByDate[selectedDate] || [];
  const isLoading = state.loading || tasksLoading;
  const hasError = state.error || tasksError;
  const selectedDateLabel = formatWeekdayDate(selectedDate);
  const monthLabel = useMemo(() => {
    const activeDate = new Date(`${weekDates[3] || selectedDate}T00:00:00`);
    return activeDate.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }, [selectedDate, weekDates]);

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setWeekAnchorDate(date);
  };

  return (
    <WidgetShell
      title="Mini Calendar"
      description="Select a day to see tasks due this week."
      accent="h-9 w-9 rounded-2xl bg-sky-light"
    >
      {isLoading ? (
        <EmptyState message="Loading calendar..." />
      ) : hasError ? (
        <EmptyState message="Could not load calendar." />
      ) : (
        <div className="flex h-full flex-col gap-3">
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              className="rounded p-1 transition-colors hover:bg-muted"
              onClick={() => setWeekAnchorDate((current) => addDaysToIso(current, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="px-2 text-xs text-muted-foreground">{monthLabel}</span>
            <button
              type="button"
              className="rounded p-1 transition-colors hover:bg-muted"
              onClick={() => setWeekAnchorDate((current) => addDaysToIso(current, 7))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date) => (
              <div key={`${date}-label`} className="py-1 text-center text-xs text-muted-foreground">
                {formatWeekdayOnly(date)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date) => {
              const dayTasks = dueTasksByDate[date] || [];
              const isSelected = selectedDate === date;
              const isCurrentDay = todayIso === date;

              return (
                <motion.button
                  key={date}
                  type="button"
                  onClick={() => handleSelectDate(date)}
                  whileTap={{ scale: 0.98 }}
                  className={`relative rounded-lg py-2 text-center text-sm transition-colors ${
                    isSelected
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className={isCurrentDay && !isSelected ? "font-medium text-primary" : undefined}>
                    {new Date(`${date}T00:00:00`).getDate()}
                  </span>
                  {dayTasks.length > 0 ? (
                    <div className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                      isSelected ? "bg-primary-foreground" : "bg-terracotta"
                    }`} />
                  ) : null}
                </motion.button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-background/80 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{selectedDateLabel || "Selected day"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedDateTasks.length > 0
                    ? `${selectedDateTasks.length} task${selectedDateTasks.length === 1 ? "" : "s"} due`
                    : "Nothing due on this day"}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                This week
              </Badge>
            </div>

            <div className="space-y-2 overflow-y-auto">
              {selectedDateTasks.map((task, index) => {
                const priority = String(task.priority || "").toLowerCase();
                const priorityClass =
                  priority === "high"
                    ? "bg-terracotta-light text-terracotta border-terracotta/30"
                    : priority === "low"
                      ? "bg-sage-light text-sage border-sage/30"
                      : "bg-sky-light text-sky border-sky/30";

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-xl border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">{task.title}</p>
                      {task.priority ? (
                        <Badge variant="outline" className={`shrink-0 ${priorityClass}`}>
                          {String(task.priority)}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {task.category ? (
                        <span className="rounded-full bg-background px-2 py-0.5">
                          {task.category}
                        </span>
                      ) : null}
                      {task.assigneeLabel ? <span>{task.assigneeLabel}</span> : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {selectedDateTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                No tasks due on this day.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
