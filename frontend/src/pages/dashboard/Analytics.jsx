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
} from "lucide-react";

import StackedBarChart from "./stackedbarchart_remove_later";

import { createApiClient, fetchAnalyticsSummary } from "../../../../shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

import { NoHouseholdState } from "@/components/ui/noHouseholdState";

/* -----------------------------
Component
----------------------------- */

const Analytics = () => {
    // -----------------------------
    // State
    // -----------------------------
    const [weeklyData, setWeeklyData] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [loadTrendData, setLoadTrendData] = useState([]);
    const [completionData, setCompletionData] = useState([]);
    const [radarData, setRadarData] = useState([]);
    const [stats, setStats] = useState([]);
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

    const [activeChartIds, setActiveChartIds] = useState([
        "distribution",
        "category",
        "load-trend",
        "completion",
        "radar",
    ]);

    const [isManageOpen, setIsManageOpen] = useState(false);
    const [labels, setLabels] = useState({});
    const [noHousehold, setNoHousehold] = useState(false);
    const [tick, setTick] = useState(0);

    // ✅ Global timeframe (matches backend param)
    // "7d" | "30d" | "12w"
    const [timeframe, setTimeframe] = useState("30d");

    useEffect(() => {
        const interval = setInterval(() => {
            setTick((t) => t + 1);
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    // -----------------------------
    // Colors (spread out, stable per person)
    // -----------------------------
    const SERIES_COLORS = [
        "hsl(var(--sage))",
        "hsl(var(--terracotta))",
        "hsl(var(--sky))",
        "hsl(var(--lavender))",
        "hsl(var(--sand))",
        "hsl(var(--primary))",
        "hsl(var(--accent))",
    ];

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
    }, [sortedPeople]);

    // -----------------------------
    // Reusable empty + wrappers
    // -----------------------------
    const ChartEmptyState = ({
        title = "No data yet for the selected timeframe",
        hint = "Add a task with category + assignee to unlock this chart",
    }) => {
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
    };

    const ChartFrame = ({ isEmpty, children }) => {
        return (
            <div className="h-72">
                {isEmpty ? (
                    <ChartEmptyState />
                ) : (
                    <ResponsiveContainer width="100%" height={256}>
                        {children}
                    </ResponsiveContainer>
                )}
            </div>
        );
    };

    const formatRelativeTime = (date) => {
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
    };

    // -----------------------------
    // API Client (shared)
    // -----------------------------
    const apiClient = useMemo(() => {
        return createApiClient({
            getAccessToken: () => localStorage.getItem("access_token"),
            onUnauthorized: () => {
                // Optional: clear token / redirect
                // localStorage.removeItem("access_token");
            },
        });
    }, []);

    // -----------------------------
    // Fetch Analytics (shared) - reusable load()
    //   ✅ Now passes timeframe to backend
    // -----------------------------
    const load = useCallback(
        async (tf = timeframe) => {
            setLoading(true);
            setError(null);
            setNoHousehold(false);

            try {
                // NOTE: update fetchAnalyticsSummary to accept timeframe:
                // fetchAnalyticsSummary(apiClient, householdId = null, timeframe = "30d")
                const summary = await fetchAnalyticsSummary(apiClient, null, tf);

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
                const msg = err?.message || "";

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
        [apiClient, timeframe]
    );

    // initial load + reload when timeframe changes
    useEffect(() => {
        let alive = true;

        const run = async () => {
            if (!alive) return;
            await load(timeframe);
        };

        run();

        return () => {
            alive = false;
        };
    }, [load, timeframe]);

    const handleToggleChart = (id) => {
        setActiveChartIds((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        );
    };

    const tooltipStyle = {
        backgroundColor: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "8px",
    };

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
                <p className="text-sm text-muted-foreground">{error?.message || "Unknown error"}</p>
                <Button variant="outline" onClick={() => load(timeframe)}>
                    Retry
                </Button>
            </div>
        );
    }

    const timeframeOptions = [
        { id: "7d", label: "7 days" },
        { id: "30d", label: "30 days" },
        { id: "12w", label: "12 weeks" },
    ];

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <motion.div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        Analytics
                    </h1>

                    {/* ✅ Global timeframe selector */}
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

                <div className="flex items-center gap-3">
                    {lastUpdatedAt ? (
                        <p className="text-xs text-muted-foreground" title={lastUpdatedAt.toLocaleString()}>
                            {formatRelativeTime(lastUpdatedAt)}
                        </p>
                    ) : null}

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
                {(stats || []).slice(0, 4).map((stat, index) => {
                    const Icon =
                        stat.icon === "Users"
                            ? Users
                            : stat.icon === "TrendingDown"
                                ? TrendingDown
                                : stat.icon === "TrendingUp"
                                    ? TrendingUp
                                    : CheckCircle2;

                    const pillClass =
                        stat.trend === "up"
                            ? "bg-sage-light text-sage"
                            : stat.trend === "down"
                                ? "bg-terracotta-light text-terracotta"
                                : "bg-muted text-muted-foreground";

                    return (
                        <Card key={`${stat.title}-${index}`} className="border-border">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <Icon className="h-5 w-5 text-muted-foreground" />

                                    {stat.change ? (
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pillClass}`}>
                                            {stat.change}
                                        </span>
                                    ) : null}
                                </div>

                                <p className="text-2xl font-bold text-foreground mt-2">{stat.value}</p>
                                <p className="text-sm text-muted-foreground">{stat.title}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </motion.div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeChartIds.includes("distribution") && (
                    <Card key="distribution" className="min-w-0">
                        <CardHeader>
                            <CardTitle>Task Distribution by Person</CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                            <ChartFrame isEmpty={!weeklyData?.length}>
                                <BarChart data={weeklyData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="week"
                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                        tickFormatter={(value) => "Week " + value.split("-W")[1]}
                                    />
                                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend
                                        verticalAlign="bottom"
                                        align="center"
                                        content={({ payload }) => (
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "repeat(2, auto)",
                                                    gap: "8px 18px",
                                                    justifyContent: "center",
                                                    paddingTop: 10,
                                                    fontSize: 14,
                                                    lineHeight: "18px",
                                                }}
                                            >
                                                {payload.map((entry, i) => (
                                                    <div
                                                        key={`legend-${i}`}
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                            color: entry.color,
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                width: 10,
                                                                height: 10,
                                                                backgroundColor: entry.color,
                                                                display: "inline-block",
                                                                borderRadius: 2,
                                                            }}
                                                        />
                                                        {entry.value}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />

                                    {sortedPeople.map((person, index) => (
                                        <Bar
                                            key={`bar-${index}-${person || "unknown"}`}
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

                {activeChartIds.includes("category") && (
                    <Card key="category" className="min-w-0">
                        <CardHeader>
                            <CardTitle>Tasks by Category</CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                            <ChartFrame isEmpty={!categoryData?.length}>
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        innerRadius={60}
                                        outerRadius={90}
                                        dataKey="value"
                                        nameKey="name"
                                        paddingAngle={2}
                                    >
                                        {(categoryData || []).map((entry, index) => (
                                            <Cell
                                                key={`cat-${index}-${entry?.name || "unknown"}`}
                                                fill={entry.color || SERIES_COLORS[index % SERIES_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend
                                        verticalAlign="bottom"
                                        align="center"
                                        content={({ payload }) => (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    gap: "8px 18px",
                                                    justifyContent: "center",
                                                    paddingTop: 10,
                                                    fontSize: 14,
                                                    lineHeight: "18px",
                                                }}
                                            >
                                                {payload.map((entry, i) => (
                                                    <div
                                                        key={`legend-${i}`}
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                            color: entry.color,
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                width: 10,
                                                                height: 10,
                                                                backgroundColor: entry.color,
                                                                display: "inline-block",
                                                                borderRadius: 2,
                                                            }}
                                                        />
                                                        {entry.value}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
                                </PieChart>
                            </ChartFrame>
                        </CardContent>
                    </Card>
                )}

                {activeChartIds.includes("load-trend") && (
                    <Card key="load-trend" className="min-w-0">
                        <CardHeader>
                            <CardTitle>Mental Load Trend</CardTitle>
                        </CardHeader>

                        <CardContent className="min-w-0">
                            <ChartFrame isEmpty={!loadTrendData?.length}>
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

                {activeChartIds.includes("completion") && (
                    <Card key="completion" className="min-w-0">
                        <CardHeader>
                            <CardTitle>Daily Completion Rate</CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                            <ChartFrame isEmpty={!completionData?.length}>
                                <LineChart data={completionData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend
                                        verticalAlign="bottom"
                                        align="center"
                                        content={({ payload }) => (
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "repeat(2, auto)",
                                                    gap: "8px 18px",
                                                    justifyContent: "center",
                                                    paddingTop: 10,
                                                    fontSize: 14,
                                                }}
                                            >
                                                {payload.map((entry, i) => (
                                                    <div
                                                        key={`legend-${i}`}
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                            fontWeight: 500,
                                                            color: entry.color,
                                                        }}
                                                    >
                                                        <svg width="24" height="10">
                                                            <line
                                                                x1="0"
                                                                y1="5"
                                                                x2="24"
                                                                y2="5"
                                                                stroke={entry.color}
                                                                strokeWidth="2"
                                                                strokeDasharray={entry.payload?.strokeDasharray}
                                                            />
                                                        </svg>

                                                        {entry.value}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
                                    <Line dataKey="completed" stroke="hsl(var(--sage))" type="monotone" strokeWidth={2} />
                                    <Line dataKey="pending" stroke="hsl(var(--terracotta))" type="monotone" strokeWidth={2} />
                                </LineChart>
                            </ChartFrame>
                        </CardContent>
                    </Card>
                )}

                {activeChartIds.includes("radar") && (
                    <Card className="min-w-0">
                        <CardHeader className="pb-2">
                            <CardTitle>Category Expertise</CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                            <ChartFrame isEmpty={!radarData?.length}>
                                <RadarChart
                                    data={radarData}
                                    outerRadius="68%"
                                    cy="44%"
                                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                                >
                                    <PolarGrid />
                                    <PolarAngleAxis
                                        dataKey="category"
                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={10}
                                    />

                                    {sortedPeople.map((person, index) => (
                                        <Radar
                                            key={`radar-${index}-${person}`}
                                            name={getDisplayNameFromUsername(person, labels)}
                                            dataKey={person}
                                            stroke={personColorMap[person]}
                                            fill={personColorMap[person]}
                                            fillOpacity={0.25}
                                        />
                                    ))}

                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend
                                        verticalAlign="bottom"
                                        align="center"
                                        content={({ payload }) => (
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "repeat(2, auto)",
                                                    gap: "8px 18px",
                                                    justifyContent: "center",
                                                    paddingTop: 10,
                                                    fontSize: 14,
                                                    lineHeight: "18px",
                                                }}
                                            >
                                                {payload.map((entry, i) => (
                                                    <div
                                                        key={`legend-${i}`}
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                            color: entry.color,
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                width: 10,
                                                                height: 10,
                                                                backgroundColor: entry.color,
                                                                display: "inline-block",
                                                                borderRadius: 2,
                                                            }}
                                                        />
                                                        {entry.value}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
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
                        {["distribution", "category", "load-trend", "completion", "radar"].map((id) => {
                            const isActive = activeChartIds.includes(id);

                            return (
                                <div key={id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <p className="text-sm font-medium">{id}</p>

                                    <Button
                                        size="sm"
                                        variant={isActive ? "outline" : "default"}
                                        onClick={() => handleToggleChart(id)}
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

            <StackedBarChart />
        </div>
    );
};

export default Analytics;
