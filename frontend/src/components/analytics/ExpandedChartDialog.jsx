import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function ExpandedChartDialog({
    open,
    title,
    desc,
    onClose,
    onDownload,
    children,
}) {
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {desc ? <p className="text-sm text-muted-foreground mt-1">{desc}</p> : null}
                </DialogHeader>

                <div className="mt-2">{children}</div>

                <div className="mt-2 flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={onDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                    </Button>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
