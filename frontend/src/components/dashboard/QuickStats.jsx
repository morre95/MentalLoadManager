import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, TrendingUp, Users } from "lucide-react";

import { apiClient, resolveCurrentHouseholdId } from "@/lib/utils";
import { fetchAnalyticsSummary } from "@shared";

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
        let cancelled = false;

        async function load() {
            try {
                const householdId = await resolveCurrentHouseholdId();
                if (!householdId) return;
                const summary = await fetchAnalyticsSummary(apiClient, householdId, "7d");
                const stats = Array.isArray(summary?.stats) ? summary.stats : [];
                const getStat = (title) =>
                    stats.find((item) => String(item?.title || "").toLowerCase() === title.toLowerCase());
                const completedStat = getStat("Done This Week");
                const openStat = getStat("Open Tasks Remaining");
                const balanceStat = getStat("Load Balance Score");

                if (!cancelled) {
                    setData((prev) => ({
                        ...prev,
                        rangeLabel: "Last 7 days",
                        completedThisWeek: {
                            ...prev.completedThisWeek,
                            value: Number(completedStat?.value ?? prev.completedThisWeek.value),
                            changeText: completedStat?.description || prev.completedThisWeek.changeText,
                            trend: completedStat?.trend === "up" ? "up" : "neutral",
                        },
                        inProgress: {
                            ...prev.inProgress,
                            value: Number(openStat?.value ?? prev.inProgress.value),
                            dueToday: prev.inProgress.dueToday,
                        },
                        familyBalance: {
                            ...prev.familyBalance,
                            valuePercent: Number(balanceStat?.value ?? prev.familyBalance.valuePercent),
                            changeText: balanceStat?.description || prev.familyBalance.changeText,
                            trend: balanceStat?.trend === "down" ? "down" : "up",
                        },
                        mentalLoadScore: {
                            ...prev.mentalLoadScore,
                            value:
                                Number(balanceStat?.value) >= 80
                                    ? "Low"
                                    : Number(balanceStat?.value) >= 60
                                        ? "Medium"
                                        : "High",
                            changeText: "Based on household load balance",
                            trend: Number(balanceStat?.value) >= 60 ? "up" : "neutral",
                        },
                    }));
                }
            } catch (err) {
                console.error("Failed to load quick stats from analytics summary:", err);
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
