const KEY = "household_members";

export function loadHouseholdMembers() {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveHouseholdMembers(members) {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(Array.isArray(members) ? members : []));
}

export function clearHouseholdMembers() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(KEY);
}
