import { motion } from "framer-motion";
import { BarChart3, RefreshCcw, Plus, Info, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from "@/components/ui/select";

import StatePill from "@/components/analytics/StatePill";
import { formatRelativeTime } from "@/lib/analytics_utils";

export default function AnalyticsHeader({ vm }) {
    const {
        households,
        loading,
        lastUpdatedAt,

        timeframe,
        setTimeframe,
        timeframeLabel,
        timeframeOptions,

        selectedHouseholdId,
        setSelectedHouseholdId,
        selectedHouseholdName,

        topCategory,

        load,
        handleDownloadMonthlySummary,
        setIsManageOpen,
        setLastUpdatedAt,
    } = vm;

    return (
        <motion.div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-primary" />
                    Analytics
                </h1>

                {/* Household + timeframe */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="w-[260px]">
                        <p className="text-xs text-muted-foreground mb-1">Household view</p>

                        <Select
                            value={selectedHouseholdId || ""}
                            onValueChange={(val) => {
                                setSelectedHouseholdId(val);
                                setLastUpdatedAt?.(null);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select household" />
                            </SelectTrigger>

                            <SelectContent>
                                {(households || []).map((h) => (
                                    <SelectItem key={h.household_id} value={String(h.household_id)}>
                                        {h.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Timeframe</p>
                        <div className="flex items-center gap-2 rounded-md border bg-card p-1 w-fit">
                            {timeframeOptions.map((opt) => (
                                <Button
                                    key={opt.id}
                                    type="button"
                                    size="sm"
                                    className="h-8"
                                    variant={timeframe === opt.id ? "default" : "ghost"}
                                    onClick={() => setTimeframe(opt.id)}
                                    disabled={loading}
                                    aria-pressed={timeframe === opt.id}
                                >
                                    {opt.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* State bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <StatePill title="Current household">
                        <Info className="h-3.5 w-3.5" />
                        {selectedHouseholdName}
                    </StatePill>

                    <StatePill title="Selected timeframe">{timeframeLabel}</StatePill>

                    {lastUpdatedAt ? (
                        <StatePill title={lastUpdatedAt.toLocaleString()}>
                            {formatRelativeTime(lastUpdatedAt)}
                        </StatePill>
                    ) : null}

                    {topCategory ? (
                        <StatePill title="Top category in the current timeframe">
                            Top: <span className="text-foreground">{topCategory.name}</span>
                        </StatePill>
                    ) : null}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleDownloadMonthlySummary}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Export Summary
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => load(timeframe, { refreshAi: true })}
                    disabled={loading}
                    title="Refresh analytics"
                    aria-label="Refresh analytics"
                >
                    <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>

                <Button onClick={() => setIsManageOpen(true)} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Charts
                </Button>
            </div>
        </motion.div>
    );
}
