import { BarChart3 } from "lucide-react";

import { WidgetShell } from "@/components/dashboard/home-grid/WidgetCard";

export function AnalyticsStatWidget({ stat }) {
  const trendClass =
    stat?._trend === "up"
      ? "bg-sage-light text-sage"
      : stat?._trend === "down"
        ? "bg-terracotta-light text-terracotta"
        : "bg-muted text-muted-foreground";

  return (
    <WidgetShell
      title={stat?.title || "Analytics"}
      description={stat?.description || "Live household metric."}
      accent="h-9 w-9 rounded-2xl bg-primary/10"
      className="h-[220px]"
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            {stat?._changeText ? (
              <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${trendClass}`}>
                {stat._changeText}
              </span>
            ) : null}
          </div>

          <p className="mt-6 text-3xl font-bold text-foreground">{stat?.value ?? "—"}</p>
          {stat?.compareLabel ? (
            <p className="mt-2 text-xs text-muted-foreground">{stat.compareLabel}</p>
          ) : null}
        </div>
      </div>
    </WidgetShell>
  );
}
