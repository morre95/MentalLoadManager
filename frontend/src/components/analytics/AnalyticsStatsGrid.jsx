import { motion } from "framer-motion";
import { Users, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export default function AnalyticsStatsGrid({ stats }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
            {(stats || []).slice(0, 4).map((stat, index) => {
                const Icon =
                    stat.icon === "Users"
                        ? Users
                        : stat.icon === "TrendingDown"
                            ? TrendingDown
                            : stat.icon === "TrendingUp"
                                ? TrendingUp
                                : CheckCircle2;

                const pillClass =
                    stat._trend === "up"
                        ? "bg-sage-light text-sage"
                        : stat._trend === "down"
                            ? "bg-terracotta-light text-terracotta"
                            : "bg-muted text-muted-foreground";

                return (
                    <Card key={`${stat.title}-${index}`} className="border-border">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                                </div>

                                {stat._changeText ? (
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pillClass}`}>
                                        {stat._changeText}
                                        {stat.compareLabel ? (
                                            <span className="ml-1 opacity-80">{stat.compareLabel}</span>
                                        ) : null}
                                    </span>
                                ) : null}
                            </div>

                            <div>
                                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </motion.div>
    );
}
