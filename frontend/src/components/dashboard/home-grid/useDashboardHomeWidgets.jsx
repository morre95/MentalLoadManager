import { useEffect, useMemo, useState } from "react";

import QuickStats from "@/components/dashboard/QuickStats";
import {
  AnalyticsStatWidget,
  GoalWidget,
  MiniCalendarWidget,
  MiniMoodWidget,
  MiniTaskboardWidget,
  UpcomingTasksWidget,
  WidgetLoadingCard,
} from "@/components/dashboard/home-grid/DashboardWidgets";
import { buildAnalyticsChartWidgets } from "@/components/dashboard/home-grid/analyticsWidgetRegistry";
import { slugify } from "@/components/dashboard/home-grid/helpers";
import { useTaskboardTasks } from "@/hooks/useTaskboardTasks";
import { useHousehold } from "@/hooks/useHouseHold";
import {
  fetchGoals,
  fetchMoodTrackerPeriod,
  resolveCurrentHouseholdId,
} from "@/lib/utils";
import { apiClient } from "@/lib/utils";
import { fetchAnalyticsSummary, fetchCalendarRange } from "../../../../../shared/index.js";

export function useDashboardHomeWidgets() {
  const { households } = useHousehold();
  const { tasks, loading: tasksLoading, error: tasksError } = useTaskboardTasks(null, { pageSize: 80 });

  const [goalsState, setGoalsState] = useState({ loading: true, goals: [], error: null });
  const [calendarState, setCalendarState] = useState({ loading: true, events: [], error: null });
  const [moodState, setMoodState] = useState({ loading: true, tracker: null, error: null });
  const [analyticsState, setAnalyticsState] = useState({
    loading: true,
    stats: [],
    weeklyData: [],
    categoryData: [],
    loadTrendData: [],
    completionData: [],
    radarData: [],
    people: [],
    labels: {},
    error: null,
  });

  useEffect(() => {
    let active = true;

    const loadGoalsData = async () => {
      try {
        const data = await fetchGoals();
        if (!active) return;
        setGoalsState({
          loading: false,
          goals: Array.isArray(data?.goals) ? data.goals : [],
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setGoalsState({ loading: false, goals: [], error });
      }
    };

    loadGoalsData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadCalendar = async () => {
      try {
        const today = new Date();
        const from = today.toISOString().slice(0, 10);
        const toDate = new Date(today);
        toDate.setDate(today.getDate() + 6);
        const to = toDate.toISOString().slice(0, 10);
        const data = await fetchCalendarRange(apiClient, from, to);
        if (!active) return;
        setCalendarState({
          loading: false,
          events: Array.isArray(data?.events) ? data.events : [],
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setCalendarState({ loading: false, events: [], error });
      }
    };

    loadCalendar();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadMood = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const data = await fetchMoodTrackerPeriod("weekly", today);
        if (!active) return;
        setMoodState({ loading: false, tracker: data, error: null });
      } catch (error) {
        if (!active) return;
        setMoodState({ loading: false, tracker: null, error });
      }
    };

    loadMood();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadAnalytics = async () => {
      try {
        const resolvedHouseholdId = await resolveCurrentHouseholdId();
        const fallbackHouseholdId = households?.[0]?.household_id
          ? String(households[0].household_id)
          : null;
        const householdId = resolvedHouseholdId || fallbackHouseholdId;

        if (!householdId) {
          if (active) {
            setAnalyticsState({
              loading: false,
              stats: [],
              weeklyData: [],
              categoryData: [],
              loadTrendData: [],
              completionData: [],
              radarData: [],
              people: [],
              labels: {},
              error: null,
            });
          }
          return;
        }

        const summary = await fetchAnalyticsSummary(apiClient, householdId, "30d");
        if (!active) return;

        const normalizedCategoryData = Array.isArray(summary?.categoryData) ? [...summary.categoryData] : [];
        const cleanedCategoryData = normalizedCategoryData
          .map((item) => ({
            ...item,
            value: Number(item?.value) || 0,
            name: item?.name || "Unknown",
          }))
          .filter((item) => item.value > 0)
          .sort((left, right) => right.value - left.value);
        const topCategoryData = cleanedCategoryData.slice(0, 6);
        const otherCategoryValue = cleanedCategoryData
          .slice(6)
          .reduce((sum, item) => sum + (item.value || 0), 0);
        if (otherCategoryValue > 0) {
          topCategoryData.push({
            name: "Other",
            value: otherCategoryValue,
            color: "hsl(var(--muted-foreground))",
            _isOther: true,
          });
        }

        setAnalyticsState({
          loading: false,
          stats: Array.isArray(summary?.stats) ? summary.stats : [],
          weeklyData: Array.isArray(summary?.weeklyData) ? summary.weeklyData : [],
          categoryData: topCategoryData,
          loadTrendData: Array.isArray(summary?.loadTrendData) ? summary.loadTrendData : [],
          completionData: Array.isArray(summary?.completionData) ? summary.completionData : [],
          radarData: Array.isArray(summary?.radarData) ? summary.radarData : [],
          people: Array.isArray(summary?.people) ? [...summary.people].sort((a, b) => a.localeCompare(b)) : [],
          labels: summary?.labels && typeof summary.labels === "object" ? summary.labels : {},
          error: null,
        });
      } catch (error) {
        if (!active) return;
        setAnalyticsState({
          loading: false,
          stats: [],
          weeklyData: [],
          categoryData: [],
          loadTrendData: [],
          completionData: [],
          radarData: [],
          people: [],
          labels: {},
          error,
        });
      }
    };

    loadAnalytics();
    return () => {
      active = false;
    };
  }, [households]);

  const staticWidgets = useMemo(() => ([
    {
      id: "quick-stats",
      title: "Quick Stats",
      description: "Overview of key metrics",
      size: "medium",
      defaultVisible: true,
      render: () => <QuickStats />,
    },
    {
      id: "mini-taskboard",
      title: "Mini Taskboard",
      description: "Compact task columns",
      size: "large",
      defaultVisible: true,
      render: () => <MiniTaskboardWidget tasks={tasks} loading={tasksLoading} error={tasksError} />,
    },
    {
      id: "upcoming-tasks",
      title: "Upcoming Tasks",
      description: "Next tasks due",
      size: "medium",
      defaultVisible: true,
      render: () => <UpcomingTasksWidget tasks={tasks} loading={tasksLoading} error={tasksError} />,
    },
    {
      id: "mini-calendar",
      title: "Mini Calendar",
      description: "Small weekly calendar",
      size: "medium",
      defaultVisible: true,
      render: () => <MiniCalendarWidget state={calendarState} />,
    },
    {
      id: "mini-mood",
      title: "Mood Miniature",
      description: "Weekly mood board snapshot",
      size: "small",
      defaultVisible: true,
      render: () => <MiniMoodWidget state={moodState} />,
    },
  ]), [calendarState, moodState, tasks, tasksError, tasksLoading]);

  const analyticsWidgets = useMemo(() => {
    if (analyticsState.loading) {
      return [
        {
          id: "analytics-loading",
          title: "Analytics",
          description: "Loading analytics stats",
          size: "small",
          defaultVisible: true,
          render: () => <WidgetLoadingCard title="Analytics" />,
        },
      ];
    }

    const statWidgets = analyticsState.stats.map((stat, index) => ({
      id: `analytics-${slugify(stat?.title || index) || index}-${index}`,
      title: stat?.title || `Analytics ${index + 1}`,
      description: stat?.description || "Analytics stat",
      size: "small",
      defaultVisible: index < 4,
      render: () => <AnalyticsStatWidget stat={stat} />,
    }));

    return [...buildAnalyticsChartWidgets(analyticsState), ...statWidgets];
  }, [analyticsState]);

  const goalWidgets = useMemo(() => {
    if (goalsState.loading) {
      return [
        {
          id: "goals-loading",
          title: "Goals",
          description: "Loading goal widgets",
          size: "medium",
          defaultVisible: true,
          render: () => <WidgetLoadingCard title="Goals" />,
        },
      ];
    }

    return goalsState.goals.map((goal, index) => ({
      id: `goal-${goal.id}`,
      title: goal?.name || `Goal ${index + 1}`,
      description: `${goal?.type || "custom"} goal`,
      size: "medium",
      defaultVisible: index < 3,
      render: () => <GoalWidget goal={goal} />,
    }));
  }, [goalsState.goals, goalsState.loading]);

  const allWidgets = useMemo(() => {
    return [...staticWidgets, ...analyticsWidgets, ...goalWidgets];
  }, [analyticsWidgets, goalWidgets, staticWidgets]);

  return {
    allWidgets,
    goalsLoading: goalsState.loading,
    analyticsLoading: analyticsState.loading,
  };
}
