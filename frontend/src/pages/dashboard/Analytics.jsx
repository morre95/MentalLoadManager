import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

    // -----------------------------
    // API Client (shared)
    // -----------------------------
    const apiClient = useMemo(() => {
        // IMPORTANT: adjust token retrieval to match your auth approach.
        // If you store access token elsewhere (cookies, Zustand, etc), update getAccessToken.
        return createApiClient({
            getAccessToken: () => localStorage.getItem("access_token"),
            onUnauthorized: () => {
                // Optional: redirect to login, clear token, show toast, etc.
                // localStorage.removeItem("token");
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
                // This uses your shared analytics.js -> apiClient.request -> env baseUrl
                const summary = await fetchAnalyticsSummary(apiClient);

                if (!alive) return;

                setPeople(summary.people || []);
                setWeeklyData(summary.weeklyData || []);
                setCategoryData(summary.categoryData || []);
                setLoadTrendData(summary.loadTrendData || []);
                setCompletionData(summary.completionData || []);
                setRadarData(summary.radarData || []);
                setStats(summary.stats || []);
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

    // Basic palette: cycles between your theme vars
    const seriesColor = (index) =>
        index % 2 === 0 ? "hsl(var(--sage))" : "hsl(var(--terracotta))";

    if (loading) {
        return <div className="p-6 text-muted-foreground">Loading analytics…</div>;
    }

    if (error) {
        return (
            <div className="p-6 space-y-3">
                <p className="text-destructive font-medium">Failed to load analytics</p>
                <p className="text-sm text-muted-foreground">
                    {error?.message || "Unknown error"}
                </p>
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

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(stats || []).map((stat, index) => {
                    const Icon =
                        stat.icon === "Users"
                            ? Users
                            : stat.icon === "TrendingDown"
                                ? TrendingDown
                                : stat.icon === "TrendingUp"
                                    ? TrendingUp
                                    : CheckCircle2;

                    return (
                        <Card key={`${stat.title}-${index}`}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <p className="text-2xl font-bold mt-2">{stat.value}</p>
                                <p className="text-sm text-muted-foreground">{stat.title}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatePresence>
                    {activeChartIds.includes("distribution") && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Task Distribution by Person</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={weeklyData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="week" />
                                            <YAxis />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Legend />
                                            {(people || []).map((person, index) => (
                                                <Bar
                                                    key={`${person}-${index}`}
                                                    dataKey={person}
                                                    fill={seriesColor(index)}
                                                />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeChartIds.includes("category") && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Tasks by Category</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
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
                                                        key={`${entry?.name || "cat"}-${index}`}
                                                        fill={seriesColor(index)}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeChartIds.includes("load-trend") && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Mental Load Trend</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={loadTrendData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Area dataKey="load" fill="hsl(var(--primary) / 0.2)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeChartIds.includes("completion") && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Daily Completion Rate</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={completionData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="day" />
                                            <YAxis />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Legend />
                                            <Line dataKey="completed" stroke="hsl(var(--sage))" />
                                            <Line dataKey="pending" stroke="hsl(var(--terracotta))" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeChartIds.includes("radar") && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Category Expertise</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart data={radarData}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="category" />
                                            {(people || []).map((person, index) => (
                                                <Radar
                                                    key={`${person}-${index}`}
                                                    name={person}
                                                    dataKey={person}
                                                    stroke={seriesColor(index)}
                                                    fill={seriesColor(index)}
                                                    fillOpacity={0.3}
                                                />
                                            ))}
                                            <Legend />
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </AnimatePresence>
            </div>

            {/* Manage Dialog */}
            <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Charts</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-4">
                        {["distribution", "category", "load-trend", "completion", "radar"].map(
                            (id) => {
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
                            }
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Analytics;
