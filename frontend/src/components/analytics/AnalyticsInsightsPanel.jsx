import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ForecastPill({ level }) {
    const className =
        level === "risk"
            ? "bg-terracotta-light text-terracotta"
            : level === "good"
                ? "bg-sage-light text-sage"
                : "bg-muted text-muted-foreground";
    const label = level === "risk" ? "Attention" : level === "good" ? "Positive" : "Stable";

    return <span className={`text-xs px-2 py-1 rounded-full font-medium ${className}`}>{label}</span>;
}

export default function AnalyticsInsightsPanel({ vm }) {
    const { insights, suggestions, forecast } = vm;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {(insights || []).length ? (
                        insights.map((item) => (
                            <div key={item.title} className="rounded-md border border-border p-3">
                                <p className="text-sm font-medium text-foreground">{item.title}</p>
                                <p className="text-sm text-muted-foreground mt-1">{item.text}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">No insights available yet.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{forecast?.title || "Forecast"}</CardTitle>
                        <ForecastPill level={forecast?.level} />
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{forecast?.text}</p>

                    <div>
                        <p className="text-sm font-medium text-foreground mb-1">Suggestions</p>
                        {(suggestions || []).length ? (
                            <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
                                {suggestions.map((s) => (
                                    <li key={s}>{s}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">No suggestions right now.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
