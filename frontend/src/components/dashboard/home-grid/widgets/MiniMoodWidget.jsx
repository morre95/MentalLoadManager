import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import MoodArtwork from "@/components/mood/MoodArtwork";
import { EmptyState, WidgetShell } from "@/components/dashboard/home-grid/WidgetCard";
import { formatWeekdayOnly } from "@/components/dashboard/home-grid/widgets/widgetDateUtils";

const EMPTY_ARRAY = [];
const MOOD_TOKEN_COLOR_CLASS = {
  accent: "bg-accent",
  sky: "bg-sky",
  sage: "bg-sage",
  lavender: "bg-lavender",
  terracotta: "bg-terracotta",
  primary: "bg-primary",
  sand: "bg-sand",
  "status-todo": "bg-status-todo",
  "status-doing": "bg-status-doing",
  "status-done": "bg-status-done",
};

export function MiniMoodWidget({ state }) {
  const dates = Array.isArray(state?.tracker?.dates) ? state.tracker.dates : EMPTY_ARRAY;
  const [selectedDate, setSelectedDate] = useState(() => dates.find((item) => item?.date)?.date || "");

  const effectiveSelectedDate = useMemo(() => {
    if (dates.some((item) => item?.date === selectedDate)) return selectedDate;
    return dates.find((item) => item?.date)?.date || "";
  }, [dates, selectedDate]);

  const paintedDays = Array.isArray(state?.tracker?.painted_days) ? state.tracker.painted_days : EMPTY_ARRAY;
  const paintedByRegion = Object.fromEntries(paintedDays.map((entry) => [entry.region_id, entry]));

  return (
    <WidgetShell
      title="Mood Miniature"
      description="A compact mood board for the current week."
      accent="h-9 w-9 rounded-2xl bg-sage-light"
    >
      {state.loading ? (
        <EmptyState message="Loading mood board..." />
      ) : state.error ? (
        <EmptyState message="Could not load mood tracker." />
      ) : (
        <div className="flex h-full flex-col gap-3">
          <div className="grid grid-cols-7 gap-1">
            {dates.slice(0, 7).map((item) => (
              <div key={`${item.date}-label`} className="py-1 text-center text-xs text-muted-foreground">
                {formatWeekdayOnly(item.date)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dates.slice(0, 7).map((item) => {
              const isSelected = item.date === effectiveSelectedDate;
              const moodDotClass = item.is_future
                ? "bg-muted"
                : item.color_token
                  ? MOOD_TOKEN_COLOR_CLASS[item.color_token] || "bg-primary"
                  : item.is_painted
                    ? "bg-primary"
                    : "bg-border";

              return (
                <motion.button
                  key={item.date}
                  type="button"
                  onClick={() => setSelectedDate(item.date)}
                  whileTap={{ scale: 0.98 }}
                  className={`relative rounded-lg py-2 text-center text-sm transition-colors ${
                    isSelected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{new Date(`${item.date}T00:00:00`).getDate()}</span>
                  <div className="mt-2 flex justify-center">
                    <span className={`h-4 w-4 rounded-full border border-card ${moodDotClass}`} />
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-background/80 p-3">
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="aspect-[1.15/1] overflow-hidden rounded-xl bg-background/80 p-2">
                <MoodArtwork
                  periodType={state?.tracker?.period_type || "weekly"}
                  imageId={state?.tracker?.image_id}
                  regionIds={state?.tracker?.region_ids || []}
                  paintedByRegion={paintedByRegion}
                  selectedDate={effectiveSelectedDate || null}
                  onRegionClick={() => {}}
                  onRegionHover={() => {}}
                  svgMarkup={state?.tracker?.svg_markup}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
