// src/components/analytics/charts/RadarChart.jsx
import {
    RadarChart as RChart,
    PolarGrid,
    PolarAngleAxis,
    Radar,
    Tooltip,
} from "recharts";

import ChartFrame from "@/components/analytics/ChartFrame";
import ChartLegend from "@/components/analytics/ChartLegend";
import PeopleLegend from "@/components/analytics/PeopleLegend";


const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
};

export default function RadarChart({
    data, // <- radarData
    meta,
    sortedPeople,
    labels,
    personColorMap,
    getDisplayNameFromUsername,
    height = 256,
    outerRadius = "68%",
    cy = "44%",
}) {
        const isEmpty = !data || data.length === 0;

    return (
        <div className="min-w-0">
        <ChartFrame
            isEmpty={!data || data.length === 0}
            emptyTitle={meta?.emptyTitle}
            emptyHint={meta?.emptyHint}
            height={height}
        >
            <RChart data={data} outerRadius={outerRadius} cy={cy} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <PolarGrid />

                <PolarAngleAxis
                    dataKey="category"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                />

                {sortedPeople.map((person) => (
                    <Radar
                        key={`radar-${person}`}
                        name={getDisplayNameFromUsername(person, labels)}
                        dataKey={person}
                        stroke={personColorMap[person]}
                        fill={personColorMap[person]}
                        fillOpacity={0.25}
                    />
                ))}

                <Tooltip contentStyle={tooltipStyle} />
            </RChart>
        </ChartFrame>

        {/* ✅ external legend (pushes layout down, no overlap) */}
                    {!isEmpty ? (
                        <PeopleLegend
                            people={sortedPeople}
                            getLabel={(p) => getDisplayNameFromUsername(p, labels)}
                            getColor={(p) => personColorMap[p] || "hsl(var(--muted-foreground))"}
                        />
                    ) : null}
        </div>
    );
}