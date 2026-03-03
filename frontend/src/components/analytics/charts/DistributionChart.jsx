import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";

import ChartFrame from "@/components/analytics/ChartFrame";
import ChartLegend from "@/components/analytics/ChartLegend";

const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
};

export default function DistributionChart({
    data,
    meta,
    sortedPeople,
    labels,
    personColorMap,
    getDisplayNameFromUsername,
    height = 256,
}) {
    return (
        <ChartFrame
            isEmpty={!data || data.length === 0}
            emptyTitle={meta?.emptyTitle}
            emptyHint={meta?.emptyHint}
            height={height}
        >
            <BarChart data={data} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="week"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickFormatter={(value) => "Week " + String(value).split("-W")[1]}
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend content={({ payload }) => <ChartLegend payload={payload} layout="grid" />} />

                {sortedPeople.map((person) => (
                    <Bar
                        key={`bar-${person || "unknown"}`}
                        dataKey={person}
                        name={getDisplayNameFromUsername(person, labels)}
                        fill={personColorMap[person] || "hsl(var(--muted-foreground))"}
                        radius={[4, 4, 0, 0]}
                    />
                ))}
            </BarChart>
        </ChartFrame>
    );
}