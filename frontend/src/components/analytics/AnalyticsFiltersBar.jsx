import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function FilterField({ label, value, onValueChange, options, disabled = false }) {
    return (
        <div className="min-w-[180px]">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <Select value={value} onValueChange={onValueChange} disabled={disabled}>
                <SelectTrigger>
                    <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                    {(options || []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export default function AnalyticsFiltersBar({ vm }) {
    const {
        selectedPersonFilter,
        setSelectedPersonFilter,
        selectedCategoryFilter,
        setSelectedCategoryFilter,
        selectedTaskTypeFilter,
        setSelectedTaskTypeFilter,
        selectedPriorityFilter,
        setSelectedPriorityFilter,
        personFilterOptions,
        categoryFilterOptions,
        taskTypeFilterOptions,
        priorityFilterOptions,
    } = vm;

    return (
        <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-end gap-3">
                <FilterField
                    label="Person"
                    value={selectedPersonFilter}
                    onValueChange={setSelectedPersonFilter}
                    options={personFilterOptions}
                />
                <FilterField
                    label="Category"
                    value={selectedCategoryFilter}
                    onValueChange={setSelectedCategoryFilter}
                    options={categoryFilterOptions}
                />
                <FilterField
                    label="Task Type"
                    value={selectedTaskTypeFilter}
                    onValueChange={setSelectedTaskTypeFilter}
                    options={taskTypeFilterOptions}
                />
                <FilterField
                    label="Priority"
                    value={selectedPriorityFilter}
                    onValueChange={setSelectedPriorityFilter}
                    options={priorityFilterOptions}
                />
            </div>
        </div>
    );
}
