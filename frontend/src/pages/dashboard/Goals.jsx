import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import GoalCard from "@/components/goals/GoalCard";
import AddGoalDialog from "@/components/goals/AddGoalDialog";
import AchievementCard from "@/components/goals/AchievementCard";

const initialGoals = [
    {
        id: "1",
        type: "savings",
        name: "Emergency Fund",
        current: 2500,
        target: 5000,
        trackingStyle: "total",
        createdAt: new Date(),
    },
    {
        id: "2",
        type: "training",
        name: "Weekly Workouts",
        current: 3,
        target: 4,
        trackingStyle: "weekly",
        createdAt: new Date(),
    },
    {
        id: "3",
        type: "reading",
        name: "2026 Reading Challenge",
        current: 5,
        target: 12,
        trackingStyle: "total",
        createdAt: new Date(),
    },
    {
        id: "4",
        type: "hydration",
        name: "Stay Hydrated",
        current: 5,
        target: 8,
        trackingStyle: "daily",
        createdAt: new Date(),
    },
];

const achievements = [
    {
        id: "a1",
        title: "Category Champion",
        description: "Clear all tasks in the Cleaning category",
        icon: "trophy",
        current: 3,
        target: 5,
        category: "Tasks",
    },
    {
        id: "a2",
        title: "Equal Split",
        description: "Achieve a 50/50 split in household chores for a week",
        icon: "scale",
        current: 4,
        target: 7,
        category: "Balance",
    },
    {
        id: "a3",
        title: "Perfect Week",
        description: "Complete all tasks every day for a week",
        icon: "flame",
        current: 3,
        target: 7,
        category: "Consistency",
    },
    {
        id: "a4",
        title: "Task Master",
        description: "Complete 100 tasks total",
        icon: "star",
        current: 42,
        target: 100,
        category: "Tasks",
    },
    {
        id: "a5",
        title: "Early Bird",
        description: "Complete all tasks before their due date for 2 weeks",
        icon: "check",
        current: 8,
        target: 14,
        category: "Consistency",
    },
    {
        id: "a6",
        title: "Category Explorer",
        description: "Complete tasks in every category",
        icon: "target",
        current: 5,
        target: 7,
        category: "Tasks",
    },
];

const Goals = () => {
    const [goals, setGoals] = useState(initialGoals);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const handleAddGoal = (newGoal) => {
        setGoals((prev) => [...prev, newGoal]);
    };

    const handleUpdateProgress = (id, newValue) => {
        setGoals((prev) =>
            prev.map((goal) => (goal.id === id ? { ...goal, current: newValue } : goal))
        );
    };

    const handleDeleteGoal = (id) => {
        setGoals((prev) => prev.filter((goal) => goal.id !== id));
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
                <AnimatePresence>
                    {goals.map((goal) => (
                        <GoalCard
                            key={goal.id}
                            goal={goal}
                            onUpdateProgress={handleUpdateProgress}
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

            {goals.length === 0 && (
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