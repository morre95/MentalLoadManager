import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, Palette } from "lucide-react";

import MoodArtwork from "@/components/mood/MoodArtwork";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, fetchMoodTrackerPeriod, upsertMoodTrackerEntry } from "@/lib/utils";

const MOOD_OPTIONS = [
  { token: "accent", label: "Joyful", swatchClass: "bg-accent" },
  { token: "sky", label: "Calm", swatchClass: "bg-sky" },
  { token: "sage", label: "Balanced", swatchClass: "bg-sage" },
  { token: "lavender", label: "Dreamy", swatchClass: "bg-lavender" },
  { token: "terracotta", label: "Warm", swatchClass: "bg-[#c08497]" },
  { token: "status-todo", label: "Energized", swatchClass: "bg-status-todo" },
  { token: "primary", label: "Focused", swatchClass: "bg-[#2c3e50]" },
  { token: "status-done", label: "Proud", swatchClass: "bg-[#3cb371]" },
];

const MOOD_ARTWORK_COLOR_OVERRIDES = {
  accent: "hsl(var(--accent))",
  sky: "hsl(var(--sky))",
  sage: "hsl(var(--sage))",
  lavender: "hsl(var(--lavender))",
  terracotta: "#c08497",
  "status-todo": "hsl(var(--status-todo))",
  primary: "#2c3e50",
  "status-done": "#3cb371",
};

