import { motion } from "framer-motion";
import { CheckCircle2, Plus, ArrowRight, MessageSquare } from "lucide-react";

const activities = [
    { icon: CheckCircle2, text: "Maria completed 'Grocery shopping'", time: "2h ago", color: "text-sage" },
    { icon: Plus, text: "Erik added 'Fix leaky faucet'", time: "4h ago", color: "text-sky" },
    { icon: ArrowRight, text: "Maria moved 'Clean bathroom' to In Progress", time: "5h ago", color: "text-status-doing" },
    { icon: CheckCircle2, text: "Erik completed 'Renew car insurance'", time: "Yesterday", color: "text-sage" },
    { icon: MessageSquare, text: "Maria added a note to 'Weekend trip'", time: "Yesterday", color: "text-lavender" },
];

const RecentActivity = () => {
    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">Recent Activity</h3>
                <span className="text-xs text-muted-foreground">Last 48h</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto">
                {activities.map((activity, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-start gap-3"
                    >
                        <activity.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${activity.color}`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground leading-snug">{activity.text}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{activity.time}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default RecentActivity;
