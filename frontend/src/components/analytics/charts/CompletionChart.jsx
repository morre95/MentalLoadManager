// src/components/analytics/charts/CompletionChart.jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

import ChartFrame from "@/components/analytics/ChartFrame";
import ChartLegend from "@/components/analytics/ChartLegend";

const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
};

export default function CompletionChart({
    data, // <- completionData
    meta,
    height = 256,
    legendLayout = "grid",
}) {
    return (
        <ChartFrame
            isEmpty={!data || data.length === 0}
            emptyTitle={meta?.emptyTitle}
            emptyHint={meta?.emptyHint}
            height={height}
        >
            <LineChart data={data} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />

                <Legend
                    content={({ payload }) => (
                        <ChartLegend payload={payload} layout={legendLayout} itemType="line" />
                    )}
                />

                <Line dataKey="completed" stroke="hsl(var(--sage))" type="monotone" strokeWidth={2} />
                <Line dataKey="pending" stroke="hsl(var(--terracotta))" type="monotone" strokeWidth={2} />
            </LineChart>
        </ChartFrame>
    );
}