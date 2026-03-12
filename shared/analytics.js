// shared/analytics.js

export function normalizeAnalyticsSummary(data) {
    const CHART_LOCALE = "en-US";

    const formatMonth = (yyyyMm) => {
        if (!yyyyMm) return "";
        const d = new Date(`${yyyyMm}-01T00:00:00`);
        return d.toLocaleString(CHART_LOCALE, { month: "short" });
    };

    const formatWeekday = (yyyyMmDd) => {
        if (!yyyyMmDd) return "";
        const d = new Date(`${yyyyMmDd}T00:00:00`);
        return d.toLocaleString(CHART_LOCALE, { weekday: "short" });
    };

    const safeArray = (x) => (Array.isArray(x) ? x : []);

    return {
        household_id: data?.household_id ?? null,
        people: data?.people || [],
        labels: data?.labels || {},

        weeklyData: safeArray(data?.weeklyData).map((row) => ({
            week: row?.week ?? "",
            ...(row?.values || {}),
        })),

        categoryData: safeArray(data?.categoryData),

        loadTrendData: safeArray(data?.loadTrendData).map((row) => ({
            month: formatMonth(row?.month),
            _monthKey: row?.month ?? "",
            load: row?.load ?? 0,
        })),

        completionData: safeArray(data?.completionData).map((row) => ({
            day: formatWeekday(row?.day),
            _dayKey: row?.day ?? "",
            completed: row?.completed ?? 0,
            pending: row?.pending ?? 0,
        })),

        radarData: safeArray(data?.radarData).map((row) => ({
            category: row?.category ?? "Unknown",
            ...(row?.values || {}),
        })),

        stats: safeArray(data?.stats).map((s) => ({
            ...s,
            previousValue: s?.previousValue ?? s?.prevValue ?? s?.previous ?? null,
            description: s?.description ?? null,
            compareLabel: s?.compareLabel ?? s?.compare ?? null,
        })),
    };
}


export function normalizeAnalyticsAIInsights(data) {
    const safeArray = (x) => (Array.isArray(x) ? x : []);

    return {
        household_id: data?.household_id ?? null,
        timeframe: data?.timeframe ?? "30d",
        generated_at: data?.generated_at ?? null,
        summary: data?.summary ?? "",
        risks: safeArray(data?.risks).map((item) => ({
            title: item?.title ?? "",
            severity: item?.severity ?? "low",
            reason: item?.reason ?? "",
        })),
        recommendations: safeArray(data?.recommendations).map((item) => ({
            title: item?.title ?? "",
            action: item?.action ?? "",
            priority: item?.priority ?? "low",
        })),
        evidence: safeArray(data?.evidence).map((item) => String(item ?? "")),
        confidence: data?.confidence ?? "low",
        cached: Boolean(data?.cached),
        model: data?.model ?? null,
    };
}


export async function fetchAnalyticsSummary(
    apiClient,
    householdId = null,
    timeframe = "30d"
) {
    const params = new URLSearchParams();

    if (householdId) params.set("household_id", householdId);
    if (timeframe) params.set("timeframe", timeframe);

    const query = params.toString() ? `?${params.toString()}` : "";

    const data = await apiClient.request(
        `/api/analytics/summary${query}`,
        { method: "GET" }
    );

    return normalizeAnalyticsSummary(data);
}


export async function fetchAnalyticsAIInsights(
    apiClient,
    {
        householdId = null,
        timeframe = "30d",
        refresh = false,
    } = {}
) {
    const data = await apiClient.request("/api/analytics/ai-insights", {
        method: "POST",
        body: JSON.stringify({
            household_id: householdId,
            timeframe,
            refresh,
        }),
    });

    return normalizeAnalyticsAIInsights(data);
}
