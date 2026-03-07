// src/components/analytics/charts/LoadTrendChart.jsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

import ChartFrame from "@/components/analytics/ChartFrame";

const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
};

export default function LoadTrendChart({
    data, // <- loadTrendData
    meta,
    height = 256,
    onPointSelect,
}) {
    return (
        <ChartFrame
            isEmpty={!data || data.length === 0}
            emptyTitle={meta?.emptyTitle}
            emptyHint={meta?.emptyHint}
            height={height}
        >
            <AreaChart
                data={data}
                margin={{ top: 20, right: 30, left: -10, bottom: 0 }}
                onClick={(state) => {
                    if (!onPointSelect) return;
                    const month = state?.activeLabel;
                    const row = (data || []).find((point) => point?.month === month);
                    if (!row) return;
                    onPointSelect({ month: row.month, load: row.load });
                }}
            >
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
