import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Loader2 } from "lucide-react";

import DashboardHomeGrid from "@/components/dashboard/DashboardHomeGrid";
import { fetchMe } from "@/lib/utils";

function getGreeting(name) {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

const Dashboard = () => {
  const [displayName, setDisplayName] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      try {
        const me = await fetchMe();
        if (!active) return;
        setDisplayName(me?.display_name || me?.username || "there");
      } finally {
        if (active) {
          setLoadingUser(false);
        }
      }
    };

    loadUser();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-[linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.35),hsl(var(--background)))] p-6"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Workspace overview
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {loadingUser ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  Loading dashboard
                </span>
              ) : (
                getGreeting(displayName)
              )}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              This is your real dashboard home. It pulls live signals from tasks, calendar,
              goals, mood, analytics, summaries, household, and settings into one draggable workspace.
            </p>
          </div>
        </div>
      </motion.section>

      <DashboardHomeGrid />
    </div>
  );
};

export default Dashboard;
