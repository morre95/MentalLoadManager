import { motion } from "framer-motion";
import { Trophy, Star, CheckCircle, Scale, Flame, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const iconMap = {
    trophy: Trophy,
    star: Star,
    check: CheckCircle,
    scale: Scale,
    flame: Flame,
    target: Target,
};

const AchievementCard = ({ achievement }) => {
    const percentage = Math.min((achievement.current / achievement.target) * 100, 100);
    const isComplete = percentage >= 100;
    const Icon = iconMap[achievement.icon];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -2 }}
        >
            <Card className={`border-border overflow-hidden ${isComplete ? "ring-2 ring-sage/50" : ""}`}>
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <motion.div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isComplete ? "bg-sage text-primary-foreground" : "bg-muted text-muted-foreground"
                                }`}
                            animate={isComplete ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ repeat: isComplete ? Infinity : 0, duration: 2 }}
                        >
                            <Icon className="w-5 h-5" />
                        </motion.div>

                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground text-sm">{achievement.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">{achievement.description}</p>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-2">
                                {achievement.category}
                            </p>

                            <div className="mt-2">
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-muted-foreground">
                                        {achievement.current}/{achievement.target}
                                    </span>

                                    {isComplete && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-sage font-medium"
                                        >
                                            ✨ Complete!
                                        </motion.span>
                                    )}
                                </div>

                                <Progress value={percentage} className="h-1.5" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default AchievementCard;
