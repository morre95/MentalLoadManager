import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, TrendingUp, Users } from "lucide-react";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Mock fallback (logged out / API fails)
const mockResponse = {
    rangeLabel: "This week",
    completedThisWeek: {
        value: 24,
        changeText: "+8 from last week",
        trend: "up",
    },
    inProgress: {
        value: 7,
        dueToday: 3,
    },
    familyBalance: {
        valuePercent: 84,
        changeText: "+12% improvement",
        trend: "up",
    },
    mentalLoadScore: {
        value: "Low",
        changeText: "Well distributed",
        trend: "up",
    },
};

const colorClasses = {
    sage: "bg-sage-light text-sage",
    sky: "bg-sky-light text-sky",
    terracotta: "bg-terracotta-light text-terracotta",
    lavender: "bg-lavender-light text-lavender",
};

const QuickStats = () => {
    const [data, setData] = useState(mockResponse);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        let cancelled = false;

        async function load() {
            try {
                const res = await fetch(`${API_BASE_URL}/dashboard/quick-stats?range=week`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) return;

                const json = await res.json();
                if (!json || typeof json !== "object") return;

                if (!cancelled) {
                    // Merge safely so missing fields don’t crash UI
                    setData((prev) => ({
                        ...prev,
                        ...json,
                        completedThisWeek: { ...prev.completedThisWeek, ...(json.completedThisWeek || {}) },
                        inProgress: { ...prev.inProgress, ...(json.inProgress || {}) },
                        familyBalance: { ...prev.familyBalance, ...(json.familyBalance || {}) },
                        mentalLoadScore: { ...prev.mentalLoadScore, ...(json.mentalLoadScore || {}) },
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch quick stats:", err);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, []);

    const stats = useMemo(
        () => [
            {
                label: "Completed This Week",
                value: String(data.completedThisWeek.value ?? 0),
                change: data.completedThisWeek.changeText ?? "",
                trend: data.completedThisWeek.trend ?? "neutral",
                icon: CheckCircle2,
                color: "sage",
            },
            {
                label: "In Progress",
                value: String(data.inProgress.value ?? 0),
                change:
                    typeof data.inProgress.dueToday === "number"
                        ? `${data.inProgress.dueToday} due today`
                        : "",
                trend: "neutral",
                icon: Clock,
                color: "sky",
            },
            {
                label: "Family Balance",
                value: `${data.familyBalance.valuePercent ?? 0}%`,
                change: data.familyBalance.changeText ?? "",
                trend: data.familyBalance.trend ?? "neutral",
                icon: Users,
                color: "terracotta",
            },
            {
                label: "Mental Load Score",
                value: data.mentalLoadScore.value ?? "—",
                change: data.mentalLoadScore.changeText ?? "",
                trend: data.mentalLoadScore.trend ?? "neutral",
                icon: TrendingUp,
                color: "lavender",
            },
        ],
        [data]
    );

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">Overview</h3>
                <span className="text-xs text-muted-foreground">{data.rangeLabel || "This week"}</span>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 rounded-lg bg-muted/50 flex flex-col"
                    >
                        <div
                            className={`w-8 h-8 rounded-lg ${colorClasses[stat.color]} flex items-center justify-center mb-2`}
                        >
                            <stat.icon className="w-4 h-4" />
                        </div>

                        <div className="text-lg font-semibold text-foreground">{stat.value}</div>
                        <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>

                        <div
                            className={`text-[10px] ${stat.trend === "up" ? "text-sage" : "text-muted-foreground"
                                }`}
                        >
                            {stat.change}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default QuickStats;
