import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

import ChartFrame from "@/components/analytics/ChartFrame";

const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
};

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function toMomentumData(data) {
    const points = Array.isArray(data) ? data.slice(-7) : [];
    return points.map((point) => {
        const completed = toNumber(point?.completed);
        const pending = toNumber(point?.pending);
        const total = completed + pending;
        const rate = total > 0 ? (completed / total) * 100 : 0;
        return {
            day: point?.day || "Day",
            completionRate: Number(rate.toFixed(1)),
            total,
        };
    });
}

export default function MomentumChart({
    data, // <- completionData
    meta,
    height = 256,
    onPointSelect,
}) {
    const momentumData = toMomentumData(data);
    const hasSignal = momentumData.some((item) => item.total > 0);

    return (
        <ChartFrame
            isEmpty={!hasSignal}
            emptyTitle={meta?.emptyTitle}
            emptyHint={meta?.emptyHint}
            height={height}
        >
            <BarChart
                data={momentumData}
                margin={{ top: 20, right: 30, left: -10, bottom: 0 }}
                onClick={(state) => {
                    if (!onPointSelect) return;
                    const day = state?.activeLabel;
                    const row = momentumData.find((point) => point?.day === day);
                    if (!row) return;
                    onPointSelect(row);
                }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${value}%`, "Completion rate"]}
                />
                <Bar dataKey="completionRate" radius={[6, 6, 0, 0]}>
                    {momentumData.map((item) => (
                        <Cell
                            key={item.day}
                            fill={
                                item.completionRate >= 70
                                    ? "hsl(var(--sage))"
                                    : item.completionRate >= 40
                                        ? "hsl(var(--sky))"
                                        : "hsl(var(--terracotta))"
                            }
                        />
                    ))}
                </Bar>
            </BarChart>
        </ChartFrame>
    );
}
