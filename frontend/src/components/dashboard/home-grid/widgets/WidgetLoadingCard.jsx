import { Loader2 } from "lucide-react";

import { WidgetShell } from "@/components/dashboard/home-grid/WidgetCard";

export function WidgetLoadingCard({ title }) {
  return (
    <WidgetShell title={title} description="Loading widget..." accent="h-9 w-9 rounded-2xl bg-muted">
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    </WidgetShell>
  );
}
