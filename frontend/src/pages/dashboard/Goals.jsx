import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, Trophy, Sparkles, RefreshCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import GoalCard from "@/components/goals/GoalCard";
import AddGoalDialog from "@/components/goals/AddGoalDialog";
import AchievementCard from "@/components/goals/AchievementCard";
import AchievementTimelineJourney from "@/components/goals/AchievementTimelineJourney";
import {
    createGoal as createGoalRequest,
    deleteGoal as deleteGoalRequest,
    fetchAchievements as fetchAchievementsRequest,
    fetchGoalsBoardAICheckin as fetchGoalsBoardAICheckinRequest,
    fetchGoals as fetchGoalsRequest,
    updateGoalProgress as updateGoalProgressRequest,
} from "@/lib/utils";

const TRAINING_STORAGE_KEY = "goal-training-days-v1";
const GOAL_MILESTONES_UPDATED_EVENT = "goals:changed";
const ACHIEVEMENT_CELEBRATION_STORAGE_KEY = "achievements-celebrated-v1";

const sortAchievements = (items) =>
    [...items].sort((left, right) => {
        const leftState = left?.current_milestone_complete ?? left?.completed
            ? 0
            : left?.has_unlocked_before
            ? 2
            : 1;
        const rightState = right?.current_milestone_complete ?? right?.completed
            ? 0
            : right?.has_unlocked_before
            ? 2
            : 1;

        if (leftState !== rightState) {
            return leftState - rightState;
        }

        return String(left?.title || "").localeCompare(String(right?.title || ""));
    });

const sortGoalsByActivity = (items) =>
    [...items].sort((left, right) => {
        const leftIsActive = Number(left?.current || 0) < Math.max(1, Number(left?.target) || 1);
        const rightIsActive = Number(right?.current || 0) < Math.max(1, Number(right?.target) || 1);

        if (leftIsActive !== rightIsActive) {
            return leftIsActive ? -1 : 1;
        }
        return 0;
    });

const readCelebratedAchievements = () => {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const rawValue = window.localStorage.getItem(ACHIEVEMENT_CELEBRATION_STORAGE_KEY);
        const parsedValue = rawValue ? JSON.parse(rawValue) : [];
        return Array.isArray(parsedValue) ? parsedValue.map(String) : [];
    } catch {
        return [];
    }
};

const writeCelebratedAchievements = (values) => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(ACHIEVEMENT_CELEBRATION_STORAGE_KEY, JSON.stringify(values));
};

const getCurrentTimezone = () => {
    if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") {
        return "UTC";
    }

    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};

const getCurrentWeekKey = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() + diffToMonday);
    return monday.toISOString().slice(0, 10);
};

const readTrainingSelections = () => {
    if (typeof window === "undefined") {
        return {};
    }

    try {
        const rawValue = window.localStorage.getItem(TRAINING_STORAGE_KEY);
        const parsedValue = rawValue ? JSON.parse(rawValue) : {};
        return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
    } catch {
        return {};
    }
};

const writeTrainingSelections = (selections) => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(selections));
};

const emitGoalMilestonesUpdated = () => {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new Event(GOAL_MILESTONES_UPDATED_EVENT));
};

const countCompletedDays = (days) => days.filter(Boolean).length;

const buildTrainingDaysFromCount = (currentValue) => {
    const days = Array(7).fill(false);
    const clampedValue = Math.max(0, Math.min(7, Number(currentValue) || 0));
    const today = new Date();
    const todayIndex = (today.getDay() + 6) % 7;

    for (let i = 0; i < clampedValue; i += 1) {
        const dayIndex = todayIndex - i;
        if (dayIndex < 0) {
            break;
        }
        days[dayIndex] = true;
    }

    return days;
};

