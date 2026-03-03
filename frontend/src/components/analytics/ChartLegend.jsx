export default function ChartLegend({ payload, layout = "grid", itemType = "square" }) {
    if (!payload || !payload.length) return null;

    const containerStyle =
        layout === "grid"
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(2, auto)",
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
            {payload.map((entry, i) => {
                const color = entry.color || "hsl(var(--muted-foreground))";
                return (
                    <div
                        key={`legend-${i}`}
                        style={{ display: "flex", alignItems: "center", gap: 8, color, fontWeight: 500 }}
                    >
                        {itemType === "line" ? (
                            <svg width="24" height="10">
                                <line
                                    x1="0"
                                    y1="5"
                                    x2="24"
                                    y2="5"
                                    stroke={color}
                                    strokeWidth="2"
                                    strokeDasharray={entry.payload && entry.payload.strokeDasharray}
                                />
                            </svg>
                        ) : (
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    backgroundColor: color,
                                    display: "inline-block",
                                    borderRadius: 2,
                                }}
                            />
                        )}
                        {entry.value}
                    </div>
                );
            })}
        </div>
    );
}