import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { downloadPdfFromRows } from "@/lib/analytics_utils";

export default function AnalyticsDrilldownDialog({ vm }) {
    const { drilldown, handleCloseDrilldown } = vm;

    const rows = Array.isArray(drilldown?.rows) ? drilldown.rows : [];
    const columns = rows.length ? Object.keys(rows[0]) : [];

    const handleDownload = () => {
        const name = (drilldown?.title || "drilldown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        downloadPdfFromRows(`${name || "drilldown"}.pdf`, drilldown?.title || "Details", rows);
    };

    return (
        <Dialog open={!!drilldown?.open} onOpenChange={(open) => !open && handleCloseDrilldown()}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{drilldown?.title || "Details"}</DialogTitle>
                </DialogHeader>

                {rows.length ? (
                    <div className="max-h-[420px] overflow-auto rounded-md border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/60 sticky top-0">
                                <tr>
                                    {columns.map((col) => (
                                        <th key={col} className="text-left p-2 font-medium text-foreground">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={`${idx}-${JSON.stringify(row)}`} className="border-t border-border">
                                        {columns.map((col) => (
                                            <td key={col} className="p-2 text-muted-foreground">
                                                {String(row[col] ?? "")}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No details available for this data point.</p>
                )}

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleDownload}>
                        Download details (PDF)
                    </Button>
                    <Button variant="outline" onClick={handleCloseDrilldown}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
