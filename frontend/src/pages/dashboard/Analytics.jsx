import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Users,
    CheckCircle2,
    Plus,
    Eye,
    EyeOff,
    RefreshCcw,
    Maximize2,
    Download,
    Info,
} from "lucide-react";

import { useHousehold } from "@/hooks/useHouseHold";
import { createApiClient, fetchAnalyticsSummary } from "../../../../shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { NoHouseholdState } from "@/components/ui/noHouseHoldState";
import { getDisplayNameFromUsername } from "@/lib/utils";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend,
    AreaChart,
    Area,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    Radar,
} from "recharts";

/* -----------------------------
Helpers
----------------------------- */

function safeNumber(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x : null;
}

function pctChange(current, prev) {
    const c = safeNumber(current);
    const p = safeNumber(prev);
    if (c === null || p === null) return null;
    if (p === 0) return c === 0 ? 0 : null;
    return ((c - p) / p) * 100;
}

function formatPct(p) {
    const abs = Math.abs(p);
    const digits = abs >= 10 ? 0 : 1;
    return `${p > 0 ? "+" : ""}${p.toFixed(digits)}%`;
}

function toCsv(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return "";
    const keys = Array.from(
        rows.reduce((acc, r) => {
            Object.keys(r || {}).forEach((k) => acc.add(k));
            return acc;
        }, new Set())
    );

    const escape = (v) => {
        const s = v === null || v === undefined ? "" : String(v);
        const needs = /[",\n]/.test(s);
        const esc = s.replace(/"/g, '""');
        return needs ? `"${esc}"` : esc;
    };

    const header = keys.map(escape).join(",");
    const body = rows
        .map((r) => keys.map((k) => escape(r && r[k])).join(","))
        .join("\n");

    return `${header}\n${body}`;
}

function downloadTextFile(filename, content, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/* -----------------------------
Reusable UI pieces
----------------------------- */

const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
};

function ChartLegend({ payload, layout = "grid", itemType = "square" }) {
    if (!payload || !payload.length) return null;

    const containerStyle =
        layout === "grid"
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(2, auto)",
                gap: "8px 18px",
                justifyContent: "center",
                paddingTop: 10,
                fontSize: 14,
                lineHeight: "18px",
            }
            : {
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 18px",
                justifyContent: "center",
                paddingTop: 10,
                fontSize: 14,
                lineHeight: "18px",
            };

    return (
        <div style={containerStyle}>
            {payload.map((entry, i) => {
                const color = entry.color || "hsl(var(--muted-foreground))";
                return (
                    <div
                        key={`legend-${i}`}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color,
                            fontWeight: 500,
                        }}
                    >
                        {itemType === "line" ? (
                            <svg width="24" height="10">
                                <line
                                    x1="0"
                                    y1="5"
                                    x2="24"
                                    y2="5"
                                    stroke={color}
                                    strokeWidth="2"
                                    strokeDasharray={entry.payload && entry.payload.strokeDasharray}
                                />
                            </svg>
                        ) : (
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    backgroundColor: color,
                                    display: "inline-block",
                                    borderRadius: 2,
                                }}
                            />
                        )}
                        {entry.value}
                    </div>
                );
            })}
        </div>
    );
}

function ChartEmptyState({
    title = "No data yet for the selected timeframe",
    hint = "Add a task with category + assignee to unlock this chart",
}) {
    return (
        <div className="h-full w-full flex items-center justify-center">
            <div className="text-center px-6">
                <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </div>

                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </div>
        </div>
    );
}

function ChartFrame({ isEmpty, emptyTitle, emptyHint, children, height = 256 }) {
    return (
        <div className="h-72">
            {isEmpty ? (
                <ChartEmptyState title={emptyTitle} hint={emptyHint} />
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    {children}
                </ResponsiveContainer>
            )}
        </div>
    );
}

