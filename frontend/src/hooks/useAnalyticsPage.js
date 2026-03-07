// src/hooks/useAnalyticsPage.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHousehold } from "@/hooks/useHouseHold";
import { fetchAnalyticsSummary } from "../../../shared";
import { getDisplayNameFromUsername, apiClient } from "@/lib/utils";

import { CHARTS, DEFAULT_ACTIVE_CHART_IDS, TIMEFRAME_OPTIONS } from "@/lib/analytics_constants";
import { downloadTextFile, formatPct, safeNumber, toCsv } from "@/lib/analytics_utils";

function sumNumericValues(row, skipKeys = ["week", "day", "month", "category", "_dayKey", "_monthKey"]) {
    return Object.entries(row || {}).reduce((sum, [k, v]) => {
        if (skipKeys.includes(k)) return sum;
        const n = safeNumber(v);
        return sum + (n ?? 0);
    }, 0);
}

function splitPeriodTotals(points = [], getValue = (x) => x) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const mid = Math.floor(points.length / 2);
    const prev = points.slice(0, mid).reduce((acc, p) => acc + getValue(p), 0);
    const curr = points.slice(mid).reduce((acc, p) => acc + getValue(p), 0);
    return { prev, curr };
}

function buildDeltaText(curr, prev, noun = "activity") {
    if (prev === null || prev === undefined) return null;
    if (prev === 0 && curr > 0) return `New ${noun} vs previous period`;
    if (prev === 0 && curr === 0) return null;

    const pct = ((curr - prev) / prev) * 100;
    if (!Number.isFinite(pct)) return null;
    if (Math.abs(pct) < 1) return `${noun} is steady vs previous period`;
    return `${formatPct(pct)} vs previous period`;
}

function buildCompletionRates(data = []) {
    return (Array.isArray(data) ? data : []).map((point) => {
        const completed = safeNumber(point?.completed) ?? 0;
        const pending = safeNumber(point?.pending) ?? 0;
        const total = completed + pending;
        return {
            ...point,
            total,
            completionRate: total > 0 ? (completed / total) * 100 : 0,
        };
    });
}

function getStatNumber(stats = [], title = "") {
    const stat = (stats || []).find((s) => String(s?.title || "").toLowerCase() === title.toLowerCase());
    return safeNumber(stat?.value);
}

