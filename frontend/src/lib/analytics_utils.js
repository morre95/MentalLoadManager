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

function escapePdfText(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function wrapLine(line, maxChars = 95) {
    const text = String(line ?? "");
    if (text.length <= maxChars) return [text];

    const words = text.split(" ");
    const lines = [];
    let current = "";

    words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxChars) {
            current = next;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    });

    if (current) lines.push(current);
    return lines;
}

function rowsToLines(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return ["No data"];

    const keys = Array.from(
        rows.reduce((acc, row) => {
            Object.keys(row || {}).forEach((k) => acc.add(k));
            return acc;
        }, new Set())
    );

    const header = keys.join(" | ");
    const separator = keys.map(() => "---").join(" | ");
    const body = rows.map((row) =>
        keys.map((k) => String(row?.[k] ?? "")).join(" | ")
    );

    return [header, separator, ...body];
}

function buildPdfBlob(title, lines = []) {
    const pageWidth = 612;
    const pageHeight = 792;
    const marginLeft = 50;
    const startY = 760;
    const lineHeight = 14;
    const maxLinesPerPage = 48;

    const allLines = [title, "", ...lines]
        .flatMap((line) => wrapLine(line))
        .map((line) => escapePdfText(line));

    const pages = [];
    for (let i = 0; i < allLines.length; i += maxLinesPerPage) {
        pages.push(allLines.slice(i, i + maxLinesPerPage));
    }
    if (pages.length === 0) pages.push(["No data"]);

    const objects = [];
    const pageNums = [];
    const contentNums = [];

    let nextObjNum = 3;
    pages.forEach(() => {
        pageNums.push(nextObjNum++);
        contentNums.push(nextObjNum++);
    });
    const fontObjNum = nextObjNum++;

    objects.push({
        num: 1,
        body: "<< /Type /Catalog /Pages 2 0 R >>",
    });

    objects.push({
        num: 2,
        body: `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNums.length} >>`,
    });

    pages.forEach((pageLines, idx) => {
        const pageNum = pageNums[idx];
        const contentNum = contentNums[idx];

        objects.push({
            num: pageNum,
            body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentNum} 0 R >>`,
        });

        const streamParts = ["BT", "/F1 10 Tf", `${lineHeight} TL`, `${marginLeft} ${startY} Td`];
        pageLines.forEach((line, lineIndex) => {
            if (lineIndex > 0) streamParts.push("T*");
            streamParts.push(`(${line}) Tj`);
        });
        streamParts.push("ET");

        const stream = streamParts.join("\n");
        objects.push({
            num: contentNum,
            body: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        });
    });

    objects.push({
        num: fontObjNum,
        body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    });

    objects.sort((a, b) => a.num - b.num);

    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    objects.forEach((obj) => {
        offsets[obj.num] = pdf.length;
        pdf += `${obj.num} 0 obj\n${obj.body}\nendobj\n`;
    });

    const xrefStart = pdf.length;
    const maxObj = objects[objects.length - 1].num;

    pdf += `xref\n0 ${maxObj + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i <= maxObj; i += 1) {
        const offset = offsets[i] ?? 0;
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return new Blob([pdf], { type: "application/pdf" });
}

export function downloadPdfFromRows(filename, title, rows = []) {
    const lines = rowsToLines(rows);
    const blob = buildPdfBlob(title || "Analytics", lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function downloadPdfFromText(filename, title, lines = []) {
    const blob = buildPdfBlob(title || "Analytics", Array.isArray(lines) ? lines : [String(lines ?? "")]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
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
