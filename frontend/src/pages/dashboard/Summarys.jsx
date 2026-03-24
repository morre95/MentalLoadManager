import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, CalendarDays, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NoHouseholdState } from "@/components/ui/noHouseHoldState";
import { useHousehold } from "@/hooks/useHouseHold";
import { storeWeeklySummaryNotification } from "@/lib/summaryNotifications";
import { apiFetch } from "@/lib/utils";

const DEFAULT_SUMMARY_MODEL = "openrouter/free";
const SUMMARY_MODELS = [
  { name: "Gemini 2.5", value: "google/gemini-2.5-flash-lite" },
  { name: "ChatGPT 5", value: "openai/gpt-5-nano" },
  { name: "Llama 3.2", value: "meta-llama/llama-3.2-3b-instruct" },
  { name: "MiniMax 2.5", value: "minimax/minimax-m2.5" },
  { name: "Deep Seek 3.2", value: "deepseek/deepseek-v3.2" },
  { name: "Claude Sonnet 4.6", value: "anthropic/claude-sonnet-4.6" },
  { name: "Grok 4", value: "x-ai/grok-4-fast" },
  { name: "GPT-OSS 120b", value: "openai/gpt-oss-120b" },
];

function mapModelName(model) {
  const normalizedModel = String(model || "").trim();
  if (!normalizedModel) {
    return null;
  }

  if (normalizedModel === DEFAULT_SUMMARY_MODEL) {
    return "Free";
  }

  const result = SUMMARY_MODELS.find((entry) => entry.value === normalizedModel);
  if (result) {
    return result.name;
  }

  return normalizedModel;
}

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

function mapReportToSummary(report) {
  return {
    ai_summary_id: report.ai_summary_id,
    household_id: report.household_id,
    week_start: report.week_start,
    week_end: report.week_end,
    status: report.status,
    model: report.model,
    content: report.content,
    error: report.error,
  };
}

