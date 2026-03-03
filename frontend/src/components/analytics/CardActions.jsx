// src/components/analytics/CardActions.jsx
import { Maximize2, Download, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CardActions({
    chartId,
    title,
    onExpand,
    onDownload,
    onHide,
}) {
    return (
        <div className="flex items-center gap-1">
            <Button
                size="icon"
                variant="ghost"
                onClick={() => onExpand(chartId)}
                aria-label={`Expand ${title}`}
                title="Expand"
            >
                <Maximize2 className="h-4 w-4" />
            </Button>

            <Button
                size="icon"
                variant="ghost"
                onClick={() => onDownload(chartId)}
                aria-label={`Download ${title} data`}
                title="Download data (CSV)"
            >
                <Download className="h-4 w-4" />
            </Button>

            <Button
                size="icon"
                variant="ghost"
                onClick={() => onHide(chartId)}
                aria-label={`Hide ${title}`}
                title="Hide"
            >
                <EyeOff className="h-4 w-4" />
            </Button>
        </div>
    );
}