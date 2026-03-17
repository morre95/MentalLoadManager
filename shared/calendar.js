const safeArray = (x) => (Array.isArray(x) ? x : []);

function formatTaskRecurrence(frequency, interval = 1) {
    const normalizedFrequency = String(frequency || "").trim().toLowerCase();
    const normalizedInterval = Number(interval) > 0 ? Number(interval) : 1;
    if (!normalizedFrequency) return "";

    if (normalizedInterval === 1) {
        if (normalizedFrequency === "daily") return "Daily";
        if (normalizedFrequency === "weekly") return "Weekly";
        if (normalizedFrequency === "monthly") return "Monthly";
    }

    const unit =
        normalizedFrequency === "daily"
            ? "day"
            : normalizedFrequency === "weekly"
                ? "week"
                : "month";
    return `Every ${normalizedInterval} ${unit}${normalizedInterval === 1 ? "" : "s"}`;
}

export function normalizeCalendarMonth(data) {
    return {
        startDate: data?.startDate ?? null,
        today: data?.today ?? null,
        monthLabel: data?.monthLabel ?? "",
        events: safeArray(data?.events).map((e) => ({
            id: e?.id ?? "",
            task_id: e?.task_id ?? e?.id ?? "",
            date: e?.date ?? null, // YYYY-MM-DD
            title: e?.title ?? "",
            household_id: e?.household_id ?? null,
            household_name: e?.household_name ?? null,
            person: e?.person ?? null,
            recurrence_enabled: Boolean(e?.recurrence_enabled),
            recurrence_frequency: e?.recurrence_frequency ?? null,
            recurrence_interval: e?.recurrence_interval ?? null,
            recurrence_label: e?.recurrence_enabled
                ? formatTaskRecurrence(e?.recurrence_frequency, e?.recurrence_interval)
                : "",
            is_projected: Boolean(e?.is_projected),
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
            task_id: e?.task_id ?? e?.id ?? "",
            date: e?.date ?? null,
            title: e?.title ?? "",
            household_id: e?.household_id ?? null,
            household_name: e?.household_name ?? null,
            person: e?.person ?? null,
            recurrence_enabled: Boolean(e?.recurrence_enabled),
            recurrence_frequency: e?.recurrence_frequency ?? null,
            recurrence_interval: e?.recurrence_interval ?? null,
            recurrence_label: e?.recurrence_enabled
                ? formatTaskRecurrence(e?.recurrence_frequency, e?.recurrence_interval)
                : "",
            is_projected: Boolean(e?.is_projected),
        })),
    };
}

export async function fetchCalendarMonth(apiClient, year = null, month = null) {
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));
    const query = params.toString() ? `?${params.toString()}` : "";

    const data = await apiClient.request(`/api/v1/calendar/events${query}`, {
        method: "GET",
    });

    return normalizeCalendarMonth(data);
}

export async function fetchCalendarRange(apiClient, from, to) {
    const params = new URLSearchParams();
    params.set("from", from); // YYYY-MM-DD
    params.set("to", to);

    const query = `?${params.toString()}`;

    const data = await apiClient.request(`/api/v1/calendar/events/range${query}`, {
        method: "GET",
    });

    return normalizeCalendarRange(data);
}
