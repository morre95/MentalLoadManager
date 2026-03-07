import { useMemo, useState } from "react";

/**
 * External legend (outside Recharts), so it never overlaps the chart.
 *
 * Rules:
 * - <=4 people: 2 columns
 * - 5-6 people: 3 columns
 * - >6 people: show first 5 + "+N others" (click to expand), 3 columns
 */
export default function PeopleLegend({
    people = [],
    getLabel, // (person) => string
    getColor, // (person) => string
}) {
    const [showAll, setShowAll] = useState(false);

    const total = people.length;
    const columns = total <= 4 ? 2 : 3;

    const { visiblePeople, overflowCount, hasOverflow } = useMemo(() => {
        if (total > 6 && !showAll) {
            return {
                visiblePeople: people.slice(0, 5),
                overflowCount: total - 5,
                hasOverflow: true,
            };
        }
        return { visiblePeople: people, overflowCount: 0, hasOverflow: total > 6 };
    }, [people, total, showAll]);

    if (!total) return null;

    return (
        <div className="pt-1">
            <div
                className="grid justify-center gap-x-6 gap-y-2"
                style={{ gridTemplateColumns: `repeat(${columns}, max-content)` }}
            >
                {visiblePeople.map((person) => {
                    const label = getLabel(person);
                    const color = getColor(person);

                    return (
                        <div
                            key={person}
                            className="flex items-center gap-2"
                            style={{
                                whiteSpace: "nowrap",
                                fontSize: 14,
                                lineHeight: "18px",
                                fontWeight: 500,
                                color: getColor(person),
                            }}
                        >
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
                            <span>{label}</span>
                        </div>
                    );
                })}

                {!showAll && hasOverflow ? (
                    <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        // button-reset that inherits font/size
                        style={{
                            all: "unset",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            fontSize: 14,
                            lineHeight: "18px",
                            fontWeight: 500,
                            color: "hsl(var(--muted-foreground))",
                        }}
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:opacity-80"
                        aria-label={`Show ${overflowCount} more`}
                        title="Show all names"
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                width: 10,
                                height: 10,
                                backgroundColor: "hsl(var(--muted-foreground))",
                                display: "inline-block",
                                borderRadius: 2,
                            }}
                        />
                        <span
                        style={{
                                paddingLeft: 8,
                                textDecoration: "underline",
                            }}
                            >{`+${overflowCount} others`}</span>
                    </button>
                ) : null}
            </div>

            {showAll && total > 6 ? (
                <div className="flex justify-center pt-2">
                    <button
                        type="button"
                        onClick={() => setShowAll(false)}
                        style={{ all: "unset", cursor: "pointer" }}
                        className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:opacity-80"
                    >
                        Show less
                    </button>
                </div>
            ) : null}
        </div>
    );
}
