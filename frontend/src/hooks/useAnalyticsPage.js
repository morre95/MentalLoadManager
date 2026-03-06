// src/hooks/useAnalyticsPage.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHousehold } from "@/hooks/useHouseHold";
import { fetchAnalyticsSummary } from "../../../shared";
import {
    getDisplayNameFromUsername,
    apiClient
} from "@/lib/utils";

import { CHARTS, DEFAULT_ACTIVE_CHART_IDS, TIMEFRAME_OPTIONS } from "@/lib/analytics_constants";
import { downloadTextFile, formatPct, safeNumber, toCsv } from "@/lib/analytics_utils";

export function useAnalyticsPage() {
    // data
    const [weeklyData, setWeeklyData] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [loadTrendData, setLoadTrendData] = useState([]);
    const [completionData, setCompletionData] = useState([]);
    const [radarData, setRadarData] = useState([]);
    const [stats, setStats] = useState([]);
    const [people, setPeople] = useState([]);
    const [labels, setLabels] = useState({});

    // state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const [noHousehold, setNoHousehold] = useState(false);

    // UI
    const [activeChartIds, setActiveChartIds] = useState(DEFAULT_ACTIVE_CHART_IDS);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [expandedChartId, setExpandedChartId] = useState(null);

    const { households } = useHousehold();
    const [timeframe, setTimeframe] = useState("30d");

    const [selectedHouseholdId, setSelectedHouseholdId] = useState(() => {
        try {
            const raw = localStorage.getItem("household");
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const householdId = parsed && (parsed.household_id ?? parsed.id ?? parsed);
            return householdId ? String(householdId) : null;
        } catch {
            return null;
        }
    });

    const SERIES_COLORS = useMemo(
        () => [
            "hsl(var(--sage))",
            "hsl(var(--terracotta))",
            "hsl(var(--sky))",
            "hsl(var(--lavender))",
            "hsl(var(--sand))",
            "hsl(var(--status-todo))",
            "hsl(var(--status-doing))",
            "hsl(var(--status-done))",
            "hsl(var(--primary))",
        ],
        []
    );

    const sortedPeople = useMemo(
        () => [...(people || [])].sort((a, b) => a.localeCompare(b)),
        [people]
    );

    const personColorMap = useMemo(() => {
        const acc = {};
        sortedPeople.forEach((person, idx) => {
            acc[person] = SERIES_COLORS[idx % SERIES_COLORS.length];
        });
        return acc;
    }, [sortedPeople, SERIES_COLORS]);

    const chartMetaById = useMemo(() => {
        const m = new Map();
        CHARTS.forEach((c) => m.set(c.id, c));
        return m;
    }, []);

    const selectedHouseholdName = useMemo(() => {
        const h = (households || []).find(
            (x) => String(x.household_id) === String(selectedHouseholdId)
        );
        return (h && h.name) || "Household";
    }, [households, selectedHouseholdId]);

    const timeframeLabel = useMemo(() => {
        const opt = TIMEFRAME_OPTIONS.find((x) => x.id === timeframe);
        return (opt && opt.label) || timeframe;
    }, [timeframe]);

    const load = useCallback(
        async (tf = timeframe) => {
            setLoading(true);
            setError(null);
            setNoHousehold(false);

            try {
                const summary = await fetchAnalyticsSummary(apiClient, selectedHouseholdId, tf);

                setPeople(summary.people || []);
                setWeeklyData(summary.weeklyData || []);
                setCategoryData(summary.categoryData || []);
                setLoadTrendData(summary.loadTrendData || []);
                setCompletionData(summary.completionData || []);
                setRadarData(summary.radarData || []);
                setStats(summary.stats || []);
                setLabels(summary.labels || {});
                setLastUpdatedAt(new Date());
            } catch (err) {
                const msg = (err && err.message) || "";
                if (msg.toLowerCase().includes("not in a household")) {
                    setNoHousehold(true);
                    setError(null);
                    return;
                }
                console.error(err);
                setError(err);
            } finally {
                setLoading(false);
            }
        },
        [ selectedHouseholdId, timeframe]
    );

    // initial load + on changes
    useEffect(() => {
        if (!selectedHouseholdId) return;
        load(timeframe);
    }, [load, timeframe, selectedHouseholdId]);

    // default household
    useEffect(() => {
        if (!Array.isArray(households) || households.length === 0) return;
        if (!selectedHouseholdId) setSelectedHouseholdId(String(households[0].household_id));
    }, [households, selectedHouseholdId]);

    // persist household
    useEffect(() => {
        if (!selectedHouseholdId) return;
        const selected = (households || []).find(
            (h) => String(h.household_id) === String(selectedHouseholdId)
        );
        if (!selected) return;
        localStorage.setItem("household", JSON.stringify(selected));
    }, [selectedHouseholdId, households]);

    // guard: ensure selected exists
    useEffect(() => {
        if (!selectedHouseholdId) return;
        if (!Array.isArray(households) || households.length === 0) return;

        const exists = households.some((h) => String(h.household_id) === String(selectedHouseholdId));
        if (!exists) setSelectedHouseholdId(String(households[0].household_id));
    }, [selectedHouseholdId, households]);

    const handleToggleChart = useCallback((id) => {
        setActiveChartIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
    }, []);

    const categoryPieData = useMemo(() => {
        const list = Array.isArray(categoryData) ? [...categoryData] : [];
        const cleaned = list
            .map((x) => ({
                ...x,
                value: safeNumber(x && x.value) ?? 0,
                name: (x && x.name) || "Unknown",
            }))
            .filter((x) => x.value > 0);

        cleaned.sort((a, b) => b.value - a.value);

        const top = cleaned.slice(0, 6);
        const rest = cleaned.slice(6);
        const otherValue = rest.reduce((sum, x) => sum + (x.value || 0), 0);

        if (otherValue > 0) {
            top.push({
                name: "Other",
                value: otherValue,
                color: "hsl(var(--muted-foreground))",
                _isOther: true,
            });
        }
        return top;
    }, [categoryData]);

    const topCategory = useMemo(() => {
        if (!categoryPieData || categoryPieData.length === 0) return null;
        const top = [...categoryPieData]
            .filter((x) => !x._isOther)
            .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
        if (!top) return null;
        return { name: top.name, value: top.value };
    }, [categoryPieData]);

    const handleDownloadChartData = useCallback(
        (chartId) => {
            const tf = timeframeLabel.replace(/\s+/g, "-").toLowerCase();
            const hh = (selectedHouseholdName || "household").replace(/\s+/g, "-").toLowerCase();
            const filename = `analytics-${chartId}-${hh}-${tf}.csv`;

            let rows = [];
            if (chartId === "distribution") rows = weeklyData || [];
            if (chartId === "category") rows = categoryData || [];
            if (chartId === "load-trend") rows = loadTrendData || [];
            if (chartId === "completion") rows = completionData || [];
            if (chartId === "radar") rows = radarData || [];
            if (chartId === "momentum") {
                rows = (completionData || []).slice(-7).map((point) => {
                    const completed = safeNumber(point && point.completed) ?? 0;
                    const pending = safeNumber(point && point.pending) ?? 0;
                    const total = completed + pending;
                    const completionRate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
                    return {
                        day: (point && point.day) || "Day",
                        completed,
                        pending,
                        total,
                        completionRate,
                    };
                });
            }

            const csv = toCsv(rows);
            if (!csv) {
                downloadTextFile(filename, "No data", "text/plain");
                return;
            }
            downloadTextFile(filename, csv, "text/csv");
        },
        [timeframeLabel, selectedHouseholdName, weeklyData, categoryData, loadTrendData, completionData, radarData]
    );

    const enrichedStats = useMemo(() => {
        const list = Array.isArray(stats) ? stats : [];
        return list.map((s) => {
            const current = s?.value;
            const prev = s?.previousValue ?? s?.prevValue ?? s?.previous;

            const c = safeNumber(current);
            const p = safeNumber(prev);

            let changeText = null;
            let trend = "flat";

            if (c !== null && p !== null) {
                if (p === 0 && c > 0) {
                    changeText = "New";
                    trend = "up";
                } else if (p === 0 && c === 0) {
                    changeText = null;
                    trend = "flat";
                } else {
                    const pct = ((c - p) / p) * 100;
                    changeText = formatPct(pct);
                    trend = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
                }
            }

            return { ...s, _current: c, _previous: p, _changeText: changeText, _trend: trend };
        });
    }, [stats]);

    return {
        // raw state/data
        households,
        loading,
        error,
        noHousehold,
        lastUpdatedAt,
        setLastUpdatedAt,

        timeframe,
        setTimeframe,
        timeframeLabel,

        selectedHouseholdId,
        setSelectedHouseholdId,
        selectedHouseholdName,

        // data
        weeklyData,
        categoryData,
        categoryPieData,
        loadTrendData,
        completionData,
        radarData,
        labels,
        people,
        sortedPeople,
        personColorMap,

        // charts meta/ui
        charts: CHARTS,
        chartMetaById,
        activeChartIds,
        isManageOpen,
        setIsManageOpen,
        expandedChartId,
        setExpandedChartId,

        // derived
        enrichedStats,
        topCategory,

        // actions
        load,
        handleToggleChart,
        handleDownloadChartData,

        // helpers
        getDisplayNameFromUsername,
        SERIES_COLORS,
        timeframeOptions: TIMEFRAME_OPTIONS,
    };
}