const PERIOD_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const parseIsoDate = (isoDate) => {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatReadableDate = (isoDate) =>
  parseIsoDate(isoDate).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const shiftAnchorDate = (anchorDate, periodType, delta) => {
  const nextDate = parseIsoDate(anchorDate);
  if (periodType === "weekly") {
    nextDate.setDate(nextDate.getDate() + delta * 7);
    return formatIsoDate(nextDate);
  }

  nextDate.setMonth(nextDate.getMonth() + delta, 1);
  return formatIsoDate(nextDate);
};

const pickDefaultDate = (dates) => {
  const today = formatIsoDate(new Date());
  const todayItem = dates.find((dateItem) => dateItem.date === today && !dateItem.is_future);
  if (todayItem) return todayItem.date;

  const firstUnpainted = dates.find((dateItem) => !dateItem.is_future && !dateItem.is_painted);
  if (firstUnpainted) return firstUnpainted.date;

  const firstAvailable = dates.find((dateItem) => !dateItem.is_future);
  return firstAvailable?.date || null;
};

export default function MoodTracker() {
  const [periodType, setPeriodType] = useState("weekly");
  const [anchorDate, setAnchorDate] = useState(formatIsoDate(new Date()));
  const [trackerData, setTrackerData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedMoodToken, setSelectedMoodToken] = useState(MOOD_OPTIONS[0].token);
  const [hoveredRegionId, setHoveredRegionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadTracker = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetchMoodTrackerPeriod(periodType, anchorDate);
        if (!isMounted) return;
        setTrackerData(response);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error?.detail || "Could not load the mood tracker right now.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTracker();
    return () => {
      isMounted = false;
    };
  }, [anchorDate, periodType]);

  useEffect(() => {
    if (!trackerData) {
      return undefined;
    }
    if (!["pending", "in_progress"].includes(String(trackerData.artwork_status || ""))) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetchMoodTrackerPeriod(periodType, anchorDate);
        setTrackerData(response);
      } catch {
        // Keep polling silent; the main load path already handles user-facing errors.
      }
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [anchorDate, periodType, trackerData]);

  useEffect(() => {
    if (!trackerData?.dates?.length) {
      setSelectedDate(null);
      return;
    }

    const selectedStillValid = trackerData.dates.some((dateItem) => dateItem.date === selectedDate);
    if (selectedStillValid) {
      return;
    }

    setSelectedDate(pickDefaultDate(trackerData.dates));
  }, [selectedDate, trackerData]);

  const paintedByRegion = useMemo(
    () =>
      Object.fromEntries(
        (trackerData?.painted_days || []).map((entry) => [entry.region_id, entry])
      ),
    [trackerData]
  );

  const selectedDateInfo = useMemo(
    () => trackerData?.dates?.find((dateItem) => dateItem.date === selectedDate) || null,
    [selectedDate, trackerData]
  );

  const hoveredEntry = hoveredRegionId ? paintedByRegion[hoveredRegionId] || null : null;

  const selectedMood = useMemo(
    () => MOOD_OPTIONS.find((option) => option.token === selectedMoodToken) || MOOD_OPTIONS[0],
    [selectedMoodToken]
  );

  const handlePaintRegion = async (regionId) => {
    if (!selectedDate || selectedDateInfo?.is_future) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await upsertMoodTrackerEntry({
        period_type: periodType,
        entry_date: selectedDate,
        color_token: selectedMood.token,
        mood_label: selectedMood.label,
        region_id: regionId,
      });
      setTrackerData(response);
    } catch (error) {
      setErrorMessage(error?.detail || "Could not save that mood entry.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-sage">Mood Tracker</p>
          <h1 className="font-display text-3xl text-foreground">Paint your days</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pick a day, choose a color, and fill in the artwork as the week or month unfolds.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 p-1">
          {PERIOD_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={periodType === option.value ? "default" : "ghost"}
              className={cn(
                "rounded-full",
                periodType === option.value && "bg-card text-foreground shadow-none hover:bg-card"
              )}
              onClick={() => setPeriodType(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden border-border">
          <CardHeader className="border-b border-border bg-card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="font-display text-2xl">
                  {trackerData?.period_label || "Loading period"}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {periodType === "weekly"
                    ? "Choose a day and paint one open part of this week's artwork."
                    : "Choose a day and paint one open part of this month's artwork."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAnchorDate((current) => shiftAnchorDate(current, periodType, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAnchorDate(formatIsoDate(new Date()))}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAnchorDate((current) => shiftAnchorDate(current, periodType, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 md:p-6">
            {isLoading ? (
              <div className="flex h-[520px] items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 text-muted-foreground">
                Loading artwork...
              </div>
            ) : trackerData?.artwork_status === "failed" ? (
              <div className="flex h-[520px] items-center justify-center rounded-3xl border border-dashed border-destructive/30 bg-destructive/5 px-6 text-center text-sm text-destructive">
                {trackerData?.artwork_error || "Artwork generation failed. Retrying soon."}
              </div>
            ) : trackerData?.artwork_status !== "completed" || !trackerData?.svg_markup ? (
              <div className="flex h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 px-6 text-center">
                <p className="text-base font-medium text-foreground">Generating artwork...</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Your mood illustration is being prepared in the background. This view refreshes automatically when it is ready.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[2rem] border border-border bg-gradient-to-b from-card via-card to-sand-light/50 p-4 shadow-sm">
                  <div className="mx-auto h-[520px] max-w-5xl">
                    <MoodArtwork
                      periodType={periodType}
                      imageId={trackerData?.image_id}
                      svgMarkup={trackerData?.svg_markup}
                      regionIds={trackerData?.region_ids || []}
                      paintedByRegion={paintedByRegion}
                      selectedDate={selectedDate}
                      colorValueByToken={MOOD_ARTWORK_COLOR_OVERRIDES}
                      onRegionClick={handlePaintRegion}
                      onRegionHover={setHoveredRegionId}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {(trackerData?.dates || []).map((dateItem) => {
                    const isSelected = dateItem.date === selectedDate;

                    return (
                      <button
                        key={dateItem.date}
                        type="button"
                        onClick={() => !dateItem.is_future && setSelectedDate(dateItem.date)}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left transition-all",
                          dateItem.is_future
                            ? "cursor-not-allowed border-border/50 bg-muted/30 text-muted-foreground/60"
                            : "border-border bg-card hover:border-sage hover:shadow-sm",
                          isSelected && "border-sage bg-sage-light/60 shadow-sm"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{formatReadableDate(dateItem.date)}</span>
                          <span
                            className={cn(
                              "h-3 w-3 rounded-full border border-card",
                              dateItem.color_token
                                ? MOOD_OPTIONS.find((option) => option.token === dateItem.color_token)?.swatchClass
                                : "bg-muted"
                            )}
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {dateItem.is_future
                            ? "Future day"
                            : dateItem.is_painted
                              ? dateItem.mood_label || "Painted"
                              : "Not painted yet"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-sage" />
                Mood Palette
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {MOOD_OPTIONS.map((option) => {
                  const isActive = option.token === selectedMoodToken;
                  return (
                    <button
                      key={option.token}
                      type="button"
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-left transition-all",
                        isActive
                          ? "border-foreground bg-card shadow-sm"
                          : "border-border bg-card hover:border-sage/60"
                      )}
                      onClick={() => setSelectedMoodToken(option.token)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn("h-5 w-5 rounded-full", option.swatchClass)} />
                        <span className="text-sm font-medium">{option.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm font-medium text-foreground">Selected day</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedDate ? formatReadableDate(selectedDate) : "No day selected"}
                </p>
                <p className="mt-3 text-sm font-medium text-foreground">Selected mood</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className={cn("h-4 w-4 rounded-full", selectedMood.swatchClass)} />
                  <span className="text-sm text-muted-foreground">{selectedMood.label}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Click any open part of the artwork to save the color for the selected day.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-terracotta" />
                Artwork Detail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hoveredEntry ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <p className="text-sm font-medium text-foreground">{formatReadableDate(hoveredEntry.date)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{hoveredEntry.mood_label || "Painted mood"}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full",
                        MOOD_OPTIONS.find((option) => option.token === hoveredEntry.color_token)?.swatchClass || "bg-primary"
                      )}
                    />
                    <span className="text-xs text-muted-foreground">{hoveredEntry.region_id}</span>
                  </div>
                </motion.div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Hover over a painted part to see its day.
                </div>
              )}

              {errorMessage && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}

              {isSaving && (
                <div className="rounded-2xl border border-sage/30 bg-sage-light/40 p-4 text-sm text-sage-dark">
                  Saving your mood...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
