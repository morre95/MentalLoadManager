import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Used when NOT logged in or API fails
const mockData = [
    { name: "Maria", value: 58, color: "hsl(150, 25%, 45%)" },
    { name: "Erik", value: 42, color: "hsl(15, 60%, 65%)" },
];

// Stable color mapping
const COLOR_MAP = {
    Maria: "hsl(150, 25%, 45%)",
    Erik: "hsl(15, 60%, 65%)",
};

const ResponsibilityChart = () => {
    const [chartData, setChartData] = useState(mockData);

    useEffect(() => {
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
        if (!token) return;

        let cancelled = false;

        async function load() {
            try {
                const res = await fetch(`${API_BASE_URL}/responsibility-split`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) return;

                const json = await res.json();
                const { total, counts } = json;

                if (!total || !Array.isArray(counts)) return;

                const normalized = counts.map((item) => ({
                    name: item.name,
                    value: Math.round((item.count / total) * 100),
                    color: COLOR_MAP[item.name] || "hsl(var(--muted-foreground))",
                }));

                if (!cancelled && normalized.length) {
                    setChartData(normalized);
                }
            } catch (err) {
                console.error("Failed to load responsibility data", err);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, []);

    // Balance score (same logic as before)
    const balanceScore = useMemo(() => {
        const values = chartData.map((d) => d.value);
        if (!values.length) return 0;
        const max = Math.max(...values);
        const min = Math.min(...values);
        return Math.max(0, 100 - (max - min));
    }, [chartData]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">
                    Responsibility Split
                </h3>
                <span className="text-xs text-muted-foreground">This week</span>
            </div>

            <div className="flex-1 flex items-center justify-center min-h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                            strokeWidth={0}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>

                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                boxShadow: "var(--shadow-md)",
                            }}
                            formatter={(value) => [`${value}%`, "Tasks"]}
                        />

                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value) => (
                                <span className="text-xs text-foreground">{value}</span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-2 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Balance Score</span>
                    <span className="font-medium text-primary">
                        {balanceScore >= 80
                            ? `Good (${balanceScore}%)`
                            : `Needs work (${balanceScore}%)`}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ResponsibilityChart;
