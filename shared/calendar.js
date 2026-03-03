const safeArray = (x) => (Array.isArray(x) ? x : []);

export function normalizeCalendarMonth(data) {
    return {
        startDate: data?.startDate ?? null,
        today: data?.today ?? null,
        monthLabel: data?.monthLabel ?? "",
        events: safeArray(data?.events).map((e) => ({
            id: e?.id ?? "",
            date: e?.date ?? null, // YYYY-MM-DD
            title: e?.title ?? "",
            household_id: e?.household_id ?? null,
            household_name: e?.household_name ?? null,
            person: e?.person ?? null,
        })),
    };
}

export function normalizeCalendarRange(data) {
    return {
        fromDate: data?.fromDate ?? null,
        toDate: data?.toDate ?? null,
        today: data?.today ?? null,
        events: safeArray(data?.events).map((e) => ({
            id: e?.id ?? "",
            date: e?.date ?? null,
            title: e?.title ?? "",
            household_id: e?.household_id ?? null,
            household_name: e?.household_name ?? null,
            person: e?.person ?? null,
        })),
    };
}

export async function fetchCalendarMonth(apiClient, year = null, month = null) {
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));
    const query = params.toString() ? `?${params.toString()}` : "";

    const data = await apiClient.request(`/api/calendar/events${query}`, {
        method: "GET",
    });

    return normalizeCalendarMonth(data);
}

export async function fetchCalendarRange(apiClient, from, to) {
    const params = new URLSearchParams();
    params.set("from", from); // YYYY-MM-DD
    params.set("to", to);

    const query = `?${params.toString()}`;

    const data = await apiClient.request(`/api/calendar/events/range${query}`, {
        method: "GET",
    });

    return normalizeCalendarRange(data);
}