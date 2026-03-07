import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import CardActions from "@/components/analytics/CardActions";

import DistributionChart from "@/components/analytics/charts/DistributionChart";
import CategoryChart from "@/components/analytics/charts/CategoryChart";
import LoadTrendChart from "@/components/analytics/charts/LoadTrendChart";
import CompletionChart from "@/components/analytics/charts/CompletionChart";
import RadarChart from "@/components/analytics/charts/RadarChart";
import MomentumChart from "@/components/analytics/charts/MomentumChart";

export default function AnalyticsChartsGrid({ vm }) {
    const {
        activeChartIds,
        chartMetaById,

        setExpandedChartId,
        handleDownloadChartData,
        handleToggleChart,

        filteredWeeklyData,
        filteredCategoryPieData,
        filteredLoadTrendData,
        filteredCompletionData,
        filteredRadarData,

        topCategory,
        chartChanges,

        labels,
        filteredPeople,
        personColorMap,
        getDisplayNameFromUsername,
        handleChartPointSelect,

        SERIES_COLORS,
    } = vm;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribution */}
            {activeChartIds.includes("distribution") && (
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle>Task Distribution by Person</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Shows how tasks are split across people week by week.
                            </p>
                            {chartChanges?.distribution ? (
                                <p className="text-xs text-muted-foreground">{chartChanges.distribution}</p>
                            ) : null}
                        </div>

                        <CardActions
                            chartId="distribution"
                            title="Task Distribution by Person"
                            onExpand={setExpandedChartId}
                            onDownload={handleDownloadChartData}
                            onHide={handleToggleChart}
                        />
                    </CardHeader>

                    <CardContent className="min-w-0">
                        <DistributionChart
                            data={filteredWeeklyData}
                            meta={chartMetaById.get("distribution")}
                            sortedPeople={filteredPeople}
                            labels={labels}
                            personColorMap={personColorMap}
                            getDisplayNameFromUsername={getDisplayNameFromUsername}
                            onPointSelect={(point) => handleChartPointSelect("distribution", point)}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Category */}
            {activeChartIds.includes("category") && (
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle>Tasks by Category</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Shows which categories account for most of the workload.
                                {topCategory ? (
                                    <>
                                        {" "}
                                        <span className="text-foreground font-medium">Largest: {topCategory.name}</span>
                                    </>
                                ) : null}
                            </p>
                            {chartChanges?.category ? (
                                <p className="text-xs text-muted-foreground">{chartChanges.category}</p>
                            ) : null}
                        </div>

                        <CardActions
                            chartId="category"
                            title="Tasks by Category"
                            onExpand={setExpandedChartId}
                            onDownload={handleDownloadChartData}
                            onHide={handleToggleChart}
                        />
                    </CardHeader>

                    <CardContent className="min-w-0">
                        <CategoryChart
                            data={filteredCategoryPieData}
                            meta={chartMetaById.get("category")}
                            seriesColors={SERIES_COLORS}
                            onPointSelect={(point) => handleChartPointSelect("category", point)}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Load trend */}
            {activeChartIds.includes("load-trend") && (
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle>Mental Load Trend</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Shows how mental load changes month to month.
                            </p>
                            {chartChanges?.["load-trend"] ? (
                                <p className="text-xs text-muted-foreground">{chartChanges["load-trend"]}</p>
                            ) : null}
                        </div>

                        <CardActions
                            chartId="load-trend"
                            title="Mental Load Trend"
                            onExpand={setExpandedChartId}
                            onDownload={handleDownloadChartData}
                            onHide={handleToggleChart}
                        />
                    </CardHeader>

                    <CardContent className="min-w-0">
                        <LoadTrendChart
                            data={filteredLoadTrendData}
                            meta={chartMetaById.get("load-trend")}
                            onPointSelect={(point) => handleChartPointSelect("load-trend", point)}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Completion */}
            {activeChartIds.includes("completion") && (
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle>Daily Completion Rate</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Shows completed and pending tasks for each day.
                            </p>
                            {chartChanges?.completion ? (
                                <p className="text-xs text-muted-foreground">{chartChanges.completion}</p>
                            ) : null}
                        </div>

                        <CardActions
                            chartId="completion"
                            title="Daily Completion Rate"
                            onExpand={setExpandedChartId}
                            onDownload={handleDownloadChartData}
                            onHide={handleToggleChart}
                        />
                    </CardHeader>

                    <CardContent className="min-w-0">
                        <CompletionChart
                            data={filteredCompletionData}
                            meta={chartMetaById.get("completion")}
                            onPointSelect={(point) => handleChartPointSelect("completion", point)}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Radar */}
            {activeChartIds.includes("radar") && (
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle>Category Expertise</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Compares who contributes most in each category.
                            </p>
                            {chartChanges?.radar ? (
                                <p className="text-xs text-muted-foreground">{chartChanges.radar}</p>
                            ) : null}
                        </div>

                        <CardActions
                            chartId="radar"
                            title="Category Expertise"
                            onExpand={setExpandedChartId}
                            onDownload={handleDownloadChartData}
                            onHide={handleToggleChart}
                        />
                    </CardHeader>

                    <CardContent className="min-w-0">
                        <RadarChart
                            data={filteredRadarData}
                            meta={chartMetaById.get("radar")}
                            sortedPeople={filteredPeople}
                            labels={labels}
                            personColorMap={personColorMap}
                            getDisplayNameFromUsername={getDisplayNameFromUsername}
                            onPointSelect={(point) => handleChartPointSelect("radar", point)}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Momentum */}
            {activeChartIds.includes("momentum") && (
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle>Completion Momentum</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Shows how steady task completion has been over time.
                            </p>
                            {chartChanges?.momentum ? (
                                <p className="text-xs text-muted-foreground">{chartChanges.momentum}</p>
                            ) : null}
                        </div>

                        <CardActions
                            chartId="momentum"
                            title="Completion Momentum"
                            onExpand={setExpandedChartId}
                            onDownload={handleDownloadChartData}
                            onHide={handleToggleChart}
                        />
                    </CardHeader>

                    <CardContent className="min-w-0">
                        <MomentumChart
                            data={filteredCompletionData}
                            meta={chartMetaById.get("momentum")}
                            onPointSelect={(point) => handleChartPointSelect("momentum", point)}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
