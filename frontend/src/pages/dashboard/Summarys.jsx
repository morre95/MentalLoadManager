import { useEffect, useMemo, useState } from "react";
import { Bot, CalendarDays, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NoHouseholdState } from "@/components/ui/noHouseHoldState";
import { useHousehold } from "@/hooks/useHouseHold";
import { apiFetch } from "@/lib/utils";

function getCurrentWeekStart() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function formatWeekLabel(value) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Summarys() {
  const { households, loading, error, refetch } = useHousehold();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart);
  const [summary, setSummary] = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [requestError, setRequestError] = useState(null);

  const householdOptions = useMemo(
    () =>
      (households || []).map((household) => ({
        id: String(household.household_id || household.id),
        name: household.name || "Unnamed household",
      })),
    [households]
  );

  useEffect(() => {
    if (householdOptions.length === 0) {
      setSelectedHouseholdId("");
      return;
    }

    const exists = householdOptions.some((household) => household.id === selectedHouseholdId);
    if (!exists) {
      setSelectedHouseholdId(householdOptions[0].id);
    }
  }, [householdOptions, selectedHouseholdId]);

  const handleGenerate = async (event) => {
    event.preventDefault();

    if (!selectedHouseholdId || isGenerating) return;

    setIsGenerating(true);
    setRequestError(null);

    try {
      const data = await apiFetch("/api/v1/ai/weekly-summary", {
        method: "POST",
        body: JSON.stringify({
          household_id: selectedHouseholdId,
          week_start: weekStart || null,
        }),
      });

      setSummary(data);
    } catch (err) {
      setRequestError(err?.message || "Failed to generate weekly summary.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!summary?.ai_summary_id || summary.status !== "pending") {
      return undefined;
    }

    let active = true;

    const poll = async () => {
      try {
        const nextSummary = await apiFetch(
          `/api/v1/ai/weekly-summary/${summary.ai_summary_id}`,
          { method: "GET" }
        );
        if (active) {
          setSummary(nextSummary);
        }
      } catch (err) {
        if (active) {
          setRequestError(err?.message || "Failed to refresh weekly summary status.");
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, 3000);

    void poll();

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [summary?.ai_summary_id, summary?.status]);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setSavedReports([]);
      return;
    }

    let active = true;

    const loadReports = async () => {
      setIsLoadingReports(true);
      try {
        const data = await apiFetch(`/api/v1/ai/summaries?household_id=${encodeURIComponent(selectedHouseholdId)}`, {
          method: "GET",
        });
        if (active) {
          setSavedReports(Array.isArray(data?.summaries) ? data.summaries : []);
        }
      } catch (err) {
        if (active) {
          setRequestError(err?.message || "Failed to load saved summaries.");
        }
      } finally {
        if (active) {
          setIsLoadingReports(false);
        }
      }
    };

    void loadReports();

    return () => {
      active = false;
    };
  }, [selectedHouseholdId, summary?.ai_summary_id, summary?.status]);

  const handleOpenSavedReport = (report) => {
    setSummary({
      ai_summary_id: report.ai_summary_id,
      household_id: report.household_id,
      week_start: report.week_start,
      week_end: report.week_end,
      status: report.status,
      model: report.model,
      content: report.content,
      error: report.error,
    });
  };

  if (loading && householdOptions.length === 0) {
    return <div className="p-6 text-muted-foreground">Loading summaries…</div>;
  }

  if (householdOptions.length === 0) {
    return <NoHouseholdState onRetry={refetch} />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 font-display text-2xl font-bold text-foreground md:text-3xl">
            <Sparkles className="h-7 w-7 text-primary" />
            Summarys
          </h1>
          <p className="mt-1 text-muted-foreground">
            Generate a neutral weekly AI summary for one household at a time.
          </p>
          {error && (
            <p className="mt-2 text-sm text-destructive">
              {error?.message || "Failed to load households"}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Summary</CardTitle>
          <CardDescription>
            Pick a household and week start date, then generate a summary from task activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px_auto]" onSubmit={handleGenerate}>
            <div className="space-y-2">
              <Label htmlFor="summary-household">Household</Label>
              <Select value={selectedHouseholdId} onValueChange={setSelectedHouseholdId}>
                <SelectTrigger id="summary-household">
                  <SelectValue placeholder="Select household" />
                </SelectTrigger>
                <SelectContent>
                  {householdOptions.map((household) => (
                    <SelectItem key={household.id} value={household.id}>
                      {household.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary-week-start">Week Start</Label>
              <Input
                id="summary-week-start"
                type="date"
                value={weekStart}
                onChange={(event) => setWeekStart(event.target.value)}
                disabled={isGenerating}
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2 lg:w-auto" disabled={isGenerating || !selectedHouseholdId}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </form>

          {requestError && (
            <p className="mt-4 text-sm text-destructive">{requestError}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Reports</CardTitle>
          <CardDescription>
            Review saved AI summaries for the selected household.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingReports ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading saved reports…
            </div>
          ) : null}
          {!isLoadingReports && savedReports.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              No saved AI summaries for this household yet.
            </div>
          ) : null}
          {savedReports.map((report) => (
            <button
              key={report.ai_summary_id}
              type="button"
              onClick={() => handleOpenSavedReport(report)}
              className="flex w-full items-start justify-between rounded-lg border border-border bg-background p-4 text-left transition hover:bg-muted/30"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">
                  Weekly summary
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatWeekLabel(report.week_start)}
                  {report.week_start !== report.week_end ? ` to ${formatWeekLabel(report.week_end)}` : ""}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{report.status}</div>
                {report.model ? <div>{report.model}</div> : null}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Latest Result
          </CardTitle>
          <CardDescription>
            {summary
              ? `Weekly summary from ${formatWeekLabel(summary.week_start)}`
              : "Your generated weekly summary will appear here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary ? (
            <>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Status: {summary.status}</span>
                {summary.model ? <span>Model: {summary.model}</span> : null}
                <span>Household: {summary.household_id}</span>
              </div>
              {summary.status === "pending" ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Weekly summary is being generated in the background.
                </div>
              ) : null}
              {summary.status === "failed" ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {summary.error || "Weekly summary generation failed."}
                </div>
              ) : null}
              {summary.content ? (
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 text-sm leading-7 text-foreground">
                  {summary.content}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
              Generate a summary to review weekly task trends, backlog movement, assignments, and completions.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