function formatRelativeTime(date) {
    if (!date) return "";
    const diffMs = Date.now() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 10) return "Updated just now";
    if (diffSeconds < 60) return `Updated ${diffSeconds}s ago`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Updated ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `Updated ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

/* -----------------------------
Component
----------------------------- */

const Analytics = () => {
    // data
    const [weeklyData, setWeeklyData] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [loadTrendData, setLoadTrendData] = useState([]);
    const [completionData, setCompletionData] = useState([]);
    const [radarData, setRadarData] = useState([]);
    const [stats, setStats] = useState([]);
    const [people, setPeople] = useState([]);
    const [labels, setLabels] = useState({});

    // state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const [noHousehold, setNoHousehold] = useState(false);

    // UI state
    const [activeChartIds, setActiveChartIds] = useState([
        "distribution",
        "category",
        "load-trend",
        "completion",
        "radar",
    ]);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [expandedChartId, setExpandedChartId] = useState(null);

    const { households } = useHousehold();

    // refresh tick for relative time label
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    const [timeframe, setTimeframe] = useState("30d");

    const [selectedHouseholdId, setSelectedHouseholdId] = useState(() => {
        try {
            const raw = localStorage.getItem("household");
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const householdId = parsed && (parsed.household_id ?? parsed.id ?? parsed);
            return householdId ? String(householdId) : null;
        } catch {
            return null;
        }
    });

    // colors (stable per person)
    const SERIES_COLORS = useMemo(
        () => [
            "hsl(var(--sage))",
            "hsl(var(--terracotta))",
            "hsl(var(--sky))",
            "hsl(var(--lavender))",
            "hsl(var(--sand))",
            "hsl(var(--primary))",
            "hsl(var(--accent))",
        ],
        []
    );

    const sortedPeople = useMemo(
        () => [...(people || [])].sort((a, b) => a.localeCompare(b)),
        [people]
    );

    const personColorMap = useMemo(() => {
        const acc = {};
        sortedPeople.forEach((person, idx) => {
            acc[person] = SERIES_COLORS[idx % SERIES_COLORS.length];
        });
        return acc;
    }, [sortedPeople, SERIES_COLORS]);

    // chart registry (labels + empty states + descriptions)
    const CHARTS = useMemo(
        () => [
            {
                id: "distribution",
                title: "Task Distribution by Person",
                desc: "Weekly count of tasks per person, grouped by week number.",
                emptyTitle: "No tasks assigned in this timeframe",
                emptyHint: "Assign tasks to people to see distribution over time",
            },
            {
                id: "category",
                title: "Tasks by Category",
                desc: "Share of tasks by category. Large lists are grouped into “Other”.",
                emptyTitle: "No categories used in this timeframe",
                emptyHint: "Add categories to tasks to see where effort goes",
            },
            {
                id: "load-trend",
                title: "Mental Load Trend",
                desc: "Overall load score over time (monthly).",
                emptyTitle: "No load signals in this timeframe",
                emptyHint: "Add tasks with load/weight to see trend",
            },
            {
                id: "completion",
                title: "Daily Completion Rate",
                desc: "Completed vs pending tasks per day in the selected timeframe.",
                emptyTitle: "No completion activity in this timeframe",
                emptyHint: "Mark tasks complete to unlock completion trend",
            },
            {
                id: "radar",
                title: "Category Expertise",
                desc: "Per-person strength by category (higher = more handled/completed).",
                emptyTitle: "Not enough category signal yet",
                emptyHint: "Use categories + assign people to build expertise map",
            },
        ],
        []
    );

    const chartMetaById = useMemo(() => {
        const m = new Map();
        CHARTS.forEach((c) => m.set(c.id, c));
        return m;
    }, [CHARTS]);

    const selectedHouseholdName = useMemo(() => {
        const h = (households || []).find(
            (x) => String(x.household_id) === String(selectedHouseholdId)
        );
        return (h && h.name) || "Household";
    }, [households, selectedHouseholdId]);

    const timeframeOptions = useMemo(
        () => [
            { id: "7d", label: "7 days" },
            { id: "30d", label: "30 days" },
            { id: "12w", label: "12 weeks" },
        ],
        []
    );

    const timeframeLabel = useMemo(() => {
        const opt = timeframeOptions.find((x) => x.id === timeframe);
        return (opt && opt.label) || timeframe;
    }, [timeframe, timeframeOptions]);

    // API client
    const apiClient = useMemo(() => {
        return createApiClient({
            getAccessToken: () => localStorage.getItem("access_token"),
            onUnauthorized: () => { },
        });
    }, []);

    // load analytics
    const load = useCallback(
        async (tf = timeframe) => {
            setLoading(true);
            setError(null);
            setNoHousehold(false);

            try {
                const summary = await fetchAnalyticsSummary(apiClient, selectedHouseholdId, tf);

                setPeople(summary.people || []);
                setWeeklyData(summary.weeklyData || []);
                setCategoryData(summary.categoryData || []);
                setLoadTrendData(summary.loadTrendData || []);
                setCompletionData(summary.completionData || []);
                setRadarData(summary.radarData || []);
                setStats(summary.stats || []);
                setLabels(summary.labels || {});
                setLastUpdatedAt(new Date());
            } catch (err) {
                const msg = (err && err.message) || "";
                if (msg.toLowerCase().includes("not in a household")) {
                    setNoHousehold(true);
                    setError(null);
                    return;
                }
                console.error(err);
                setError(err);
            } finally {
                setLoading(false);
            }
        },
        [apiClient, selectedHouseholdId, timeframe]
    );

    // initial load + reload on timeframe/household change
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!alive) return;
            if (!selectedHouseholdId) return;
            await load(timeframe);
        })();

        return () => {
            alive = false;
        };
    }, [load, timeframe, selectedHouseholdId]);

    // set default household
    useEffect(() => {
        if (!Array.isArray(households) || households.length === 0) return;
        if (!selectedHouseholdId) setSelectedHouseholdId(String(households[0].household_id));
    }, [households, selectedHouseholdId]);

    // persist selected household
    useEffect(() => {
        if (!selectedHouseholdId) return;
        const selected = (households || []).find(
            (h) => String(h.household_id) === String(selectedHouseholdId)
        );
        if (!selected) return;
        localStorage.setItem("household", JSON.stringify(selected));
    }, [selectedHouseholdId, households]);

    // guard: selected household must exist
    useEffect(() => {
        if (!selectedHouseholdId) return;
        if (!Array.isArray(households) || households.length === 0) return;

        const exists = households.some(
            (h) => String(h.household_id) === String(selectedHouseholdId)
        );
        if (!exists) setSelectedHouseholdId(String(households[0].household_id));
    }, [selectedHouseholdId, households]);

    const handleToggleChart = (id) => {
        setActiveChartIds((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        );
    };

    // ---- Pie: Top 6 + Other
    const categoryPieData = useMemo(() => {
        const list = Array.isArray(categoryData) ? [...categoryData] : [];
        const cleaned = list
            .map((x) => ({
                ...x,
                value: safeNumber(x && x.value) ?? 0,
                name: (x && x.name) || "Unknown",
            }))
            .filter((x) => x.value > 0);

        cleaned.sort((a, b) => b.value - a.value);

        const top = cleaned.slice(0, 6);
        const rest = cleaned.slice(6);
        const otherValue = rest.reduce((sum, x) => sum + (x.value || 0), 0);

        if (otherValue > 0) {
            top.push({
                name: "Other",
                value: otherValue,
                color: "hsl(var(--muted-foreground))",
                _isOther: true,
            });
        }

        return top;
    }, [categoryData]);

    const topCategory = useMemo(() => {
        if (!categoryPieData || categoryPieData.length === 0) return null;
        const top = [...categoryPieData]
            .filter((x) => !x._isOther)
            .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
        if (!top) return null;
        return { name: top.name, value: top.value };
    }, [categoryPieData]);

    // ---- Download data per chart (CSV)
    const handleDownloadChartData = useCallback(
        (chartId) => {
            const tf = timeframeLabel.replace(/\s+/g, "-").toLowerCase();
            const hh = (selectedHouseholdName || "household").replace(/\s+/g, "-").toLowerCase();
            const filename = `analytics-${chartId}-${hh}-${tf}.csv`;

            let rows = [];
            if (chartId === "distribution") rows = weeklyData || [];
            if (chartId === "category") rows = categoryData || [];
            if (chartId === "load-trend") rows = loadTrendData || [];
            if (chartId === "completion") rows = completionData || [];
            if (chartId === "radar") rows = radarData || [];

            const csv = toCsv(rows);
            if (!csv) {
                downloadTextFile(filename, "No data", "text/plain");
                return;
            }
            downloadTextFile(filename, csv, "text/csv");
        },
        [
            timeframeLabel,
            selectedHouseholdName,
            weeklyData,
            categoryData,
            loadTrendData,
            completionData,
            radarData,
        ]
    );

    // ---- Stats: add comparison + descriptions
    const enrichedStats = useMemo(() => {
        const list = Array.isArray(stats) ? stats : [];
        return list.map((s) => {
            const current = s && s.value;
            const prev = s && (s.previousValue ?? s.prevValue ?? s.previous);

            const computedPct = pctChange(current, prev);
            const changeText = (s && s.change) || (computedPct === null ? null : formatPct(computedPct));
            const trend =
                (s && s.trend) ||
                (computedPct === null ? "flat" : computedPct > 0 ? "up" : computedPct < 0 ? "down" : "flat");

            const description =
                (s && s.description) ||
                (s && s.title && s.title.toLowerCase().includes("task")
                    ? "Total number of tasks visible in the selected timeframe."
                    : s && s.title && s.title.toLowerCase().includes("completion")
                        ? "Completed vs pending for the selected timeframe."
                        : "Key metric calculated for the selected timeframe.");

            const compareLabel =
                prev === null || prev === undefined ? null : "vs previous period";

            return {
                ...s,
                _trend: trend,
                _changeText: changeText,
                _description: description,
                _compareLabel: compareLabel,
            };
        });
    }, [stats]);

    // Guard states
    if (!Array.isArray(households) || households.length === 0) {
        return <NoHouseholdState onRetry={load} />;
    }

    if (loading) {
        return <div className="p-6 text-muted-foreground">Loading analytics…</div>;
    }

    if (noHousehold) {
        return <NoHouseholdState onRetry={() => load(timeframe)} />;
    }

    if (error) {
        return (
            <div className="p-6 space-y-3">
                <p className="text-destructive font-medium">Failed to load analytics</p>
                <p className="text-sm text-muted-foreground">{(error && error.message) || "Unknown error"}</p>
                <Button variant="outline" onClick={() => load(timeframe)}>
                    Retry
                </Button>
            </div>
        );
    }

    const StatePill = ({ children, title }) => (
        <span
            title={title}
            className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground"
        >
            {children}
        </span>
    );

    const CardActions = ({ chartId, title }) => (
        <div className="flex items-center gap-1">
            <Button
                size="icon"
                variant="ghost"
                onClick={() => setExpandedChartId(chartId)}
                aria-label={`Expand ${title}`}
                title="Expand"
            >
                <Maximize2 className="h-4 w-4" />
            </Button>

            <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDownloadChartData(chartId)}
                aria-label={`Download ${title} data`}
                title="Download data (CSV)"
            >
                <Download className="h-4 w-4" />
            </Button>

            <Button
                size="icon"
                variant="ghost"
                onClick={() => handleToggleChart(chartId)}
                aria-label={`Hide ${title}`}
                title="Hide"
            >
                <EyeOff className="h-4 w-4" />
            </Button>
        </div>
    );

    const renderExpandedChart = () => {
        if (!expandedChartId) return null;
        const meta = chartMetaById.get(expandedChartId);
        const title = (meta && meta.title) || "Chart";
        const desc = meta && meta.desc;

        const body = (() => {
            if (expandedChartId === "distribution") {
                return (
                    <ChartFrame
                        isEmpty={!weeklyData || weeklyData.length === 0}
                        emptyTitle={meta && meta.emptyTitle}
                        emptyHint={meta && meta.emptyHint}
                        height={360}
                    >
                        <BarChart data={weeklyData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="week"
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                tickFormatter={(value) => "Week " + String(value).split("-W")[1]}
                            />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend content={({ payload }) => <ChartLegend payload={payload} layout="grid" />} />
                            {sortedPeople.map((person) => (
                                <Bar
                                    key={`bar-expanded-${person}`}
                                    dataKey={person}
                                    name={getDisplayNameFromUsername(person, labels)}
                                    fill={personColorMap[person] || "hsl(var(--muted-foreground))"}
                                    radius={[4, 4, 0, 0]}
                                />
                            ))}
                        </BarChart>
                    </ChartFrame>
                );
            }

            if (expandedChartId === "category") {
                return (
                    <ChartFrame
                        isEmpty={!categoryPieData || categoryPieData.length === 0}
                        emptyTitle={meta && meta.emptyTitle}
                        emptyHint={meta && meta.emptyHint}
                        height={360}
                    >
                        <PieChart>
                            <Pie
                                data={categoryPieData}
                                innerRadius={70}
                                outerRadius={110}
                                dataKey="value"
                                nameKey="name"
                                paddingAngle={2}
                            >
                                {categoryPieData.map((entry, index) => (
                                    <Cell
                                        key={`cat-expanded-${index}-${entry && entry.name}`}
                                        fill={entry.color || SERIES_COLORS[index % SERIES_COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend content={({ payload }) => <ChartLegend payload={payload} layout="wrap" />} />
                        </PieChart>
                    </ChartFrame>
                );
            }

            if (expandedChartId === "load-trend") {
                return (
                    <ChartFrame
                        isEmpty={!loadTrendData || loadTrendData.length === 0}
                        emptyTitle={meta && meta.emptyTitle}
                        emptyHint={meta && meta.emptyHint}
                        height={360}
                    >
                        <AreaChart data={loadTrendData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Area
                                type="monotone"
                                dataKey="load"
                                stroke="hsl(var(--primary))"
                                fill="hsl(var(--primary) / 0.2)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ChartFrame>
                );
            }

            if (expandedChartId === "completion") {
                return (
                    <ChartFrame
                        isEmpty={!completionData || completionData.length === 0}
                        emptyTitle={meta && meta.emptyTitle}
                        emptyHint={meta && meta.emptyHint}
                        height={360}
                    >
                        <LineChart data={completionData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend content={({ payload }) => (
                                <ChartLegend payload={payload} layout="grid" itemType="line" />
                            )} />
                            <Line dataKey="completed" stroke="hsl(var(--sage))" type="monotone" strokeWidth={2} />
                            <Line dataKey="pending" stroke="hsl(var(--terracotta))" type="monotone" strokeWidth={2} />
                        </LineChart>
                    </ChartFrame>
                );
            }

            if (expandedChartId === "radar") {
                return (
                    <ChartFrame
                        isEmpty={!radarData || radarData.length === 0}
                        emptyTitle={meta && meta.emptyTitle}
                        emptyHint={meta && meta.emptyHint}
                        height={360}
                    >
                        <RadarChart data={radarData} outerRadius="70%" cy="48%" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                            <PolarGrid />
                            <PolarAngleAxis
                                dataKey="category"
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                            />
                            {sortedPeople.map((person) => (
                                <Radar
                                    key={`radar-expanded-${person}`}
                                    name={getDisplayNameFromUsername(person, labels)}
                                    dataKey={person}
                                    stroke={personColorMap[person]}
                                    fill={personColorMap[person]}
                                    fillOpacity={0.25}
                                />
                            ))}
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend content={({ payload }) => <ChartLegend payload={payload} layout="grid" />} />
                        </RadarChart>
                    </ChartFrame>
                );
            }

            return null;
        })();

        return (
            <Dialog open={!!expandedChartId} onOpenChange={(open) => !open && setExpandedChartId(null)}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        {desc ? <p className="text-sm text-muted-foreground mt-1">{desc}</p> : null}
                    </DialogHeader>

                    <div className="mt-2">{body}</div>

                    <div className="mt-2 flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => handleDownloadChartData(expandedChartId)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download data
                        </Button>
                        <Button variant="outline" onClick={() => setExpandedChartId(null)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <motion.div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        Analytics
                    </h1>

                    {/* Household + timeframe */}
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <div className="w-[260px]">
                            <p className="text-xs text-muted-foreground mb-1">Household view</p>

                            <Select
                                value={selectedHouseholdId || ""}
                                onValueChange={(val) => {
                                    setSelectedHouseholdId(val);
                                    setLastUpdatedAt(null);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select household" />
                                </SelectTrigger>

                                <SelectContent>
                                    {(households || []).map((h) => (
                                        <SelectItem key={h.household_id} value={String(h.household_id)}>
                                            {h.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Timeframe</p>
                            <div className="flex items-center gap-2 rounded-md border bg-card p-1 w-fit">
                                {timeframeOptions.map((opt) => (
                                    <Button
                                        key={opt.id}
                                        type="button"
                                        size="sm"
                                        className="h-8"
                                        variant={timeframe === opt.id ? "default" : "ghost"}
                                        onClick={() => setTimeframe(opt.id)}
                                        disabled={loading}
                                        aria-pressed={timeframe === opt.id}
                                    >
                                        {opt.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* State bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <StatePill title="Current household">
                            <Info className="h-3.5 w-3.5" />
                            {selectedHouseholdName}
                        </StatePill>
                        <StatePill title="Selected timeframe">{timeframeLabel}</StatePill>
                        {lastUpdatedAt ? (
                            <StatePill title={lastUpdatedAt.toLocaleString()}>
                                {formatRelativeTime(lastUpdatedAt)}
                            </StatePill>
                        ) : null}
                        {topCategory ? (
                            <StatePill title="Top category in the current timeframe">
                                Top: <span className="text-foreground">{topCategory.name}</span>
                            </StatePill>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => load(timeframe)}
                        disabled={loading}
                        title="Refresh analytics"
                        aria-label="Refresh analytics"
                    >
                        <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>

                    <Button onClick={() => setIsManageOpen(true)} variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Manage Charts
                    </Button>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
                {(enrichedStats || []).slice(0, 4).map((stat, index) => {
                    const Icon =
                        stat.icon === "Users"
                            ? Users
                            : stat.icon === "TrendingDown"
                                ? TrendingDown
                                : stat.icon === "TrendingUp"
                                    ? TrendingUp
                                    : CheckCircle2;

                    const pillClass =
                        stat._trend === "up"
                            ? "bg-sage-light text-sage"
                            : stat._trend === "down"
                                ? "bg-terracotta-light text-terracotta"
                                : "bg-muted text-muted-foreground";

                    return (
                        <Card key={`${stat.title}-${index}`} className="border-border">
                            <CardContent className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-5 w-5 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                                    </div>

                                    {stat._changeText ? (
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pillClass}`}>
                                            {stat._changeText}
                                            {stat._compareLabel ? (
                                                <span className="ml-1 opacity-80">{stat._compareLabel}</span>
                                            ) : null}
                                        </span>
                                    ) : null}
                                </div>

                                <div>
                                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{stat._description}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </motion.div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Distribution */}
                {activeChartIds.includes("distribution") && (
                    <Card className="min-w-0">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div className="space-y-1">
                                <CardTitle>Task Distribution by Person</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Weekly count of tasks per person, grouped by week number.
                                </p>
                            </div>
                            <CardActions chartId="distribution" title="Task Distribution by Person" />
                        </CardHeader>

                        <CardContent className="min-w-0">
                            <ChartFrame
                                isEmpty={!weeklyData || weeklyData.length === 0}
                                emptyTitle={chartMetaById.get("distribution").emptyTitle}
                                emptyHint={chartMetaById.get("distribution").emptyHint}
                            >
                                <BarChart data={weeklyData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="week"
                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                        tickFormatter={(value) => "Week " + String(value).split("-W")[1]}
                                    />
                                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend content={({ payload }) => <ChartLegend payload={payload} layout="grid" />} />
                                    {sortedPeople.map((person) => (
                                        <Bar
                                            key={`bar-${person || "unknown"}`}
                                            dataKey={person}
                                            name={getDisplayNameFromUsername(person, labels)}
                                            fill={personColorMap[person] || "hsl(var(--muted-foreground))"}
                                            radius={[4, 4, 0, 0]}
                                        />
                                    ))}
                                </BarChart>
                            </ChartFrame>
                        </CardContent>
                    </Card>
                )}

                {/* Category */}
                {activeChartIds.includes("category") && (
                    <Card className="min-w-0">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div className="space-y-1">
                                <CardTitle>Tasks by Category</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Top 6 categories + “Other” to keep the legend readable.
                                    {topCategory ? (
                                        <>
                                            {" "}
                                            <span className="text-foreground font-medium">Top: {topCategory.name}</span>
                                        </>
                                    ) : null}
                                </p>
                            </div>
                            <CardActions chartId="category" title="Tasks by Category" />
                        </CardHeader>

                        <CardContent className="min-w-0">
                            <ChartFrame
                                isEmpty={!categoryPieData || categoryPieData.length === 0}
                                emptyTitle={chartMetaById.get("category").emptyTitle}
                                emptyHint={chartMetaById.get("category").emptyHint}
                            >
                                <PieChart>
                                    <Pie
                                        data={categoryPieData}
                                        innerRadius={60}
                                        outerRadius={90}
                                        dataKey="value"
                                        nameKey="name"
                                        paddingAngle={2}
                                    >
                                        {categoryPieData.map((entry, index) => (
                                            <Cell
                                                key={`cat-${index}-${entry && entry.name}`}
                                                fill={entry.color || SERIES_COLORS[index % SERIES_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend content={({ payload }) => <ChartLegend payload={payload} layout="wrap" />} />
                                </PieChart>
                            </ChartFrame>
                        </CardContent>
                    </Card>
                )}

                {/* Load trend */}
                {activeChartIds.includes("load-trend") && (
                    <Card className="min-w-0">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div className="space-y-1">
                                <CardTitle>Mental Load Trend</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Overall load score over time (monthly).
                                </p>
                            </div>
                            <CardActions chartId="load-trend" title="Mental Load Trend" />
                        </CardHeader>

                        <CardContent className="min-w-0">
                            <ChartFrame
                                isEmpty={!loadTrendData || loadTrendData.length === 0}
                                emptyTitle={chartMetaById.get("load-trend").emptyTitle}
                                emptyHint={chartMetaById.get("load-trend").emptyHint}
                            >
                                <AreaChart data={loadTrendData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Area
                                        type="monotone"
                                        dataKey="load"
                                        stroke="hsl(var(--primary))"
                                        fill="hsl(var(--primary) / 0.2)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ChartFrame>
                        </CardContent>
                    </Card>
                )}

                {/* Completion */}
                {activeChartIds.includes("completion") && (
                    <Card className="min-w-0">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div className="space-y-1">
                                <CardTitle>Daily Completion Rate</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Completed vs pending tasks per day in the selected timeframe.
                                </p>
                            </div>
                            <CardActions chartId="completion" title="Daily Completion Rate" />
                        </CardHeader>

                        <CardContent className="min-w-0">
                            <ChartFrame
                                isEmpty={!completionData || completionData.length === 0}
                                emptyTitle={chartMetaById.get("completion").emptyTitle}
                                emptyHint={chartMetaById.get("completion").emptyHint}
                            >
                                <LineChart data={completionData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend content={({ payload }) => (
                                        <ChartLegend payload={payload} layout="grid" itemType="line" />
                                    )} />
                                    <Line dataKey="completed" stroke="hsl(var(--sage))" type="monotone" strokeWidth={2} />
                                    <Line dataKey="pending" stroke="hsl(var(--terracotta))" type="monotone" strokeWidth={2} />
                                </LineChart>
                            </ChartFrame>
                        </CardContent>
                    </Card>
                )}

                {/* Radar */}
                {activeChartIds.includes("radar") && (
                    <Card className="min-w-0">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div className="space-y-1">
                                <CardTitle>Category Expertise</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Per-person strength by category (higher = more handled/completed).
                                </p>
                            </div>
                            <CardActions chartId="radar" title="Category Expertise" />
                        </CardHeader>

                        <CardContent className="min-w-0">
                            <ChartFrame
                                isEmpty={!radarData || radarData.length === 0}
                                emptyTitle={chartMetaById.get("radar").emptyTitle}
                                emptyHint={chartMetaById.get("radar").emptyHint}
                            >
                                <RadarChart data={radarData} outerRadius="68%" cy="44%" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                    <PolarGrid />
                                    <PolarAngleAxis
                                        dataKey="category"
                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={10}
                                    />
                                    {sortedPeople.map((person) => (
                                        <Radar
                                            key={`radar-${person}`}
                                            name={getDisplayNameFromUsername(person, labels)}
                                            dataKey={person}
                                            stroke={personColorMap[person]}
                                            fill={personColorMap[person]}
                                            fillOpacity={0.25}
                                        />
                                    ))}
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend content={({ payload }) => <ChartLegend payload={payload} layout="grid" />} />
                                </RadarChart>
                            </ChartFrame>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Manage Dialog */}
            <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Charts</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-4">
                        {CHARTS.map((c) => {
                            const isActive = activeChartIds.includes(c.id);
                            return (
                                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium">{c.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                                    </div>

                                    <Button
                                        size="sm"
                                        variant={isActive ? "outline" : "default"}
                                        onClick={() => handleToggleChart(c.id)}
                                    >
                                        {isActive ? (
                                            <>
                                                <EyeOff className="w-4 h-4 mr-1" /> Hide
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4 mr-1" /> Show
                                            </>
                                        )}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Expanded chart modal */}
            {renderExpandedChart()}
        </div>
    );
};

export default Analytics;
