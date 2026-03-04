// src/components/analytics/ChartLegend.jsx
import { useMemo, useState } from "react";

export default function ChartLegend({
    payload,
    layout = "grid",
    itemType = "square",
    mode, // "people" enables smart columns + "+N others" toggle
}) {
    const [showAll, setShowAll] = useState(false);

    const isPeopleMode = mode === "people";
    const total = payload?.length || 0;

    const { displayPayload, gridColumns, overflowCount } = useMemo(() => {
        if (!payload || payload.length === 0) {
            return { displayPayload: [], gridColumns: 2, hasOverflow: false, overflowCount: 0 };
        }

        let hasOverflowLocal = false;
        let overflowCountLocal = 0;
        let display = payload;

        if (isPeopleMode) {
            // <=4 => 2 columns, 5-6 => 3 columns, >6 => 3 columns
            const cols = payload.length <= 4 ? 2 : 3;

            if (payload.length > 6 && !showAll) {
                hasOverflowLocal = true;
                overflowCountLocal = payload.length - 5;

                // show first 5 + "+N others"
                display = [
                    ...payload.slice(0, 5),
                    {
                        value: `+${overflowCountLocal} others`,
                        color: "hsl(var(--muted-foreground))",
                        payload: { _isOthers: true },
                    },
                ];
            }

            return {
                displayPayload: display,
                gridColumns: cols,
                hasOverflow: hasOverflowLocal,
                overflowCount: overflowCountLocal,
            };
        }

        // non-people mode defaults
        return { displayPayload: display, gridColumns: 2, hasOverflow: false, overflowCount: 0 };
    }, [payload, isPeopleMode, showAll]);

    if (!displayPayload || displayPayload.length === 0) return null;

    const containerStyle =
        layout === "grid"
            ? {
                display: "grid",
                gridTemplateColumns: `repeat(${gridColumns}, auto)`,
                gap: "8px 18px",
                justifyContent: "center",
                paddingTop: 10,
                fontSize: 14,
                lineHeight: "18px",
            }
            : {
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 18px",
                justifyContent: "center",
                paddingTop: 10,
                fontSize: 14,
                lineHeight: "18px",
            };

    return (
        <div style={containerStyle}>
            {displayPayload.map((entry, i) => {
                const color = entry.color || "hsl(var(--muted-foreground))";
                const isOthers = !!entry?.payload?._isOthers;

                const row = (
                    <>
                        {itemType === "line" ? (
                            <svg width="24" height="10" aria-hidden="true">
                                <line
                                    x1="0"
                                    y1="5"
                                    x2="24"
                                    y2="5"
                                    stroke={color}
                                    strokeWidth="2"
                                    strokeDasharray={entry?.payload?.strokeDasharray}
                                />
                            </svg>
                        ) : (
                            <span
                                aria-hidden="true"
                                style={{
                                    width: 10,
                                    height: 10,
                                    backgroundColor: color,
                                    display: "inline-block",
                                    borderRadius: 2,
                                }}
                            />
                        )}
                        <span>{entry.value}</span>
                    </>
                );

                if (isOthers) {
                    // toggle behavior: click "+N others" to show all, click again (when expanded) via "Show less"
                    return (
                        <button
                            key={`legend-${i}-${entry.value}`}
                            type="button"
                            onClick={() => setShowAll(true)}
                            className="text-xs font-medium underline underline-offset-2 hover:opacity-80"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                color: "hsl(var(--muted-foreground))",
                                whiteSpace: "nowrap",
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                justifySelf: "start",
                            }}
                            aria-label={`Show ${overflowCount} more names`}
                            title="Show all names"
                        >
                            {row}
                        </button>
                    );
                }

                return (
                    <div
                        key={`legend-${i}-${entry.value}`}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color,
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {row}
                    </div>
                );
            })}

            {/* When expanded, provide a "Show less" control */}
            {isPeopleMode && total > 6 && showAll ? (
                <button
                    type="button"
                    onClick={() => setShowAll(false)}
                    className="text-xs font-medium underline underline-offset-2 hover:opacity-80"
                    style={{
                        gridColumn: `span ${gridColumns}`,
                        justifySelf: "center",
                        marginTop: 6,
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "hsl(var(--muted-foreground))",
                    }}
                    aria-label="Show fewer names"
                    title="Show fewer names"
                >
                    Show less
                </button>
            ) : null}
        </div>
    );
}