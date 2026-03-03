import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ManageChartsDialog({ open, onOpenChange, charts, activeChartIds, onToggle }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manage Charts</DialogTitle>
                </DialogHeader>

                <div className="space-y-3 mt-4">
                    {(charts || []).map((c) => {
                        const isActive = activeChartIds.includes(c.id);

                        return (
                            <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <p className="text-sm font-medium">{c.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                                </div>

                                <Button
                                    size="sm"
                                    variant={isActive ? "outline" : "default"}
                                    onClick={() => onToggle(c.id)}
                                >
                                    {isActive ? "Hide" : "Show"}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}