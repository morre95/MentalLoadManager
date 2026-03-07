import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DeltaText({ value }) {
    if (Math.abs(value) < 0.5) {
        return <span className="text-xs text-muted-foreground">near fair share</span>;
    }
    const sign = value > 0 ? "+" : "";
    const tone = value > 0 ? "text-terracotta" : "text-sage";
    return <span className={`text-xs ${tone}`}>{`${sign}${value.toFixed(1)} vs fair`}</span>;
}

export default function AnalyticsFairnessCard({ vm }) {
    const { personLoadRows } = vm;
    const rows = (personLoadRows || []).slice(0, 6);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Workload Fairness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {rows.length ? (
                    rows.map((row) => (
                        <div key={row.person} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm text-foreground">{row.label}</span>
                                <span className="text-xs text-muted-foreground">{Math.round(row.sharePct)}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted">
                                <div
                                    className="h-2 rounded-full bg-primary"
                                    style={{ width: `${Math.max(3, Math.min(100, row.sharePct))}%` }}
                                />
                            </div>
                            <DeltaText value={row.deltaFromFair} />
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground">Not enough assignment data yet.</p>
                )}
            </CardContent>
        </Card>
    );
}
