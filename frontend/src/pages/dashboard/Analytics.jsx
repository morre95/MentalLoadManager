import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";

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

    const [activeChartIds, setActiveChartIds] = useState([
        "distribution",
        "category",
        "load-trend",
        "completion",
        "radar",
    ]);

    const [isManageOpen, setIsManageOpen] = useState(false);
    const [labels, setLabels] = useState({});


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
    // Fetch Analytics (shared)
    // -----------------------------
    useEffect(() => {
        let alive = true;

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const summary = await fetchAnalyticsSummary(apiClient);
                if (!alive) return;
                console.log("Radar categories:", radarData.map(r => r.category));
console.log("Radar keys on first row:", radarData[0] ? Object.keys(radarData[0]) : []);

                setPeople(summary.people || []);
                setWeeklyData(summary.weeklyData || []);
                setCategoryData(summary.categoryData || []);
                setLoadTrendData(summary.loadTrendData || []);
                setCompletionData(summary.completionData || []);
                setRadarData(summary.radarData || []);
                setStats(summary.stats || []);
                setLabels(summary.labels || {});

            } catch (err) {
                if (!alive) return;
                console.error(err);
                setError(err);
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        };

        load();

        return () => {
            alive = false;
        };
    }, [apiClient]);

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

    if (error) {
        return (
            <div className="p-6 space-y-3">
                <p className="text-destructive font-medium">Failed to load analytics</p>
                <p className="text-sm text-muted-foreground">{error?.message || "Unknown error"}</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <motion.div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-primary" />
                    Analytics
                </h1>

                <Button onClick={() => setIsManageOpen(true)} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Charts
                </Button>
            </motion.div>

            {/* Stats Grid (ONLY change compared to your old file) */}
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
                                        <span
                                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${pillClass}`}
                                        >
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
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height={256}>
                                    <BarChart data={weeklyData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                        dataKey="week" 
                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                        tickFormatter={(value) => "Week " + value.split("-W")[1]}
                                            />
                                        <YAxis 
                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}/>
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
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeChartIds.includes("category") && (
                    <Card key="category" className="min-w-0">
                        <CardHeader>
                            <CardTitle>Tasks by Category</CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height={256}>
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
                                                        display: "grid",
                                                        gridTemplateColumns: "repeat(2, auto)", // ✅ 2 per row
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
                                                                color: entry.color, // ✅ same as Recharts legend coloring
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
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeChartIds.includes("load-trend") && (
                    <Card key="load-trend" className="min-w-0">
                        <CardHeader>
                            <CardTitle>Mental Load Trend</CardTitle>
                        </CardHeader>

                        <CardContent className="min-w-0">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height={256}>
                                    <AreaChart data={loadTrendData}>
                                        <CartesianGrid strokeDasharray="3 3" />

                                        {/* ✅ Match font + theme */}
                                        <XAxis
                                            dataKey="month"
                                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                        />
                                        <YAxis
                                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                        />

                                        <Tooltip contentStyle={tooltipStyle} />

                                        {/* ✅ Add stroke so it matches style */}
                                        <Area
                                            type="monotone"
                                            dataKey="load"
                                            stroke="hsl(var(--primary))"
                                            fill="hsl(var(--primary) / 0.2)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeChartIds.includes("completion") && (
                    <Card key="completion" className="min-w-0">
                        <CardHeader>
                            <CardTitle>Daily Completion Rate</CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height={256}>
                                    <LineChart data={completionData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                        dataKey="day" 
                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                        <YAxis 
                                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}/>
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Legend
                                            verticalAlign="bottom"
                                            align="center"
                                            content={({ payload }) => (
                                                <div
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "repeat(2, auto)", // 2 per row
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
                                                            {/* ✅ Real SVG line indicator */}
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
                                        <Line dataKey="completed" stroke="hsl(var(--sage))" type="monotone" strokeWidth={2}/>
                                        <Line dataKey="pending" stroke="hsl(var(--terracotta))" type="monotone" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeChartIds.includes("radar") && (
                    <Card className="min-w-0">
                        <CardHeader className="pb-2">
                            <CardTitle>Category Expertise</CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                            <div className="h-72 min-w-0">
                                <ResponsiveContainer width="100%" height="100%">
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
                                                        gridTemplateColumns: "repeat(2, auto)", // ✅ 2 per row
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
                                                                color: entry.color, // ✅ same as Recharts legend coloring
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
                                </ResponsiveContainer>
                            </div>
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
                                <div
                                    key={id}
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                >
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
        </div>
    );
};

export default Analytics;
