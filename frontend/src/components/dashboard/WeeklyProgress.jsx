import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Mock fallback (logged out / API fails)
const mock = {
    rangeLabel: "This week",
    weekStart: "2026-02-03",
    weekEnd: "2026-02-09",
    people: [
        { key: "maria", name: "Maria", colorVar: "--sage" },
        { key: "erik", name: "Erik", colorVar: "--terracotta" },
    ],
    days: [
        { date: "2026-02-03", label: "Mon", counts: { maria: 5, erik: 3 } },
        { date: "2026-02-04", label: "Tue", counts: { maria: 3, erik: 4 } },
        { date: "2026-02-05", label: "Wed", counts: { maria: 4, erik: 2 } },
        { date: "2026-02-06", label: "Thu", counts: { maria: 6, erik: 5 } },
        { date: "2026-02-07", label: "Fri", counts: { maria: 2, erik: 3 } },
        { date: "2026-02-08", label: "Sat", counts: { maria: 1, erik: 2 } },
        { date: "2026-02-09", label: "Sun", counts: { maria: 0, erik: 1 } },
    ],
    totalCompleted: 41,
};

function hslVar(varName) {
    // varName like "--sage" -> use hsl(var(--sage))
    return `hsl(var(${varName}))`;
}

const WeeklyProgress = () => {
    const [data, setData] = useState(mock);

    useEffect(() => {
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
        if (!token) return;

        let cancelled = false;

        async function load() {
            try {
                const res = await fetch(`${API_BASE_URL}/dashboard/weekly-progress?range=week`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) return;

                const json = await res.json();
                if (!json || typeof json !== "object") return;

                if (!cancelled) {
                    // Keep mock fallback structure if backend returns partial
                    setData((prev) => ({
                        ...prev,
                        ...json,
                        people: Array.isArray(json.people) ? json.people : prev.people,
                        days: Array.isArray(json.days) ? json.days : prev.days,
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch weekly progress:", err);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, []);

    // Convert API {days:[{label, counts:{...}}]} -> recharts-friendly array:
    // [{ day:"Mon", maria:5, erik:3 }, ...]
    const chartData = useMemo(() => {
        return (data.days || []).map((d) => {
            const row = { day: d.label };
            const counts = d.counts || {};
            for (const p of data.people || []) {
                row[p.key] = Number(counts[p.key] ?? 0);
            }
            return row;
        });
    }, [data]);

    const totalCompletedText = useMemo(() => {
        const v = Number(data.totalCompleted ?? 0);
        return `${v} tasks`;
    }, [data.totalCompleted]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">
                    Weekly Progress
                </h3>

                <div className="flex items-center gap-3">
                    {(data.people || []).slice(0, 3).map((p) => (
                        <div key={p.key} className="flex items-center gap-1.5">
                            <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: hslVar(p.colorVar || "--primary") }}
                            />
                            <span className="text-xs text-muted-foreground">{p.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2}>
                        <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        />

                        <Tooltip
                            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                            contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                boxShadow: "var(--shadow-md)",
                                fontSize: "12px",
                            }}
                        />

                        {(data.people || []).map((p, idx) => (
                            <Bar
                                key={p.key}
                                dataKey={p.key}
                                stackId="a"
                                fill={hslVar(p.colorVar || "--primary")}
                                radius={idx === (data.people || []).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <div className="text-xs">
                    <span className="text-muted-foreground">Total completed: </span>
                    <span className="font-medium text-foreground">{totalCompletedText}</span>
                </div>
                <button type="button" className="text-xs text-primary hover:underline">
                    View details
                </button>
            </div>
        </div>
    );
};

export default WeeklyProgress;