export default function Summarys() {
  const [searchParams] = useSearchParams();
  const { households, loading, error, refetch } = useHousehold();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_SUMMARY_MODEL);
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart);
  const [summary, setSummary] = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeReportAction, setActiveReportAction] = useState(null);
  const [requestError, setRequestError] = useState(null);
  const pendingNotificationSummaryIdsRef = useRef(new Set());
  const routeSummaryId = searchParams.get("summaryId") || "";
  const routeHouseholdId = searchParams.get("householdId") || "";

  const householdOptions = useMemo(
    () =>
      (households || []).map((household) => ({
        id: String(household.household_id || household.id),
        name: household.name || "Unnamed household",
      })),
    [households]
  );

  const householdNameById = useMemo(
    () => new Map(householdOptions.map((household) => [household.id, household.name])),
    [householdOptions]
  );

  const resolveHouseholdName = useCallback((householdId, fallbackName = "") => {
    if (fallbackName) return fallbackName;
    if (!householdId) return "Unnamed household";
    return householdNameById.get(String(householdId)) || "Unnamed household";
  }, [householdNameById]);

  const summaryHouseholdName = useMemo(() => {
    if (!summary?.household_id) return "";
    return resolveHouseholdName(summary.household_id, summary.household_name);
  }, [resolveHouseholdName, summary?.household_id, summary?.household_name]);

  useEffect(() => {
    if (householdOptions.length === 0) {
      setSelectedHouseholdId("");
      return;
    }

    if (routeHouseholdId) {
      const requestedHousehold = householdOptions.find(
        (household) => household.id === routeHouseholdId
      );
      if (requestedHousehold && requestedHousehold.id !== selectedHouseholdId) {
        setSelectedHouseholdId(requestedHousehold.id);
        return;
      }
    }

    const exists = householdOptions.some((household) => household.id === selectedHouseholdId);
    if (!exists) {
      setSelectedHouseholdId(householdOptions[0].id);
    }
  }, [householdOptions, routeHouseholdId, selectedHouseholdId]);

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
          model: selectedModel || DEFAULT_SUMMARY_MODEL,
        }),
      });

      if (data?.ai_summary_id && data?.status === "pending") {
        pendingNotificationSummaryIdsRef.current.add(String(data.ai_summary_id));
      }
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
    if (!routeSummaryId) {
      return undefined;
    }

    let active = true;

    const loadRequestedSummary = async () => {
      try {
        const requestedSummary = await apiFetch(
          `/api/v1/ai/weekly-summary/${encodeURIComponent(routeSummaryId)}`,
          { method: "GET" }
        );

        if (!active) {
          return;
        }

        if (requestedSummary?.household_id) {
          setSelectedHouseholdId(String(requestedSummary.household_id));
        }
        setSummary(requestedSummary);
      } catch (err) {
        if (active) {
          setRequestError(err?.message || "Failed to load requested weekly summary.");
        }
      }
    };

    void loadRequestedSummary();

    return () => {
      active = false;
    };
  }, [routeSummaryId]);

  useEffect(() => {
    if (!summary?.ai_summary_id || summary.status !== "completed") {
      return;
    }

    const summaryId = String(summary.ai_summary_id);
    if (!pendingNotificationSummaryIdsRef.current.has(summaryId)) {
      return;
    }

    pendingNotificationSummaryIdsRef.current.delete(summaryId);
    storeWeeklySummaryNotification({
      ai_summary_id: summaryId,
      household_id: String(summary.household_id || ""),
      household_name: resolveHouseholdName(
        summary.household_id,
        summary.household_name,
      ),
      week_start: summary.week_start,
      week_end: summary.week_end,
      model: summary.model,
      title: "Weekly summary ready",
      message: `Your weekly summary for ${resolveHouseholdName(
        summary.household_id,
        summary.household_name,
      )} is ready to review.`,
      createdAt: new Date().toISOString(),
    });
  }, [
    resolveHouseholdName,
    summary?.ai_summary_id,
    summary?.household_id,
    summary?.household_name,
    summary?.model,
    summary?.status,
    summary?.week_end,
    summary?.week_start,
  ]);

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
          const reports = Array.isArray(data?.summaries) ? data.summaries : [];
          setSavedReports(reports);
          setSummary((previousSummary) => {
            if (
              previousSummary &&
              String(previousSummary.household_id || "") === selectedHouseholdId
            ) {
              return previousSummary;
            }

            return reports.length > 0 ? mapReportToSummary(reports[0]) : null;
          });
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
    setSummary(mapReportToSummary(report));
  };

  const handleDeleteReport = async (report) => {
    if (!report?.ai_summary_id || activeReportAction) return;

    setActiveReportAction({ type: "delete", reportId: report.ai_summary_id });
    setRequestError(null);

    try {
      await apiFetch(`/api/v1/ai/summaries/${report.ai_summary_id}`, {
        method: "DELETE",
      });

      const nextReports = savedReports.filter(
        (savedReport) => savedReport.ai_summary_id !== report.ai_summary_id
      );
      setSavedReports(nextReports);
      setSummary((previousSummary) => {
        if (previousSummary?.ai_summary_id !== report.ai_summary_id) {
          return previousSummary;
        }
        return nextReports.length > 0 ? mapReportToSummary(nextReports[0]) : null;
      });
    } catch (err) {
      setRequestError(err?.message || "Failed to delete saved summary.");
    } finally {
      setActiveReportAction(null);
    }
  };

  const handleRegenerateReport = async (report) => {
    if (!report?.ai_summary_id || activeReportAction) return;

    setActiveReportAction({ type: "regenerate", reportId: report.ai_summary_id });
    setRequestError(null);

    try {
      const nextSummary = await apiFetch(`/api/v1/ai/summaries/${report.ai_summary_id}/regenerate`, {
        method: "POST",
      });
      if (nextSummary?.ai_summary_id && nextSummary?.status === "pending") {
        pendingNotificationSummaryIdsRef.current.add(String(nextSummary.ai_summary_id));
      }
      setSummary(nextSummary);
    } catch (err) {
      setRequestError(err?.message || "Failed to regenerate weekly summary.");
    } finally {
      setActiveReportAction(null);
    }
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
          <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto]" onSubmit={handleGenerate}>
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
              <Label htmlFor="summary-model">Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="summary-model">
                  <SelectValue placeholder={DEFAULT_SUMMARY_MODEL} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_SUMMARY_MODEL}>
                    Free
                  </SelectItem>
                  {SUMMARY_MODELS.map((model) => (
                    <SelectItem key={model.name} value={model.value}>
                      {model.name}
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
            <div
              key={report.ai_summary_id}
              className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 transition hover:bg-muted/30"
            >
              <button
                type="button"
                onClick={() => handleOpenSavedReport(report)}
                className="flex min-w-0 flex-1 items-start justify-between text-left"
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    Weekly summary
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {resolveHouseholdName(report.household_id, report.household_name)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatWeekLabel(report.week_start)}
                    {report.week_start !== report.week_end ? ` to ${formatWeekLabel(report.week_end)}` : ""}
                  </div>
                </div>
                <div className="ml-4 text-right text-xs text-muted-foreground">
                  <div>{report.status}</div>
                  {report.model ? <div>{mapModelName(report.model)}</div> : null}
                </div>
              </button>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => void handleRegenerateReport(report)}
                  disabled={Boolean(activeReportAction)}
                  aria-label="Regenerate summary"
                >
                  {activeReportAction?.type === "regenerate" && activeReportAction?.reportId === report.ai_summary_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => void handleDeleteReport(report)}
                  disabled={Boolean(activeReportAction)}
                  aria-label="Delete summary"
                >
                  {activeReportAction?.type === "delete" && activeReportAction?.reportId === report.ai_summary_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
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
                {summary.model ? <span>Model: {mapModelName(summary.model)}</span> : null}
                <span>Household: {summaryHouseholdName}</span>
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
