export function normalizeAnalyticsSummary(data) {
    return {
        household_id: data.household_id,
        people: data.people || [],
        labels: data.labels || {},

        // Convert weekly format → recharts format
        weeklyData: (data.weeklyData || []).map((row) => ({
            week: row.week,
            ...row.values,
        })),

        categoryData: data.categoryData || [],
        loadTrendData: data.loadTrendData || [],
        completionData: data.completionData || [],

        radarData: (data.radarData || []).map((row) => ({
            category: row.category,
            ...row.values,
        })),

        stats: data.stats || [],
    };
}

export async function fetchAnalyticsSummary(apiClient, householdId = null) {
    const query = householdId ? `?household_id=${householdId}` : "";

    const data = await apiClient.request(`/api/analytics/summary${query}`, {
        method: "GET",
    });

    return normalizeAnalyticsSummary(data);
}
