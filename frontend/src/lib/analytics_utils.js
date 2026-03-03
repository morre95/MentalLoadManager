export function safeNumber(n) {
    if (n === null || n === undefined) return null;
    if (typeof n === "number") return Number.isFinite(n) ? n : null;

    const s = String(n).trim();
    if (!s) return null;

    const cleaned = s.replace(/\s/g, "").replace(/,/g, "").replace(/%/g, "");
    const x = Number(cleaned);
    return Number.isFinite(x) ? x : null;
}

export function formatPct(p) {
    const abs = Math.abs(p);
    const digits = abs >= 10 ? 0 : 1;
    return `${p > 0 ? "+" : ""}${p.toFixed(digits)}%`;
}

export function toCsv(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return "";
    const keys = Array.from(
        rows.reduce((acc, r) => {
            Object.keys(r || {}).forEach((k) => acc.add(k));
            return acc;
        }, new Set())
    );

    const escape = (v) => {
        const s = v === null || v === undefined ? "" : String(v);
        const needs = /[",\n]/.test(s);
        const esc = s.replace(/"/g, '""');
        return needs ? `"${esc}"` : esc;
    };

    const header = keys.map(escape).join(",");
    const body = rows
        .map((r) => keys.map((k) => escape(r && r[k])).join(","))
        .join("\n");

    return `${header}\n${body}`;
}

export function downloadTextFile(filename, content, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function formatRelativeTime(date) {
    if (!date) return "";
    const diffMs = Date.now() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 10) return "Updated just now";
    if (diffSeconds < 60) return `Updated ${diffSeconds}s ago`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24)
        return `Updated ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `Updated ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}