const normalizeTrainingGoal = (goal, selections) => {
    if (goal.type !== "training") {
        return goal;
    }

    const weekKey = getCurrentWeekKey();
    const backendProgressData =
        goal.progressData && typeof goal.progressData === "object" ? goal.progressData : {};
    const storedEntry = selections[goal.id];
    const trainingDays =
        backendProgressData.week_key === weekKey &&
        Array.isArray(backendProgressData.training_days) &&
        backendProgressData.training_days.length === 7
            ? backendProgressData.training_days.map(Boolean)
            : storedEntry?.weekKey === weekKey && Array.isArray(storedEntry?.days) && storedEntry.days.length === 7
            ? storedEntry.days.map(Boolean)
            : buildTrainingDaysFromCount(goal.current);

    return {
        ...goal,
        current: countCompletedDays(trainingDays),
        trainingDays,
        trainingWeekKey: weekKey,
        progressData: {
            ...backendProgressData,
            week_key: weekKey,
            training_days: trainingDays,
        },
    };
};

const Goals = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [goals, setGoals] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [achievementTimeline, setAchievementTimeline] = useState([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [syncError, setSyncError] = useState(null);
    const [boardAICheckin, setBoardAICheckin] = useState(null);
    const [boardAILoading, setBoardAILoading] = useState(false);
    const [highlightedGoalId, setHighlightedGoalId] = useState(() => String(location.state?.highlightGoalId || ""));

    const loadGoals = useCallback(async () => {
        setIsLoading(true);
        setSyncError(null);

        try {
            const [goalsData, achievementsData] = await Promise.all([
                fetchGoalsRequest(),
                fetchAchievementsRequest(),
            ]);
            const trainingSelections = readTrainingSelections();
            const rawGoals = Array.isArray(goalsData?.goals) ? goalsData.goals : [];
            const normalizedGoals = rawGoals.map((goal) => normalizeTrainingGoal(goal, trainingSelections));
            setGoals(normalizedGoals);
            setAchievements(
                Array.isArray(achievementsData?.achievements)
                    ? sortAchievements(achievementsData.achievements)
                    : []
            );
            setAchievementTimeline(
                Array.isArray(achievementsData?.timeline) ? achievementsData.timeline : []
            );
        } catch (error) {
            if (error?.status === 401) {
                navigate("/login", { replace: true });
                return;
            }

            setSyncError("Could not load goals and achievements right now.");
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        loadGoals();
    }, [loadGoals]);

    useEffect(() => {
        const celebratedKeys = readCelebratedAchievements();
        const newlyCompleted = achievements.filter(
            (achievement) =>
                achievement.completed &&
                achievement.completion_key &&
                !celebratedKeys.includes(String(achievement.completion_key))
        );

        if (!newlyCompleted.length) {
            return;
        }

        newlyCompleted.forEach((achievement) => {
            toast.success(`Achievement unlocked: ${achievement.title}`);
        });

        writeCelebratedAchievements([
            ...new Set([
                ...celebratedKeys,
                ...newlyCompleted.map((achievement) => String(achievement.completion_key)),
            ]),
        ]);
    }, [achievements]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const handleGoalUpdates = () => {
            loadGoals();
        };

        window.addEventListener(GOAL_MILESTONES_UPDATED_EVENT, handleGoalUpdates);
        return () => {
            window.removeEventListener(GOAL_MILESTONES_UPDATED_EVENT, handleGoalUpdates);
        };
    }, [loadGoals]);

    useEffect(() => {
        const nextHighlightedGoalId = String(location.state?.highlightGoalId || "");
        if (!nextHighlightedGoalId) {
            return;
        }

        setHighlightedGoalId(nextHighlightedGoalId);
        navigate(location.pathname, { replace: true, state: {} });
    }, [location.pathname, location.state, navigate]);

    useEffect(() => {
        if (!highlightedGoalId || isLoading) {
            return undefined;
        }

        const highlightedGoalExists = goals.some((goal) => goal.id === highlightedGoalId);
        if (!highlightedGoalExists) {
            return undefined;
        }

        const scrollTimer = window.setTimeout(() => {
            const element = document.getElementById(`goal-card-${highlightedGoalId}`);
            element?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);

        const clearTimer = window.setTimeout(() => {
            setHighlightedGoalId("");
        }, 3200);

        return () => {
            window.clearTimeout(scrollTimer);
            window.clearTimeout(clearTimer);
        };
    }, [goals, highlightedGoalId, isLoading]);

    const handleAddGoal = (newGoal) => {
        setSyncError(null);

        const payload = {
            type: newGoal.type,
            name: newGoal.name,
            target_value: newGoal.target,
            tracking_style: newGoal.trackingStyle,
            current_value: newGoal.current ?? 0,
            progress_data:
                newGoal.type === "training"
                    ? {
                        timezone: getCurrentTimezone(),
                        week_key: getCurrentWeekKey(),
                        training_days: Array(7).fill(false),
                    }
                    : {
                        timezone: getCurrentTimezone(),
                    },
        };

        createGoalRequest(payload)
            .then((createdGoal) => {
                const normalizedGoal = normalizeTrainingGoal(createdGoal, readTrainingSelections());
                setGoals((prev) => [normalizedGoal, ...prev]);
                emitGoalMilestonesUpdated();
            })
            .catch((error) => {
                if (error?.status === 401) {
                    navigate("/login", { replace: true });
                    return;
                }

                setSyncError("Could not create goal. Please try again.");
            });
    };

    const handleUpdateProgress = async (id, newValue) => {
        setSyncError(null);

        try {
            const previousGoal = goals.find((goal) => goal.id === id);
            const updatedGoal = await updateGoalProgressRequest(id, {
                current_value: newValue,
                progress_data: {
                    ...(previousGoal?.progressData && typeof previousGoal.progressData === "object"
                        ? previousGoal.progressData
                        : {}),
                    timezone: getCurrentTimezone(),
                },
            });
            const normalizedGoal = normalizeTrainingGoal(updatedGoal, readTrainingSelections());
            setGoals((prev) =>
                prev.map((goal) => (goal.id === id ? normalizedGoal : goal))
            );
            emitGoalMilestonesUpdated();
        } catch (error) {
            if (error?.status === 401) {
                navigate("/login", { replace: true });
                return;
            }

            setSyncError("Could not update goal progress.");
        }
    };

    const handleToggleTrainingDay = async (id, dayIndex) => {
        const trainingSelections = readTrainingSelections();
        const previousGoal = goals.find((goal) => goal.id === id);

        if (!previousGoal || previousGoal.type !== "training") {
            return;
        }

        const currentDays =
            Array.isArray(previousGoal.trainingDays) && previousGoal.trainingDays.length === 7
                ? [...previousGoal.trainingDays]
                : buildTrainingDaysFromCount(previousGoal.current);
        const nextDays = currentDays.map((value, index) => (index === dayIndex ? !value : value));
        const nextCurrent = countCompletedDays(nextDays);
        const nextSelections = {
            ...trainingSelections,
            [id]: {
                weekKey: getCurrentWeekKey(),
                days: nextDays,
            },
        };
        const nextProgressData = {
            timezone: getCurrentTimezone(),
            week_key: getCurrentWeekKey(),
            training_days: nextDays,
        };

        setSyncError(null);
        setGoals((prev) =>
            prev.map((goal) =>
                goal.id === id
                    ? {
                        ...goal,
                        current: nextCurrent,
                        trainingDays: nextDays,
                        trainingWeekKey: getCurrentWeekKey(),
                        progressData: nextProgressData,
                    }
                    : goal
            )
        );
        writeTrainingSelections(nextSelections);

        try {
            const updatedGoal = await updateGoalProgressRequest(id, {
                current_value: nextCurrent,
                progress_data: nextProgressData,
            });
            const normalizedGoal = normalizeTrainingGoal(updatedGoal, nextSelections);
            setGoals((prev) => prev.map((goal) => (goal.id === id ? normalizedGoal : goal)));
            emitGoalMilestonesUpdated();
        } catch (error) {
            writeTrainingSelections(trainingSelections);
            setGoals((prev) =>
                prev.map((goal) =>
                    goal.id === id
                        ? normalizeTrainingGoal(previousGoal, trainingSelections)
                        : goal
                )
            );

            if (error?.status === 401) {
                navigate("/login", { replace: true });
                return;
            }

            setSyncError("Could not update training days.");
        }
    };

    const handleDeleteGoal = async (id) => {
        setSyncError(null);

        try {
            await deleteGoalRequest(id);
            const trainingSelections = readTrainingSelections();
            if (trainingSelections[id]) {
                const nextSelections = { ...trainingSelections };
                delete nextSelections[id];
                writeTrainingSelections(nextSelections);
            }
            setGoals((prev) => prev.filter((goal) => goal.id !== id));
            emitGoalMilestonesUpdated();
        } catch (error) {
            if (error?.status === 401) {
                navigate("/login", { replace: true });
                return;
            }

            setSyncError("Could not delete goal.");
        }
    };

    const handleLoadBoardAICheckin = async (options = {}) => {
        setBoardAILoading(true);
        setSyncError(null);
        try {
            const checkin = await fetchGoalsBoardAICheckinRequest(options);
            setBoardAICheckin(checkin);
        } catch (error) {
            if (error?.status === 401) {
                navigate("/login", { replace: true });
                return;
            }
            setSyncError("Could not load AI goals board check-in.");
        } finally {
            setBoardAILoading(false);
        }
    };

    const sortedGoals = sortGoalsByActivity(goals);
    const activeGoalsCount = sortedGoals.filter(
        (goal) => Number(goal.current || 0) < Math.max(1, Number(goal.target) || 1)
    ).length;
    const recurringCompletedCount = sortedGoals.filter(
        (goal) => goal.isRecurring && Number(goal.current || 0) >= Number(goal.target || 0)
    ).length;
    const unlockedAchievementsCount = achievements.filter((achievement) => achievement.has_unlocked_before).length;
    const readyAchievementsCount = achievements.filter(
        (achievement) => achievement.current_milestone_complete ?? achievement.completed
    ).length;

    return (
        <div className="w-full min-w-0 max-w-full overflow-x-hidden p-4 md:p-6 space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="min-w-0 flex items-center justify-between gap-4"
            >
                <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                        <Target className="h-7 w-7 text-primary" /> Goals
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Track your personal goals with interactive visualizations
                    </p>
                </div>
                <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4" /> Add Goal
                </Button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="min-w-0 space-y-4"
            >
                <Card className="border-border bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--background)))]">
                    <CardContent className="p-4 md:p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Overview</p>
                                <p className="mt-2 text-sm text-foreground">
                                    Focus on the goals still moving, then use achievements as a separate reward layer.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <div className="rounded-2xl bg-background/80 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Active goals</p>
                                    <p className="mt-1 text-xl font-display font-bold text-foreground">{activeGoalsCount}</p>
                                </div>
                                <div className="rounded-2xl bg-background/80 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recurring done</p>
                                    <p className="mt-1 text-xl font-display font-bold text-foreground">{recurringCompletedCount}</p>
                                </div>
                                <div className="rounded-2xl bg-background/80 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Unlocked</p>
                                    <p className="mt-1 text-xl font-display font-bold text-foreground">{unlockedAchievementsCount}</p>
                                </div>
                                <div className="rounded-2xl bg-background/80 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ready now</p>
                                    <p className="mt-1 text-xl font-display font-bold text-foreground">{readyAchievementsCount}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border">
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                Goals Board Check-in
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Generate a quick board-level check-in to see which goals are on track and which need attention.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => handleLoadBoardAICheckin({ refresh: true })}
                            disabled={boardAILoading}
                        >
                            <RefreshCcw className="h-4 w-4 mr-2" />
                            {boardAILoading ? "Refreshing..." : boardAICheckin ? "Refresh" : "Generate"}
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {boardAICheckin ? (
                            <>
                                <div>
                                    <p className="font-medium text-foreground">{boardAICheckin.headline}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{boardAICheckin.summary}</p>
                                </div>

                                {(boardAICheckin.priorities || []).length ? (
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Priorities</p>
                                        <ul className="mt-2 list-disc pl-4 text-sm text-foreground space-y-1">
                                            {boardAICheckin.priorities.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(boardAICheckin.wins || []).length ? (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Wins</p>
                                            <ul className="mt-2 list-disc pl-4 text-sm text-foreground space-y-1">
                                                {boardAICheckin.wins.map((item) => (
                                                    <li key={item}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}

                                    {(boardAICheckin.risks || []).length ? (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Risks</p>
                                            <ul className="mt-2 list-disc pl-4 text-sm text-foreground space-y-1">
                                                {boardAICheckin.risks.map((item) => (
                                                    <li key={item}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        ) : null}
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="min-w-0"
            >
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-display text-xl font-bold text-foreground">Active Goals</h2>
                        <p className="text-sm text-muted-foreground">
                            Simplified cards with quick updates first, details on demand.
                        </p>
                    </div>
                </div>

                <div className="min-w-0 grid grid-cols-1 gap-6 auto-rows-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {isLoading ? (
                        <div className="col-span-full rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                            Loading goals...
                        </div>
                    ) : null}

                    {syncError ? (
                        <div className="col-span-full rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                            {syncError}
                        </div>
                    ) : null}

                    <AnimatePresence>
                        {sortedGoals.map((goal) => (
                            <GoalCard
                                key={goal.id}
                                goal={goal}
                                linkedAchievement={achievements.find((achievement) => achievement.entity_id === goal.id) || null}
                                onUpdateProgress={handleUpdateProgress}
                                onToggleTrainingDay={handleToggleTrainingDay}
                                onDelete={handleDeleteGoal}
                                isHighlighted={goal.id === highlightedGoalId}
                            />
                        ))}
                    </AnimatePresence>

                    <motion.button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="min-h-[300px] rounded-xl border-2 border-dashed border-border hover:border-primary bg-muted/30 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-3"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Plus className="h-6 w-6 text-primary" />
                        </div>
                        <span className="font-medium text-muted-foreground">Add New Goal</span>
                    </motion.button>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="min-w-0"
            >
                <div className="mb-4 flex items-center gap-3">
                    <Trophy className="h-6 w-6 text-status-todo" />
                    <div>
                        <h2 className="font-display text-xl font-bold text-foreground">Achievements</h2>
                        <p className="text-sm text-muted-foreground">
                            Progress toward the next milestone is separate from past unlock history.
                        </p>
                    </div>
                </div>
                <div className="min-w-0 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {achievements.map((achievement) => (
                        <AchievementCard key={achievement.id} achievement={achievement} />
                    ))}
                </div>
            </motion.div>

            {achievementTimeline.length ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="min-w-0"
                >
                    <div className="mb-4 flex items-center gap-3">
                        <Trophy className="h-6 w-6 text-primary" />
                        <div>
                            <h2 className="font-display text-xl font-bold text-foreground">Achievement Journey</h2>
                            <p className="text-sm text-muted-foreground">
                                A lighter timeline of the milestones you have already collected.
                            </p>
                        </div>
                    </div>
                    <AchievementTimelineJourney timeline={achievementTimeline} />
                </motion.div>
            ) : null}

            {!isLoading && goals.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                    <Target className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                        No goals yet
                    </h3>
                    <p className="text-muted-foreground mb-6">
                        Start tracking your progress by adding your first goal
                    </p>
                    <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" /> Add Your First Goal
                    </Button>
                </motion.div>
            )}

            <AddGoalDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onAddGoal={handleAddGoal}
            />
        </div>
    );
};

export default Goals;