export function useAnalyticsPage() {
    const [weeklyData, setWeeklyData] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [loadTrendData, setLoadTrendData] = useState([]);
    const [completionData, setCompletionData] = useState([]);
    const [radarData, setRadarData] = useState([]);
    const [stats, setStats] = useState([]);
    const [people, setPeople] = useState([]);
    const [labels, setLabels] = useState({});

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const [noHousehold, setNoHousehold] = useState(false);

    const [activeChartIds, setActiveChartIds] = useState(DEFAULT_ACTIVE_CHART_IDS);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [expandedChartId, setExpandedChartId] = useState(null);

    const [selectedPersonFilter, setSelectedPersonFilter] = useState("all");
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
    const [selectedTaskTypeFilter, setSelectedTaskTypeFilter] = useState("all");
    const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("all");

    const [drilldown, setDrilldown] = useState({ open: false, title: "", rows: [] });

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

    const sortedPeople = useMemo(() => [...(people || [])].sort((a, b) => a.localeCompare(b)), [people]);

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
        const h = (households || []).find((x) => String(x.household_id) === String(selectedHouseholdId));
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
        [selectedHouseholdId, timeframe]
    );

    useEffect(() => {
        if (!selectedHouseholdId) return;
        load(timeframe);
    }, [load, timeframe, selectedHouseholdId]);

    useEffect(() => {
        if (!Array.isArray(households) || households.length === 0) return;
        if (!selectedHouseholdId) setSelectedHouseholdId(String(households[0].household_id));
    }, [households, selectedHouseholdId]);

    useEffect(() => {
        if (!selectedHouseholdId) return;
        const selected = (households || []).find((h) => String(h.household_id) === String(selectedHouseholdId));
        if (!selected) return;
        localStorage.setItem("household", JSON.stringify(selected));
    }, [selectedHouseholdId, households]);

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

    const personFilterOptions = useMemo(
        () => [
            { value: "all", label: "All people" },
            ...sortedPeople.map((person) => ({
                value: person,
                label: getDisplayNameFromUsername(person, labels),
            })),
        ],
        [sortedPeople, labels]
    );

    const categoryFilterOptions = useMemo(() => {
        const names = [...new Set((categoryData || []).map((row) => row?.name).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b)
        );
        return [{ value: "all", label: "All categories" }, ...names.map((name) => ({ value: name, label: name }))];
    }, [categoryData]);

    const taskTypeFilterOptions = useMemo(
        () => [
            { value: "all", label: "All task types" },
            { value: "completed", label: "Completed only" },
            { value: "pending", label: "Pending only" },
        ],
        []
    );

    const priorityFilterOptions = useMemo(
        () => [
            { value: "all", label: "All priorities" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
        ],
        []
    );

    const filteredPeople = useMemo(() => {
        if (selectedPersonFilter === "all") return sortedPeople;
        return sortedPeople.includes(selectedPersonFilter) ? [selectedPersonFilter] : [];
    }, [selectedPersonFilter, sortedPeople]);

    const filteredWeeklyData = useMemo(() => {
        if (selectedPersonFilter === "all") return weeklyData;
        return (weeklyData || []).map((row) => ({
            week: row?.week,
            [selectedPersonFilter]: safeNumber(row?.[selectedPersonFilter]) ?? 0,
        }));
    }, [weeklyData, selectedPersonFilter]);

    const filteredCategoryPieData = useMemo(() => {
        if (selectedCategoryFilter === "all") return categoryPieData;
        return (categoryPieData || []).filter((x) => x?.name === selectedCategoryFilter);
    }, [categoryPieData, selectedCategoryFilter]);

    const filteredLoadTrendData = loadTrendData;

    const filteredCompletionData = useMemo(() => {
        if (selectedTaskTypeFilter === "all") return completionData;
        return (completionData || []).map((row) => ({
            ...row,
            completed: selectedTaskTypeFilter === "completed" ? row?.completed ?? 0 : 0,
            pending: selectedTaskTypeFilter === "pending" ? row?.pending ?? 0 : 0,
        }));
    }, [completionData, selectedTaskTypeFilter]);

    const filteredRadarData = useMemo(() => {
        const byCategory =
            selectedCategoryFilter === "all"
                ? radarData
                : (radarData || []).filter((row) => row?.category === selectedCategoryFilter);
        if (selectedPersonFilter === "all") return byCategory;
        return (byCategory || []).map((row) => ({
            category: row?.category,
            [selectedPersonFilter]: safeNumber(row?.[selectedPersonFilter]) ?? 0,
        }));
    }, [radarData, selectedCategoryFilter, selectedPersonFilter]);

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
                } else if (!(p === 0 && c === 0)) {
                    const pct = ((c - p) / p) * 100;
                    changeText = formatPct(pct);
                    trend = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
                }
            }
            return { ...s, _current: c, _previous: p, _changeText: changeText, _trend: trend };
        });
    }, [stats]);

    const chartChanges = useMemo(() => {
        const distributionSplit = splitPeriodTotals(filteredWeeklyData, (row) => sumNumericValues(row, ["week"]));
        const distributionDelta = distributionSplit
            ? buildDeltaText(distributionSplit.curr, distributionSplit.prev, "task volume")
            : null;

        const loadLast = safeNumber(filteredLoadTrendData?.[filteredLoadTrendData.length - 1]?.load);
        const loadPrev = safeNumber(filteredLoadTrendData?.[filteredLoadTrendData.length - 2]?.load);
        const loadDelta =
            loadLast !== null && loadPrev !== null ? `${loadLast - loadPrev > 0 ? "+" : ""}${loadLast - loadPrev} vs last month` : null;

        const completionRates = buildCompletionRates(filteredCompletionData);
        const completionSplit = splitPeriodTotals(completionRates, (row) => row.completionRate);
        const completionDelta = completionSplit
            ? buildDeltaText(
                completionSplit.curr / Math.max(1, Math.floor(completionRates.length / 2)),
                completionSplit.prev / Math.max(1, Math.floor(completionRates.length / 2)),
                "completion rate"
            )
            : null;

        const momentumPoints = buildCompletionRates(completionData).slice(-7);
        const latest = momentumPoints[momentumPoints.length - 1];
        const previousAvg =
            momentumPoints.length > 1
                ? momentumPoints.slice(0, -1).reduce((sum, p) => sum + p.completionRate, 0) / (momentumPoints.length - 1)
                : null;
        const momentumDelta = latest && previousAvg !== null ? `${formatPct(latest.completionRate - previousAvg)} vs recent average` : null;

        const categoryTotal = (filteredCategoryPieData || []).reduce((sum, row) => sum + (safeNumber(row?.value) ?? 0), 0);
        const top = [...(filteredCategoryPieData || [])].sort((a, b) => (b?.value || 0) - (a?.value || 0))[0];
        const categoryDelta = top && categoryTotal > 0 ? `${Math.round(((top.value || 0) / categoryTotal) * 100)}% from ${top.name}` : null;

        return {
            distribution: distributionDelta,
            category: categoryDelta,
            "load-trend": loadDelta,
            completion: completionDelta,
            radar:
                selectedCategoryFilter !== "all"
                    ? `Filtered to ${selectedCategoryFilter}`
                    : selectedPersonFilter !== "all"
                        ? `Filtered to ${getDisplayNameFromUsername(selectedPersonFilter, labels)}`
                        : null,
            momentum: momentumDelta,
        };
    }, [
        filteredWeeklyData,
        filteredLoadTrendData,
        filteredCompletionData,
        completionData,
        filteredCategoryPieData,
        selectedCategoryFilter,
        selectedPersonFilter,
        labels,
    ]);

    const personLoadRows = useMemo(() => {
        const totals = {};
        (sortedPeople || []).forEach((person) => {
            totals[person] = 0;
        });
        (weeklyData || []).forEach((row) => {
            (sortedPeople || []).forEach((person) => {
                totals[person] += safeNumber(row?.[person]) ?? 0;
            });
        });
        const entries = Object.entries(totals).map(([person, count]) => ({
            person,
            label: getDisplayNameFromUsername(person, labels),
            count,
        }));
        const total = entries.reduce((sum, row) => sum + row.count, 0);
        const fairShare = entries.length > 0 ? total / entries.length : 0;
        return entries
            .map((row) => ({
                ...row,
                sharePct: total > 0 ? (row.count / total) * 100 : 0,
                deltaFromFair: row.count - fairShare,
            }))
            .sort((a, b) => b.count - a.count);
    }, [weeklyData, sortedPeople, labels]);

    const insights = useMemo(() => {
        const cards = [];
        const topPerson = personLoadRows[0];
        if (topPerson && topPerson.count > 0) {
            cards.push({
                title: "Workload snapshot",
                text: `${topPerson.label} is handling ${Math.round(topPerson.sharePct)}% of assigned tasks in this timeframe.`,
            });
        }
        if (topCategory?.name && topCategory?.value) {
            cards.push({
                title: "Category focus",
                text: `${topCategory.name} is currently the biggest category by task volume.`,
            });
        }
        const rates = buildCompletionRates(completionData).slice(-7);
        if (rates.length > 1) {
            const avgRate = rates.reduce((sum, r) => sum + r.completionRate, 0) / rates.length;
            cards.push({
                title: "Completion pattern",
                text: `Average completion rate is ${Math.round(avgRate)}% over the latest ${rates.length} days.`,
            });
        }
        return cards.slice(0, 3);
    }, [personLoadRows, topCategory, completionData]);

    const forecast = useMemo(() => {
        const rates = buildCompletionRates(completionData).slice(-7);
        const overdue = getStatNumber(stats, "Overdue Tasks") ?? 0;
        if (rates.length < 3) {
            return { level: "neutral", title: "Forecast", text: "Not enough recent data to estimate next week yet." };
        }
        const first = rates[0].completionRate;
        const last = rates[rates.length - 1].completionRate;
        const slope = (last - first) / Math.max(1, rates.length - 1);
        if (overdue > 0 && last < 50 && slope <= 0) {
            return { level: "risk", title: "Risk warning", text: "At the current pace, overdue tasks may rise next week." };
        }
        if (slope > 1) {
            return { level: "good", title: "Forecast", text: "Completion pace is improving and should remain stable next week." };
        }
        return { level: "neutral", title: "Forecast", text: "Completion pace looks steady for next week." };
    }, [completionData, stats]);

    const suggestions = useMemo(() => {
        const list = [];
        const topPerson = personLoadRows[0];
        const secondPerson = personLoadRows[1];
        const loadBalance = getStatNumber(stats, "Load Balance Score");
        const overdue = getStatNumber(stats, "Overdue Tasks") ?? 0;
        if (topPerson && secondPerson && topPerson.sharePct >= 45) {
            list.push(`Shift one or two tasks from ${topPerson.label} to ${secondPerson.label} to improve balance.`);
        }
        if (overdue > 0) {
            list.push(`Prioritize the ${overdue} overdue task${overdue > 1 ? "s" : ""} to reduce backlog risk.`);
        }
        if ((loadBalance ?? 100) < 80) {
            list.push("Review open tasks by assignee and rebalance before adding new ones.");
        }
        if (selectedPriorityFilter !== "all") {
            list.push(`Priority filter is set to ${selectedPriorityFilter}; connect task priority data for deeper breakdowns.`);
        }
        return list.slice(0, 4);
    }, [personLoadRows, stats, selectedPriorityFilter]);

    const handleOpenDrilldown = useCallback((title, rows) => {
        setDrilldown({ open: true, title, rows: Array.isArray(rows) ? rows : [] });
    }, []);

    const handleCloseDrilldown = useCallback(() => {
        setDrilldown({ open: false, title: "", rows: [] });
    }, []);

    const handleChartPointSelect = useCallback(
        (chartId, point) => {
            if (!point) return;
            if (chartId === "distribution") {
                const values = point.values || {};
                const rows = Object.entries(values).map(([person, count]) => ({
                    person: getDisplayNameFromUsername(person, labels),
                    tasks: count,
                }));
                handleOpenDrilldown(`Task Distribution · ${point.week || "Week"}`, rows);
                return;
            }
            if (chartId === "category") {
                handleOpenDrilldown(`Category · ${point.name || "Category"}`, [{ category: point.name, tasks: point.value }]);
                return;
            }
            if (chartId === "load-trend") {
                handleOpenDrilldown(`Mental Load · ${point.month || "Month"}`, [{ month: point.month, load: point.load }]);
                return;
            }
            if (chartId === "completion") {
                handleOpenDrilldown(`Daily Completion · ${point.day || "Day"}`, [
                    { day: point.day, completed: point.completed, pending: point.pending },
                ]);
                return;
            }
            if (chartId === "momentum") {
                handleOpenDrilldown(`Completion Momentum · ${point.day || "Day"}`, [
                    {
                        day: point.day,
                        completionRate: point.completionRate,
                        completed: point.completed,
                        pending: point.pending,
                        total: point.total,
                    },
                ]);
                return;
            }
            if (chartId === "radar") {
                const values = point.values || {};
                const rows = Object.entries(values).map(([person, handled]) => ({
                    person: getDisplayNameFromUsername(person, labels),
                    handled,
                }));
                handleOpenDrilldown(`Category Expertise · ${point.category || "Category"}`, rows);
            }
        },
        [handleOpenDrilldown, labels]
    );

    const handleDownloadChartData = useCallback(
        (chartId) => {
            const tf = timeframeLabel.replace(/\s+/g, "-").toLowerCase();
            const hh = (selectedHouseholdName || "household").replace(/\s+/g, "-").toLowerCase();
            const filename = `analytics-${chartId}-${hh}-${tf}.csv`;
            let rows = [];
            if (chartId === "distribution") rows = filteredWeeklyData || [];
            if (chartId === "category") rows = filteredCategoryPieData || [];
            if (chartId === "load-trend") rows = filteredLoadTrendData || [];
            if (chartId === "completion") rows = filteredCompletionData || [];
            if (chartId === "radar") rows = filteredRadarData || [];
            if (chartId === "momentum") {
                rows = (completionData || []).slice(-7).map((point) => {
                    const completed = safeNumber(point && point.completed) ?? 0;
                    const pending = safeNumber(point && point.pending) ?? 0;
                    const total = completed + pending;
                    const completionRate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
                    return { day: (point && point.day) || "Day", completed, pending, total, completionRate };
                });
            }
            const csv = toCsv(rows);
            if (!csv) {
                downloadTextFile(filename, "No data", "text/plain");
                return;
            }
            downloadTextFile(filename, csv, "text/csv");
        },
        [
            timeframeLabel,
            selectedHouseholdName,
            filteredWeeklyData,
            filteredCategoryPieData,
            filteredLoadTrendData,
            filteredCompletionData,
            filteredRadarData,
            completionData,
        ]
    );

    const handleDownloadMonthlySummary = useCallback(() => {
        const now = new Date();
        const monthStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const hh = (selectedHouseholdName || "household").replace(/\s+/g, "-").toLowerCase();
        const filename = `analytics-summary-${hh}-${monthStamp}.md`;
        const lines = [
            `# Analytics Summary (${monthStamp})`,
            "",
            `Household: ${selectedHouseholdName}`,
            `Timeframe: ${timeframeLabel}`,
            `Filters: person=${selectedPersonFilter}, category=${selectedCategoryFilter}, taskType=${selectedTaskTypeFilter}, priority=${selectedPriorityFilter}`,
            "",
            "## Key Stats",
            ...(enrichedStats || []).slice(0, 4).map((s) => `- ${s.title}: ${s.value}`),
            "",
            "## Insights",
            ...(insights.length ? insights.map((i) => `- ${i.title}: ${i.text}`) : ["- No insights available for this timeframe."]),
            "",
            "## Forecast",
            `- ${forecast.text}`,
            "",
            "## Suggestions",
            ...(suggestions.length ? suggestions.map((s) => `- ${s}`) : ["- No suggestions right now."]),
            "",
            "## Chart Changes",
            ...Object.entries(chartChanges)
                .filter(([, text]) => !!text)
                .map(([key, text]) => `- ${key}: ${text}`),
        ];
        downloadTextFile(filename, lines.join("\n"), "text/markdown");
    }, [
        selectedHouseholdName,
        timeframeLabel,
        selectedPersonFilter,
        selectedCategoryFilter,
        selectedTaskTypeFilter,
        selectedPriorityFilter,
        enrichedStats,
        insights,
        forecast,
        suggestions,
        chartChanges,
    ]);

    return {
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
        filteredWeeklyData,
        filteredCategoryPieData,
        filteredLoadTrendData,
        filteredCompletionData,
        filteredRadarData,
        filteredPeople,
        charts: CHARTS,
        chartMetaById,
        activeChartIds,
        isManageOpen,
        setIsManageOpen,
        expandedChartId,
        setExpandedChartId,
        enrichedStats,
        topCategory,
        chartChanges,
        insights,
        suggestions,
        forecast,
        personLoadRows,
        selectedPersonFilter,
        setSelectedPersonFilter,
        selectedCategoryFilter,
        setSelectedCategoryFilter,
        selectedTaskTypeFilter,
        setSelectedTaskTypeFilter,
        selectedPriorityFilter,
        setSelectedPriorityFilter,
        personFilterOptions,
        categoryFilterOptions,
        taskTypeFilterOptions,
        priorityFilterOptions,
        drilldown,
        handleChartPointSelect,
        handleCloseDrilldown,
        load,
        handleToggleChart,
        handleDownloadChartData,
        handleDownloadMonthlySummary,
        getDisplayNameFromUsername,
        SERIES_COLORS,
        timeframeOptions: TIMEFRAME_OPTIONS,
    };
}
