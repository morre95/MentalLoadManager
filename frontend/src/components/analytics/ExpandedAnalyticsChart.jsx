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

        filteredWeeklyData,
        filteredCategoryPieData,
        filteredLoadTrendData,
        filteredCompletionData,
        filteredRadarData,

        labels,
        filteredPeople,
        personColorMap,
        getDisplayNameFromUsername,
        handleChartPointSelect,

        SERIES_COLORS,
    } = vm;

    const expandedMeta = expandedChartId ? chartMetaById.get(expandedChartId) : null;

    // hooks always run (safe), even if open=false
    const body = useMemo(() => {
        if (!expandedChartId) return null;

        if (expandedChartId === "distribution") {
            return (
                <DistributionChart
                    data={filteredWeeklyData}
                    meta={chartMetaById.get("distribution")}
                    sortedPeople={filteredPeople}
                    labels={labels}
                    personColorMap={personColorMap}
                    getDisplayNameFromUsername={getDisplayNameFromUsername}
                    height={360}
                    onPointSelect={(point) => handleChartPointSelect("distribution", point)}
                />
            );
        }

        if (expandedChartId === "category") {
            return (
                <CategoryChart
                    data={filteredCategoryPieData}
                    meta={chartMetaById.get("category")}
                    seriesColors={SERIES_COLORS}
                    height={360}
                    innerRadius={70}
                    outerRadius={110}
                    legendLayout="wrap"
                    onPointSelect={(point) => handleChartPointSelect("category", point)}
                />
            );
        }

        if (expandedChartId === "load-trend") {
            return (
                <LoadTrendChart
                    data={filteredLoadTrendData}
                    meta={chartMetaById.get("load-trend")}
                    height={360}
                    onPointSelect={(point) => handleChartPointSelect("load-trend", point)}
                />
            );
        }

        if (expandedChartId === "completion") {
            return (
                <CompletionChart
                    data={filteredCompletionData}
                    meta={chartMetaById.get("completion")}
                    height={360}
                    legendLayout="grid"
                    onPointSelect={(point) => handleChartPointSelect("completion", point)}
                />
            );
        }

        if (expandedChartId === "radar") {
            return (
                <RadarChart
                    data={filteredRadarData}
                    meta={chartMetaById.get("radar")}
                    sortedPeople={filteredPeople}
                    labels={labels}
                    personColorMap={personColorMap}
                    getDisplayNameFromUsername={getDisplayNameFromUsername}
                    height={360}
                    outerRadius="70%"
                    cy="48%"
                    legendLayout="grid"
                    onPointSelect={(point) => handleChartPointSelect("radar", point)}
                />
            );
        }

        if (expandedChartId === "momentum") {
            return (
                <MomentumChart
                    data={filteredCompletionData}
                    meta={chartMetaById.get("momentum")}
                    height={360}
                    onPointSelect={(point) => handleChartPointSelect("momentum", point)}
                />
            );
        }

        return null;
    }, [
        expandedChartId,
        filteredWeeklyData,
        filteredCategoryPieData,
        filteredLoadTrendData,
        filteredCompletionData,
        filteredRadarData,
        chartMetaById,
        filteredPeople,
        labels,
        personColorMap,
        getDisplayNameFromUsername,
        SERIES_COLORS,
        handleChartPointSelect,
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
