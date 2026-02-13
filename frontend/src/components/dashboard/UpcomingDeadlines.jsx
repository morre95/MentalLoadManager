import { motion } from "framer-motion";
import { AlertTriangle, Clock } from "lucide-react";

const deadlines = [
    { title: "Pay electricity bill", assignee: "Erik", due: "Today", urgent: true },
    { title: "Grocery shopping", assignee: "Maria", due: "Today", urgent: true },
    { title: "Dentist appointment", assignee: "Erik", due: "Tomorrow", urgent: false },
    { title: "School meeting", assignee: "Maria", due: "Feb 14", urgent: false },
    { title: "Car service", assignee: "Erik", due: "Feb 17", urgent: false },
];

const UpcomingDeadlines = () => {
    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">Deadlines</h3>
                <span className="text-xs text-muted-foreground">Upcoming</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
                {deadlines.map((item, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center gap-3 p-2.5 rounded-lg ${item.urgent ? "bg-terracotta-light" : "bg-muted/50"}`}
                    >
                        {item.urgent ? (
                            <AlertTriangle className="w-4 h-4 text-terracotta flex-shrink-0" />
                        ) : (
                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${item.urgent ? "text-terracotta" : "text-foreground"}`}>{item.title}</p>
                            <p className="text-[10px] text-muted-foreground">{item.assignee} · {item.due}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default UpcomingDeadlines;
