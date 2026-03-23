import { useState } from "react";
import { Repeat, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildSummary(frequency, interval, weekdays) {
  if (!frequency) return "";

  if (frequency === "daily") {
    return interval === 1 ? "Repeats every day" : `Repeats every ${interval} days`;
  }

  if (frequency === "weekly") {
    const dayLabels = weekdays
      .slice()
      .sort((a, b) => {
        const order = [1, 2, 3, 4, 5, 6, 0];
        return order.indexOf(a) - order.indexOf(b);
      })
      .map((d) => WEEKDAYS.find((w) => w.value === d)?.label ?? "");

    const onDays = dayLabels.length > 0 ? ` on ${dayLabels.join(", ")}` : "";
    return interval === 1
      ? `Repeats every week${onDays}`
      : `Repeats every ${interval} weeks${onDays}`;
  }

  if (frequency === "monthly") {
    return interval === 1 ? "Repeats every month" : `Repeats every ${interval} months`;
  }

  return "";
}

/**
 * Calculates the nearest date on or after `fromDateStr` (YYYY-MM-DD)
 * that falls on `targetDayIndex` (0=Sun … 6=Sat).
 * Returns a YYYY-MM-DD string.
 */
function nearestWeekday(fromDateStr, targetDayIndex) {
  const d = new Date(`${fromDateStr}T00:00:00`);
  const diff = (targetDayIndex - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getInitialWeekdays(frequency, weekdays, dueDate) {
  if (frequency === "weekly" && weekdays.length === 0 && dueDate) {
    return [new Date(`${dueDate}T00:00:00`).getDay()];
  }

  return weekdays;
}

/**
 * RecurrenceOptionsDialog
 *
 * Props:
 *   open            boolean
 *   onOpenChange    (open: boolean) => void
 *   frequency       "daily" | "weekly" | "monthly"
 *   interval        number  (current interval, default 1)
 *   weekdays        number[] (current selected days, 0=Sun…6=Sat)
 *   dueDate         string  (YYYY-MM-DD, used for monthly hint and weekly day init)
 *   onApply         ({ interval, weekdays, suggestedDueDate }) => void
 */
const RecurrenceOptionsDialog = ({
  open,
  onOpenChange,
  frequency,
  interval = 1,
  weekdays = [],
  dueDate = "",
  onApply,
}) => {
  const [localInterval, setLocalInterval] = useState(() => interval);
  const [localWeekdays, setLocalWeekdays] = useState(() =>
    getInitialWeekdays(frequency, weekdays, dueDate)
  );

  const frequencyLabel =
    frequency === "daily" ? "Daily" : frequency === "weekly" ? "Weekly" : "Monthly";

  const unitLabel =
    frequency === "daily" ? "day" : frequency === "weekly" ? "week" : "month";
  const unitLabelPlural = localInterval === 1 ? unitLabel : `${unitLabel}s`;

  const dueDateDayOfMonth = dueDate ? new Date(`${dueDate}T00:00:00`).getDate() : null;

  const summary = buildSummary(frequency, localInterval, localWeekdays);

  const toggleWeekday = (day) => {
    setLocalWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleApply = () => {
    const finalWeekdays = frequency === "weekly" ? localWeekdays : [];

    // If weekly and exactly one day is selected and a dueDate exists,
    // suggest shifting the due date to the nearest occurrence of that day.
    let suggestedDueDate = undefined;
    if (frequency === "weekly" && finalWeekdays.length === 1 && dueDate) {
      suggestedDueDate = nearestWeekday(dueDate, finalWeekdays[0]);
    }

    onApply({ interval: localInterval, weekdays: finalWeekdays, suggestedDueDate });
    onOpenChange(false);
  };

  const handleIntervalChange = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v)) setLocalInterval(Math.max(1, Math.min(365, v)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Repeat className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{frequencyLabel} Recurrence</DialogTitle>
              <DialogDescription>Configure how this task repeats</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Interval */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Repeat every</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={localInterval}
                onChange={handleIntervalChange}
                className="h-9 w-20 rounded-md border border-input bg-background px-3 text-center text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-sm text-muted-foreground">{unitLabelPlural}</span>
            </div>
          </div>

          {/* Weekly: day-of-week picker */}
          {frequency === "weekly" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Repeat on</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={cn(
                      "h-9 w-[2.75rem] rounded-lg border text-sm font-medium transition-colors",
                      localWeekdays.includes(day.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {localWeekdays.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No day selected — task will repeat from its due date.
                </p>
              )}
              {localWeekdays.length === 1 && dueDate && (
                <p className="text-xs text-muted-foreground">
                  Due date will be adjusted to the nearest{" "}
                  {WEEKDAYS.find((w) => w.value === localWeekdays[0])?.label}.
                </p>
              )}
            </div>
          )}

          {/* Monthly: hint */}
          {frequency === "monthly" && dueDateDayOfMonth && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm text-foreground">
                  Repeats on day{" "}
                  <span className="font-semibold">{ordinal(dueDateDayOfMonth)}</span> of each month
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Change the task&apos;s due date to adjust the repeat day.
                </p>
              </div>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm font-medium text-primary">{summary}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecurrenceOptionsDialog;
