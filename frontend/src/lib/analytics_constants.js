export const TIMEFRAME_OPTIONS = [
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
    { id: "12w", label: "12 weeks" },
];

export const CHARTS = [
    {
        id: "distribution",
        title: "Task Distribution by Person",
        desc: "Weekly count of tasks per person, grouped by week number.",
        emptyTitle: "No tasks assigned in this timeframe",
        emptyHint: "Assign tasks to people to see distribution over time",
    },
    {
        id: "category",
        title: "Tasks by Category",
        desc: "Share of tasks by category. Large lists are grouped into “Other”.",
        emptyTitle: "No categories used in this timeframe",
        emptyHint: "Add categories to tasks to see where effort goes",
    },
    {
        id: "load-trend",
        title: "Mental Load Trend",
        desc: "Overall load score over time (monthly).",
        emptyTitle: "No load signals in this timeframe",
        emptyHint: "Add tasks with load/weight to see trend",
    },
    {
        id: "completion",
        title: "Daily Completion Rate",
        desc: "Completed vs pending tasks per day in the selected timeframe.",
        emptyTitle: "No completion activity in this timeframe",
        emptyHint: "Mark tasks complete to unlock completion trend",
    },
    {
        id: "radar",
        title: "Category Expertise",
        desc: "Per-person strength by category (higher = more handled/completed).",
        emptyTitle: "Not enough category signal yet",
        emptyHint: "Use categories + assign people to build expertise map",
    },
];

export const DEFAULT_ACTIVE_CHART_IDS = [
    "distribution",
    "category",
    "load-trend",
    "completion",
    "radar",
];