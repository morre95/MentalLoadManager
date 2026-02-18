import { useState } from "react";
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

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
    Data
----------------------------- */

const weeklyData = [
    { week: "Week 1", maria: 24, erik: 18 },
    { week: "Week 2", maria: 22, erik: 21 },
    { week: "Week 3", maria: 28, erik: 19 },
    { week: "Week 4", maria: 20, erik: 25 },
    { week: "Week 5", maria: 23, erik: 22 },
    { week: "Week 6", maria: 19, erik: 24 },
];

const categoryData = [
    { name: "Shopping", value: 28, color: "hsl(var(--terracotta))" },
    { name: "Health", value: 15, color: "hsl(var(--lavender))" },
    { name: "Bills", value: 20, color: "hsl(var(--sky))" },
    { name: "Family", value: 22, color: "hsl(var(--sage))" },
    { name: "Admin", value: 15, color: "hsl(var(--sand))" },
];

const loadTrendData = [
    { month: "Jan", load: 65 },
    { month: "Feb", load: 72 },
    { month: "Mar", load: 58 },
    { month: "Apr", load: 55 },
    { month: "May", load: 48 },
    { month: "Jun", load: 52 },
];

const completionData = [
    { day: "Mon", completed: 8, pending: 3 },
    { day: "Tue", completed: 6, pending: 4 },
    { day: "Wed", completed: 9, pending: 2 },
    { day: "Thu", completed: 7, pending: 5 },
    { day: "Fri", completed: 10, pending: 1 },
    { day: "Sat", completed: 5, pending: 2 },
    { day: "Sun", completed: 4, pending: 1 },
];

const streakData = [
    { month: "Jan", streak: 5 },
    { month: "Feb", streak: 12 },
    { month: "Mar", streak: 8 },
    { month: "Apr", streak: 18 },
    { month: "May", streak: 22 },
    { month: "Jun", streak: 15 },
];

const radarData = [
    { category: "Shopping", maria: 85, erik: 60 },
    { category: "Cleaning", maria: 70, erik: 75 },
    { category: "Admin", maria: 50, erik: 90 },
    { category: "Health", maria: 80, erik: 65 },
    { category: "Cooking", maria: 90, erik: 40 },
    { category: "Maintenance", maria: 30, erik: 95 },
];

const goalProgressData = [
    { name: "Savings", progress: 72 },
    { name: "Reading", progress: 45 },
    { name: "Training", progress: 88 },
    { name: "Hydration", progress: 60 },
];

const stats = [
    {
        title: "Total Tasks Completed",
        value: "156",
        change: "+12%",
        trend: "up",
        icon: CheckCircle2,
    },
    {
        title: "Average Load Balance",
        value: "52/48",
        change: "+8%",
        trend: "up",
        icon: Users,
    },
    {
        title: "Mental Load Score",
        value: "32",
        change: "-15%",
        trend: "down",
        icon: TrendingDown,
    },
    {
        title: "Weekly Efficiency",
        value: "89%",
        change: "+5%",
        trend: "up",
        icon: TrendingUp,
    },
];

/* -----------------------------
    Widgets
----------------------------- */

const allChartWidgets = [
    {
        id: "distribution",
        title: "Task Distribution by Person",
        description: "Bar chart comparing tasks per person",
    },
    {
        id: "category",
        title: "Tasks by Category",
        description: "Pie chart of task categories",
    },
    {
        id: "load-trend",
        title: "Mental Load Trend",
        description: "Area chart of load over time",
    },
    {
        id: "completion",
        title: "Daily Completion Rate",
        description: "Line chart of daily completions",
    },
    {
        id: "streak",
        title: "Best Streaks",
        description: "Longest consecutive task streaks",
    },
    {
        id: "radar",
        title: "Category Expertise",
        description: "Radar chart of who handles what",
    },
    {
        id: "goal-progress",
        title: "Goal Progress Overview",
        description: "Bar chart of active goal completion",
    },
];

const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
};

/* -----------------------------
    Component
----------------------------- */

const Analytics = () => {
    const [activeChartIds, setActiveChartIds] = useState([
        "distribution",
        "category",
        "load-trend",
        "completion",
    ]);

    const [isManageOpen, setIsManageOpen] = useState(false);

    const handleToggleChart = (id) => {
        setActiveChartIds((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        );
    };

    const renderChart = (id) => {
        switch (id) {
            case "distribution":
                return (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="week" />
                                <YAxis />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend />
                                <Bar dataKey="maria" fill="hsl(var(--sage))" />
                                <Bar dataKey="erik" fill="hsl(var(--terracotta))" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                );

            case "category":
                return (
                    <div className="h-64 flex items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={index} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                );

            case "load-trend":
                return (
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
                );

            case "completion":
                return (
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
                );

            default:
                return null;
        }
    };

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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatePresence>
                    {activeChartIds.map((id) => {
                        const widget = allChartWidgets.find((w) => w.id === id);
                        if (!widget) return null;

                        return (
                            <motion.div key={id}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>{widget.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>{renderChart(id)}</CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Manage Dialog */}
            <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Charts</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-4">
                        {allChartWidgets.map((widget) => {
                            const isActive = activeChartIds.includes(widget.id);

                            return (
                                <div
                                    key={widget.id}
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                >
                                    <p>{widget.title}</p>

                                    <Button
                                        size="sm"
                                        variant={isActive ? "outline" : "default"}
                                        onClick={() => handleToggleChart(widget.id)}
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
