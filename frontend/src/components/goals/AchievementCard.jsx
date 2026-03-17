import { motion } from "framer-motion";
import { CheckCircle, Flame, Scale, Star, Target, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const iconMap = {
    trophy: Trophy,
    star: Star,
    check: CheckCircle,
    scale: Scale,
    flame: Flame,
    target: Target,
};

const rarityClasses = {
    common: "bg-muted text-muted-foreground",
    rare: "bg-sky-100 text-sky-700",
    epic: "bg-amber-100 text-amber-700",
    legendary: "bg-rose-100 text-rose-700",
};

const stateClasses = {
    progress: {
        card: "border-border bg-card",
        icon: "bg-muted text-muted-foreground",
        badge: "bg-muted text-muted-foreground",
        label: "In progress",
        helper: "Keep going toward the next unlock.",
    },
    ready: {
        card: "border-primary/30 bg-primary/5",
        icon: "bg-primary text-primary-foreground",
        badge: "bg-primary text-primary-foreground",
        label: "Unlocked now",
        helper: "Current milestone reached.",
    },
    previous: {
        card: "border-border bg-card",
        icon: "bg-amber-100 text-amber-700",
        badge: "bg-amber-100 text-amber-700",
        label: "Previously unlocked",
        helper: "You unlocked an earlier milestone and are now working on the next one.",
    },
};

const AchievementCard = ({ achievement }) => {
    const safeCurrent = Number(achievement.current) || 0;
    const safeTarget = Math.max(1, Number(achievement.target) || 1);
    const percentage = Math.min((safeCurrent / safeTarget) * 100, 100);
    const isCurrentMilestoneComplete = Boolean(
        achievement.current_milestone_complete ?? achievement.completed
    );
    const hasUnlockedBefore = Boolean(achievement.has_unlocked_before);
    const stateKey = isCurrentMilestoneComplete ? "ready" : hasUnlockedBefore ? "previous" : "progress";
    const state = stateClasses[stateKey];
    const Icon = iconMap[achievement.icon] || Trophy;
    const lastUnlockedLabel = achievement.last_unlocked_label
        ? `Last unlocked at ${achievement.last_unlocked_label}`
        : achievement.last_unlocked_at
        ? "Unlocked before"
        : null;

    return (
        <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={cn("h-full overflow-hidden transition-colors", state.card)}>
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div
                            className={cn(
                                "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl",
                                state.icon
                            )}
                        >
                            <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-sm font-semibold text-foreground">{achievement.title}</h4>
                                        <span
                                            className={cn(
                                                "rounded-full px-2 py-1 text-[11px] font-medium",
                                                state.badge
                                            )}
                                        >
                                            {state.label}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{achievement.description}</p>
                                </div>

                                <span
                                    className={cn(
                                        "rounded-full px-2 py-1 text-[11px] font-medium capitalize",
                                        rarityClasses[achievement.rarity] || rarityClasses.common
                                    )}
                                >
                                    {achievement.rarity}
                                </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                                <span>{achievement.category}</span>
                                <span>
                                    {safeCurrent}/{safeTarget}
                                </span>
                            </div>

                            <div className="mt-2">
                                <Progress value={percentage} className="h-2" />
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-foreground">{state.helper}</span>
                                {stateKey === "previous" && lastUnlockedLabel ? (
                                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                        {lastUnlockedLabel}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default AchievementCard;
