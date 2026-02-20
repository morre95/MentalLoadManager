export function normalizeAnalyticsSummary(data) {
    const formatMonth = (yyyyMm) => {
        if (!yyyyMm) return "";
        const d = new Date(`${yyyyMm}-01T00:00:00`);
        return d.toLocaleString(undefined, { month: "short" }); // Jan, Feb
    };

    const formatWeekday = (yyyyMmDd) => {
        if (!yyyyMmDd) return "";
        const d = new Date(`${yyyyMmDd}T00:00:00`);
        return d.toLocaleString(undefined, { weekday: "short" }); // Mon, Tue
    };

    return {
        household_id: data.household_id,
        people: data.people || [],
        labels: data.labels || {},

        // Weekly (already ISO week, leave as-is)
        weeklyData: (data.weeklyData || []).map((row) => ({
            week: row.week,
            ...row.values,
        })),

        categoryData: data.categoryData || [],

        // Month key → formatted label
        loadTrendData: (data.loadTrendData || []).map((row) => ({
            month: formatMonth(row.month),
            _monthKey: row.month, // keep raw if needed later
            load: row.load,
        })),

        // Day key → weekday label
        completionData: (data.completionData || []).map((row) => ({
            day: formatWeekday(row.day),
            _dayKey: row.day, // keep raw if needed later
            completed: row.completed,
            pending: row.pending,
        })),

        radarData: (data.radarData || []).map((row) => ({
            category: row.category,
            ...row.values,
        })),

        stats: data.stats || [],
    };
}


export async function fetchAnalyticsSummary(apiClient, householdId = null, timeframe = "30d") {
    const params = new URLSearchParams();
    if (householdId) params.set("household_id", householdId);
    if (timeframe) params.set("timeframe", timeframe);

    const query = params.toString() ? `?${params.toString()}` : "";

    const data = await apiClient.request(`/api/analytics/summary${query}`, {
        method: "GET",
    });

    return normalizeAnalyticsSummary(data);
}

