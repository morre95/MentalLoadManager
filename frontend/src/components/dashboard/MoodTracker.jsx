import { useState } from "react";
import { motion } from "framer-motion";

const moods = [
    { emoji: "😫", label: "Stressed", value: 1 },
    { emoji: "😕", label: "Meh", value: 2 },
    { emoji: "😊", label: "Good", value: 3 },
    { emoji: "😄", label: "Great", value: 4 },
    { emoji: "🤩", label: "Amazing", value: 5 },
];

const weekHistory = [
    { day: "Mon", mood: 3 },
    { day: "Tue", mood: 4 },
    { day: "Wed", mood: 2 },
    { day: "Thu", mood: 4 },
    { day: "Fri", mood: 5 },
    { day: "Sat", mood: 3 },
    { day: "Sun", mood: null },
];

const moodColors = ["", "bg-terracotta", "bg-[hsl(var(--status-todo))]", "bg-[hsl(var(--sand))]", "bg-sage", "bg-primary"];

const MoodTracker = () => {
    const [todayMood, setTodayMood] = useState < number | null > (null);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">Mood</h3>
                <span className="text-xs text-muted-foreground">How are you?</span>
            </div>

            <div className="flex justify-between gap-1 mb-4">
                {moods.map((mood) => (
                    <motion.button
                        key={mood.value}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setTodayMood(mood.value)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${todayMood === mood.value ? "bg-primary/10 ring-2 ring-primary/30" : "hover:bg-muted/50"
                            }`}
                    >
                        <span className="text-xl">{mood.emoji}</span>
                        <span className="text-[9px] text-muted-foreground">{mood.label}</span>
                    </motion.button>
                ))}
            </div>

            <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-2">This week</p>
                <div className="flex items-end gap-1.5 h-16">
                    {weekHistory.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                                className={`w-full rounded-sm transition-all ${day.mood ? moodColors[day.mood] : "bg-muted/30 border border-dashed border-border"}`}
                                style={{ height: day.mood ? `${day.mood * 12}px` : "8px" }}
                            />
                            <span className="text-[9px] text-muted-foreground">{day.day}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MoodTracker;
