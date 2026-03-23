import DistributionChart from "@/components/analytics/charts/DistributionChart";
import CategoryChart from "@/components/analytics/charts/CategoryChart";
import LoadTrendChart from "@/components/analytics/charts/LoadTrendChart";
import CompletionChart from "@/components/analytics/charts/CompletionChart";
import RadarChart from "@/components/analytics/charts/RadarChart";
import MomentumChart from "@/components/analytics/charts/MomentumChart";
import {
  AnalyticsChartWidget,
} from "@/components/dashboard/home-grid/DashboardWidgets";
import {
  ANALYTICS_CHART_META,
  ANALYTICS_SERIES_COLORS,
} from "@/components/dashboard/home-grid/helpers";
import { getDisplayNameFromUsername } from "@/lib/utils";

export function buildAnalyticsChartWidgets(analyticsState) {
  const personColorMap = analyticsState.people.reduce((acc, person, index) => {
    acc[person] = ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length];
    return acc;
  }, {});

  return [
    {
      id: "analytics-chart-distribution",
      title: "Task Distribution by Person",
      description: "Analytics chart",
      size: "large",
      defaultVisible: true,
      render: () => (
        <AnalyticsChartWidget
          title="Task Distribution by Person"
          description="Shows how tasks are split across people week by week."
          chart={(
            <DistributionChart
              data={analyticsState.weeklyData}
              meta={ANALYTICS_CHART_META.distribution}
              sortedPeople={analyticsState.people}
              labels={analyticsState.labels}
              personColorMap={personColorMap}
              getDisplayNameFromUsername={getDisplayNameFromUsername}
              height={220}
            />
          )}
        />
      ),
    },
    {
      id: "analytics-chart-category",
      title: "Tasks by Category",
      description: "Analytics chart",
      size: "medium",
      defaultVisible: true,
      render: () => (
        <AnalyticsChartWidget
          title="Tasks by Category"
          description="Shows which categories account for most of the workload."
          chart={(
            <CategoryChart
              data={analyticsState.categoryData}
              meta={ANALYTICS_CHART_META.category}
              seriesColors={ANALYTICS_SERIES_COLORS}
              height={220}
              innerRadius={44}
              outerRadius={72}
            />
          )}
        />
      ),
    },
    {
      id: "analytics-chart-load-trend",
      title: "Mental Load Trend",
      description: "Analytics chart",
      size: "medium",
      defaultVisible: true,
      render: () => (
        <AnalyticsChartWidget
          title="Mental Load Trend"
          description="Shows how mental load changes month to month."
          chart={(
            <LoadTrendChart
              data={analyticsState.loadTrendData}
              meta={ANALYTICS_CHART_META["load-trend"]}
              height={220}
            />
          )}
        />
      ),
    },
    {
      id: "analytics-chart-completion",
      title: "Daily Completion Rate",
      description: "Analytics chart",
      size: "medium",
      defaultVisible: true,
      render: () => (
        <AnalyticsChartWidget
          title="Daily Completion Rate"
          description="Shows completed and pending tasks for each day."
          chart={(
            <CompletionChart
              data={analyticsState.completionData}
              meta={ANALYTICS_CHART_META.completion}
              height={220}
              legendLayout="wrap"
            />
          )}
        />
      ),
    },
    {
      id: "analytics-chart-radar",
      title: "Category Expertise",
      description: "Analytics chart",
      size: "medium",
      defaultVisible: false,
      render: () => (
        <AnalyticsChartWidget
          title="Category Expertise"
          description="Compares who contributes most in each category."
          chart={(
            <RadarChart
              data={analyticsState.radarData}
              meta={ANALYTICS_CHART_META.radar}
              sortedPeople={analyticsState.people}
              labels={analyticsState.labels}
              personColorMap={personColorMap}
              getDisplayNameFromUsername={getDisplayNameFromUsername}
              height={220}
              outerRadius="60%"
              cy="42%"
            />
          )}
        />
      ),
    },
    {
      id: "analytics-chart-momentum",
      title: "Completion Momentum",
      description: "Analytics chart",
      size: "medium",
      defaultVisible: false,
      render: () => (
        <AnalyticsChartWidget
          title="Completion Momentum"
          description="Shows how steady task completion has been over time."
          chart={(
            <MomentumChart
              data={analyticsState.completionData}
              meta={ANALYTICS_CHART_META.momentum}
              height={220}
            />
          )}
        />
      ),
    },
  ];
}
