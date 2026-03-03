import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

import ChartFrame from "@/components/analytics/ChartFrame";
import ChartLegend from "@/components/analytics/ChartLegend";

const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
};

export default function CategoryChart({
    data, // <- categoryPieData
    meta,
    seriesColors,
    height = 256,
    innerRadius = 60,
    outerRadius = 90,
    legendLayout = "wrap",
}) {
    return (
        <ChartFrame
            isEmpty={!data || data.length === 0}
            emptyTitle={meta?.emptyTitle}
            emptyHint={meta?.emptyHint}
            height={height}
        >
            <PieChart>
                <Pie
                    data={data}
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                >
                    {data.map((entry, index) => (
                        <Cell
                            key={`cat-${index}-${entry?.name || "unknown"}`}
                            fill={entry?.color || seriesColors[index % seriesColors.length]}
                        />
                    ))}
                </Pie>

                <Tooltip contentStyle={tooltipStyle} />
                <Legend content={({ payload }) => <ChartLegend payload={payload} layout={legendLayout} />} />
            </PieChart>
        </ChartFrame>
    );
}