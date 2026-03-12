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
            <AnalyticsInsightsPanel vm={vm} />
            <AnalyticsAskPanel vm={vm} />
            <AnalyticsFiltersBar vm={vm} />
            <AnalyticsChartsGrid vm={vm} />
            <AnalyticsFairnessCard vm={vm} />

            <ManageChartsDialog
                open={vm.isManageOpen}
                onOpenChange={vm.setIsManageOpen}
                charts={vm.charts}
                activeChartIds={vm.activeChartIds}
                onToggle={vm.handleToggleChart}
            />

            <ExpandedAnalyticsChart vm={vm} />
            <AnalyticsDrilldownDialog vm={vm} />
        </div>
    );
}
