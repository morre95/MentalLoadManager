import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { goalTemplates } from "@/types/goals";

const AddGoalDialog = ({ open, onOpenChange, onAddGoal }) => {
    const [step, setStep] = useState("select");
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [goalName, setGoalName] = useState("");
    const [targetValue, setTargetValue] = useState(0);
    const [trackingStyle, setTrackingStyle] = useState("total");

    const handleSelectTemplate = (template) => {
        setSelectedTemplate(template);
        setGoalName(template.name);
        setTargetValue(template.defaultTarget);
        setTrackingStyle(template.trackingStyle);
        setStep("configure");
    };

    const handleAddNewGoal = () => {
        if (!selectedTemplate) return;

        const newGoal = {
            id: crypto.randomUUID(),
            type: selectedTemplate.id,
            name: goalName,
            current: 0,
            target: targetValue,
            trackingStyle,
            createdAt: new Date(),
        };

        onAddGoal(newGoal);
        handleClose();
    };

    const handleClose = () => {
        setStep("select");
        setSelectedTemplate(null);
        setGoalName("");
        setTargetValue(0);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl">
                        {step === "select" ? "Choose a Goal Template" : "Configure Your Goal"}
                    </DialogTitle>
                </DialogHeader>

                <AnimatePresence mode="wait">
                    {step === "select" ? (
                        <motion.div
                            key="select"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4"
                        >
                            {goalTemplates.map((template) => (
                                <motion.button
                                    key={template.id}
                                    onClick={() => handleSelectTemplate(template)}
                                    className="p-4 rounded-xl border border-border hover:border-primary bg-card hover:bg-muted/50 transition-all text-left"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="text-3xl mb-2 block">{template.icon}</span>
                                    <h3 className="font-semibold text-foreground text-sm">
                                        {template.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {template.description}
                                    </p>
                                </motion.button>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="configure"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6 mt-4"
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStep("select")}
                                className="mb-2"
                            >
                                ← Back to templates
                            </Button>

                            {selectedTemplate && (
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                                    <span className="text-4xl">{selectedTemplate.icon}</span>
                                    <div>
                                        <h3 className="font-semibold text-foreground">
                                            {selectedTemplate.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedTemplate.description}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="goalName">Goal Name</Label>
                                    <Input
                                        id="goalName"
                                        value={goalName}
                                        onChange={(e) => setGoalName(e.target.value)}
                                        placeholder="Enter a name for your goal"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>
                                        Target Value {selectedTemplate?.unit && `(${selectedTemplate.unit})`}
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() =>
                                                setTargetValue(Math.max(1, targetValue - 1))
                                            }
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                            type="number"
                                            value={targetValue}
                                            onChange={(e) =>
                                                setTargetValue(Number(e.target.value))
                                            }
                                            className="text-center"
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setTargetValue(targetValue + 1)}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tracking Style</Label>
                                    <Select
                                        value={trackingStyle}
                                        onValueChange={(v) => setTrackingStyle(v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="daily">Daily</SelectItem>
                                            <SelectItem value="weekly">Weekly</SelectItem>
                                            <SelectItem value="total">Total Progress</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="outline" onClick={handleClose}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleAddNewGoal}
                                    disabled={!goalName || targetValue <= 0}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Goal
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};

export default AddGoalDialog;