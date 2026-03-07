import { PieChart, Pie, Cell, Tooltip } from "recharts";

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
    onPointSelect,
}) {
    const isEmpty = !data || data.length === 0;
    const legendPayload = (data || []).map((entry, index) => ({
        value: entry?.name || "Unknown",
        color: entry?.color || seriesColors[index % seriesColors.length],
    }));

    return (
        <div className="min-w-0">
            <ChartFrame
                isEmpty={isEmpty}
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
                        onClick={(entry) => {
                            if (!onPointSelect) return;
                            onPointSelect({
                                name: entry?.name,
                                value: entry?.value,
                            });
                        }}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cat-${index}-${entry?.name || "unknown"}`}
                                fill={entry?.color || seriesColors[index % seriesColors.length]}
                            />
                        ))}
                    </Pie>

                    <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
            </ChartFrame>

            {!isEmpty ? <ChartLegend payload={legendPayload} layout={legendLayout} /> : null}
        </div>
    );
}
