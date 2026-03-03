import { Button } from "@/components/ui/button";

export default function AnalyticsError({ error, onRetry }) {
    return (
        <div className="p-6 space-y-3">
            <p className="text-destructive font-medium">Failed to load analytics</p>
            <p className="text-sm text-muted-foreground">{error?.message || "Unknown error"}</p>
            <Button variant="outline" onClick={onRetry}>
                Retry
            </Button>
        </div>
    );
}