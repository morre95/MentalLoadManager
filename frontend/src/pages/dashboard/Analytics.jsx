import { useEffect, useState } from "react";

import { NoHouseholdState } from "@/components/ui/noHouseHoldState";
import { useAnalyticsPage } from "@/hooks/useAnalyticsPage";

import AnalyticsHeader from "@/components/analytics/AnalyticsHeader";
import AnalyticsFiltersBar from "@/components/analytics/AnalyticsFiltersBar";
import AnalyticsInsightsPanel from "@/components/analytics/AnalyticsInsightsPanel";
import AnalyticsFairnessCard from "@/components/analytics/AnalyticsFairnessCard";
import AnalyticsStatsGrid from "@/components/analytics/AnalyticsStatsGrid";
import AnalyticsChartsGrid from "@/components/analytics/AnalyticsChartsGrid";
import AnalyticsAskPanel from "@/components/analytics/AnalyticsAskPanel";
import ManageChartsDialog from "@/components/analytics/ManageChartsDialog";
import ExpandedAnalyticsChart from "@/components/analytics/ExpandedAnalyticsChart";
import AnalyticsDrilldownDialog from "@/components/analytics/AnalyticsDrilldownDialog";
import AnalyticsError from "@/components/analytics/AnalyticsError";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function Analytics() {
    const vm = useAnalyticsPage();

    // tick to update "Updated X min ago"
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    // Guard states
    if (!Array.isArray(vm.households) || vm.households.length === 0) {
        return <NoHouseholdState onRetry={vm.load} />;
    }

    if (vm.loading) return <div className="p-6 text-muted-foreground">Loading analytics…</div>;
    if (vm.noHousehold) return <NoHouseholdState onRetry={() => vm.load(vm.timeframe)} />;

    if (vm.error) {
        return <AnalyticsError error={vm.error} onRetry={() => vm.load(vm.timeframe)} />;
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <AnalyticsHeader vm={vm} />
            <AnalyticsStatsGrid stats={vm.enrichedStats} />
            <ErrorBoundary
                nonCritical={true}
                title="Insights Temporarily Unavailable"
                description="The analytics page is still usable, but the AI insights panel crashed."
            >
                <AnalyticsInsightsPanel vm={vm} />
            </ErrorBoundary>
            <ErrorBoundary
                nonCritical={true}
                title="Ask Panel Temporarily Unavailable"
                description="The analytics page is still usable, but the question panel crashed."
            >
                <AnalyticsAskPanel vm={vm} />
            </ErrorBoundary>
            <AnalyticsFiltersBar vm={vm} />
            <AnalyticsChartsGrid vm={vm} />
            <AnalyticsFairnessCard vm={vm} />

            <ErrorBoundary
                nonCritical={true}
                title="Chart Controls Temporarily Unavailable"
                description="Analytics loaded, but some optional chart controls failed."
            >
                <ManageChartsDialog
                    open={vm.isManageOpen}
                    onOpenChange={vm.setIsManageOpen}
                    charts={vm.charts}
                    activeChartIds={vm.activeChartIds}
                    onToggle={vm.handleToggleChart}
                />

                <ExpandedAnalyticsChart vm={vm} />
                <AnalyticsDrilldownDialog vm={vm} />
            </ErrorBoundary>
        </div>
    );
}
