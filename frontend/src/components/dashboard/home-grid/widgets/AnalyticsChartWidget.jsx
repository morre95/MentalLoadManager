import { WidgetShell } from "@/components/dashboard/home-grid/WidgetCard";

export function AnalyticsChartWidget({ title, description, chart }) {
  return (
    <WidgetShell
      title={title}
      description={description}
      accent="h-9 w-9 rounded-2xl bg-primary/10"
    >
      <div className="h-full min-w-0">
        {chart}
      </div>
    </WidgetShell>
  );
}
