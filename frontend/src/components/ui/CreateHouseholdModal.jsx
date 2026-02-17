import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HouseholdModal({
    open,
    onOpenChange,
    title,
    description,
    value,
    setValue,
    onConfirm,
    loading,
    placeholder,
    confirmText = "Confirm",
    resetOnClose = true,
}) {
    const inputRef = React.useRef(null);

    // Autofocus when modal opens
    React.useEffect(() => {
        if (open) {
            // let Dialog mount first
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [open]);

    const close = () => {
        onOpenChange(false);
        if (resetOnClose) setValue("");
    };

    const canConfirm = !!value?.trim() && !loading;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                // when closing via overlay/Esc
                if (!next) close();
                else onOpenChange(true);
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description ? (
                        <DialogDescription>{description}</DialogDescription>
                    ) : null}
                </DialogHeader>

                <div className="space-y-3">
                    <Input
                        ref={inputRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && canConfirm) onConfirm();
                            if (e.key === "Escape") close();
                        }}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={close} disabled={loading}>
                        Cancel
                    </Button>

                    <Button onClick={onConfirm} disabled={!canConfirm}>
                        {loading ? "Loading…" : confirmText}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
