// shared/calendar.js

export async function fetchCalendarMonth(apiClient, { year, month }) {
    // month: 1-12 (your backend expects 1-12)
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));

    return apiClient.get(`/api/calendar/events?${params.toString()}`);
}

export async function fetchCalendarRange(apiClient, { from, to }) {
    const params = new URLSearchParams();
    params.set("from", from); // YYYY-MM-DD
    params.set("to", to);     // YYYY-MM-DD

    return apiClient.get(`/api/calendar/events/range?${params.toString()}`);
}