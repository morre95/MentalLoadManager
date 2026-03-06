import { useMemo } from "react";

import ExpandedChartDialog from "@/components/analytics/ExpandedChartDialog";

import DistributionChart from "@/components/analytics/charts/DistributionChart";
import CategoryChart from "@/components/analytics/charts/CategoryChart";
import LoadTrendChart from "@/components/analytics/charts/LoadTrendChart";
import CompletionChart from "@/components/analytics/charts/CompletionChart";
import RadarChart from "@/components/analytics/charts/RadarChart";
import MomentumChart from "@/components/analytics/charts/MomentumChart";

export default function ExpandedAnalyticsChart({ vm }) {
    const {
        expandedChartId,
        setExpandedChartId,
        chartMetaById,
        handleDownloadChartData,

        weeklyData,
        categoryPieData,
        loadTrendData,
        completionData,
        radarData,

        labels,
        sortedPeople,
        personColorMap,
        getDisplayNameFromUsername,

        SERIES_COLORS,
    } = vm;

    const expandedMeta = expandedChartId ? chartMetaById.get(expandedChartId) : null;

    // hooks always run (safe), even if open=false
    const body = useMemo(() => {
        if (!expandedChartId) return null;

        if (expandedChartId === "distribution") {
            return (
                <DistributionChart
                    data={weeklyData}
                    meta={chartMetaById.get("distribution")}
                    sortedPeople={sortedPeople}
                    labels={labels}
                    personColorMap={personColorMap}
                    getDisplayNameFromUsername={getDisplayNameFromUsername}
                    height={360}
                />
            );
        }

        if (expandedChartId === "category") {
            return (
                <CategoryChart
                    data={categoryPieData}
                    meta={chartMetaById.get("category")}
                    seriesColors={SERIES_COLORS}
                    height={360}
                    innerRadius={70}
                    outerRadius={110}
                    legendLayout="wrap"
                />
            );
        }

        if (expandedChartId === "load-trend") {
            return (
                <LoadTrendChart
                    data={loadTrendData}
                    meta={chartMetaById.get("load-trend")}
                    height={360}
                />
            );
        }

        if (expandedChartId === "completion") {
            return (
                <CompletionChart
                    data={completionData}
                    meta={chartMetaById.get("completion")}
                    height={360}
                    legendLayout="grid"
                />
            );
        }

        if (expandedChartId === "radar") {
            return (
                <RadarChart
                    data={radarData}
                    meta={chartMetaById.get("radar")}
                    sortedPeople={sortedPeople}
                    labels={labels}
                    personColorMap={personColorMap}
                    getDisplayNameFromUsername={getDisplayNameFromUsername}
                    height={360}
                    outerRadius="70%"
                    cy="48%"
                    legendLayout="grid"
                />
            );
        }

        if (expandedChartId === "momentum") {
            return (
                <MomentumChart
                    data={completionData}
                    meta={chartMetaById.get("momentum")}
                    height={360}
                />
            );
        }

        return null;
    }, [
        expandedChartId,
        weeklyData,
        categoryPieData,
        loadTrendData,
        completionData,
        radarData,
        chartMetaById,
        sortedPeople,
        labels,
        personColorMap,
        getDisplayNameFromUsername,
        SERIES_COLORS,
    ]);

    return (
        <ExpandedChartDialog
            open={!!expandedChartId}
            title={expandedMeta?.title || "Chart"}
            desc={expandedMeta?.desc}
            onClose={() => setExpandedChartId(null)}
            onDownload={() => expandedChartId && handleDownloadChartData(expandedChartId)}
        >
            {body}
        </ExpandedChartDialog>
    );
}
