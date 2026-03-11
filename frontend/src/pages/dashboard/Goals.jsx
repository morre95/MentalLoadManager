import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GoalCard from "@/components/goals/GoalCard";
import AddGoalDialog from "@/components/goals/AddGoalDialog";
import AchievementCard from "@/components/goals/AchievementCard";
import {
    createGoal as createGoalRequest,
    deleteGoal as deleteGoalRequest,
    fetchAchievements as fetchAchievementsRequest,
    fetchGoals as fetchGoalsRequest,
    updateGoalProgress as updateGoalProgressRequest,
} from "@/lib/utils";

const TRAINING_STORAGE_KEY = "goal-training-days-v1";
const GOAL_MILESTONES_UPDATED_EVENT = "goals:changed";

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
    const [goals, setGoals] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [syncError, setSyncError] = useState(null);

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
                    ? achievementsData.achievements
                    : []
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
                        week_key: getCurrentWeekKey(),
                        training_days: Array(7).fill(false),
                    }
                    : {},
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
            const updatedGoal = await updateGoalProgressRequest(id, newValue);
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

    return (
        <div className="p-4 md:p-6 space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
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

            {/* Goals Grid - auto-sizing cards */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-auto"
            >
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
                    {goals.map((goal) => (
                        <GoalCard
                            key={goal.id}
                            goal={goal}
                            onUpdateProgress={handleUpdateProgress}
                            onToggleTrainingDay={handleToggleTrainingDay}
                            onDelete={handleDeleteGoal}
                        />
                    ))}
                </AnimatePresence>

                <motion.button
                    layout
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
            </motion.div>

            {/* Achievements Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="flex items-center gap-3 mb-4">
                    <Trophy className="h-6 w-6 text-status-todo" />
                    <h2 className="font-display text-xl font-bold text-foreground">Achievements</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {achievements.map((achievement) => (
                        <AchievementCard key={achievement.id} achievement={achievement} />
                    ))}
                </div>
            </motion.div>

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
