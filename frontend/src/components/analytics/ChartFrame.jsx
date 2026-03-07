import { BarChart3 } from "lucide-react";
import { ResponsiveContainer } from "recharts";

function ChartEmptyState({
    title = "No data yet for the selected timeframe",
    hint = "Add a task with category + assignee to unlock this chart",
}) {
    return (
        <div className="h-full w-full flex items-center justify-center">
            <div className="text-center px-6">
                <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </div>

                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </div>
        </div>
    );
}

export default function ChartFrame({ isEmpty, emptyTitle, emptyHint, children, height = 256 }) {
    return (
        <div style={{ height }}>
            {isEmpty ? (
                <ChartEmptyState title={emptyTitle} hint={emptyHint} />
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    {children}
                </ResponsiveContainer>
            )}
        </div>
    );
}
