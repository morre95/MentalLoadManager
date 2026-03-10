import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useHousehold } from "@/hooks/useHouseHold";
import AddTaskDialog from "@/components/tasks/AddTaskDialog";
import { fetchGoals, fetchNotificationSettings } from "@/lib/utils";

const TASK_CREATED_EVENT = "kanban-task-created";
const GOAL_MILESTONES_UPDATED_EVENT = "goals:changed";
const GOAL_MILESTONE_SETTINGS_UPDATED_EVENT = "goal-milestones:settings-changed";
const GOAL_MILESTONE_SEEN_STORAGE_KEY = "goal-milestone-notifications-seen-v1";

function firstLetter(name) {
  const s = String(name || "").trim();
  return s ? s[0].toUpperCase() : "?";
}

function readSeenGoalMilestones() {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(GOAL_MILESTONE_SEEN_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue.map(String) : [];
  } catch {
    return [];
  }
}

function writeSeenGoalMilestones(signatures) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GOAL_MILESTONE_SEEN_STORAGE_KEY, JSON.stringify(signatures));
}

function getGoalMilestoneSignature(goal) {
  return `${goal.id}:${goal.target}`;
}

const DashboardHeader = ({ onAddTask }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { households, membersFlat: members } = useHousehold();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [goalMilestonesEnabled, setGoalMilestonesEnabled] = useState(true);
  const [goalNotifications, setGoalNotifications] = useState([]);
  const [seenGoalMilestones, setSeenGoalMilestones] = useState(readSeenGoalMilestones);
  const notificationPanelRef = useRef(null);

  const handleAddClick = () => {
    setIsAddDialogOpen(true);
  };

  const handleTaskCreated = (newTask) => {
    if (onAddTask) onAddTask(newTask);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(TASK_CREATED_EVENT, { detail: newTask }));
    }
    if (location.pathname !== "/dashboard/tasks") {
      navigate("/dashboard/tasks");
    }
  };

  const loadGoalNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);

    try {
      const [settings, goalsData] = await Promise.all([
        fetchNotificationSettings(),
        fetchGoals(),
      ]);

      const areGoalMilestonesEnabled = Boolean(settings?.goal_milestones);
      setGoalMilestonesEnabled(areGoalMilestonesEnabled);

      if (!areGoalMilestonesEnabled) {
        setGoalNotifications([]);
        return;
      }

      const goals = Array.isArray(goalsData?.goals) ? goalsData.goals : [];
      const notifications = goals
        .filter((goal) => Number(goal?.current || 0) >= Number(goal?.target || 0))
        .map((goal) => ({
          id: getGoalMilestoneSignature(goal),
          goalId: goal.id,
          title: goal.name,
          current: Number(goal.current || 0),
          target: Number(goal.target || 0),
          createdAt: goal.createdAt instanceof Date ? goal.createdAt : null,
        }))
        .sort((a, b) => {
          const left = a.createdAt ? a.createdAt.getTime() : 0;
          const right = b.createdAt ? b.createdAt.getTime() : 0;
          return right - left;
        });

      setGoalNotifications(notifications);
    } catch {
      setGoalNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    loadGoalNotifications();
  }, [loadGoalNotifications]);

  useEffect(() => {
    const handleGoalUpdates = () => {
      void loadGoalNotifications();
    };

    window.addEventListener(GOAL_MILESTONES_UPDATED_EVENT, handleGoalUpdates);
    window.addEventListener(GOAL_MILESTONE_SETTINGS_UPDATED_EVENT, handleGoalUpdates);
    window.addEventListener("auth:changed", handleGoalUpdates);

    return () => {
      window.removeEventListener(GOAL_MILESTONES_UPDATED_EVENT, handleGoalUpdates);
      window.removeEventListener(GOAL_MILESTONE_SETTINGS_UPDATED_EVENT, handleGoalUpdates);
      window.removeEventListener("auth:changed", handleGoalUpdates);
    };
  }, [loadGoalNotifications]);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const handlePointerDown = (event) => {
      if (!notificationPanelRef.current?.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (!isNotificationsOpen || goalNotifications.length === 0) return;

    const nextSeenMilestones = Array.from(new Set([
      ...seenGoalMilestones,
      ...goalNotifications.map((notification) => notification.id),
    ]));

    setSeenGoalMilestones(nextSeenMilestones);
    writeSeenGoalMilestones(nextSeenMilestones);
  }, [goalNotifications, isNotificationsOpen, seenGoalMilestones]);

  const unreadGoalNotifications = useMemo(
    () => goalNotifications.filter((notification) => !seenGoalMilestones.includes(notification.id)),
    [goalNotifications, seenGoalMilestones]
  );

  const handleNotificationBellClick = async () => {
    const nextOpenState = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpenState);

    if (nextOpenState) {
      await loadGoalNotifications();
    }
  };

  const handleNotificationItemClick = () => {
    setIsNotificationsOpen(false);
    navigate("/dashboard/goals");
  };

  const avatarColors = [
    "bg-sage text-sage-light",
    "bg-terracotta text-white",
  ];

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

          <div className="hidden md:flex items-center gap-2 relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="earch tasks..."
              className="w-64 pl-9 h-9 bg-muted/50 border-transparent focus:border-border"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={handleAddClick}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Task</span>
          </Button>

          <div className="relative" ref={notificationPanelRef}>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => void handleNotificationBellClick()}
              aria-label="Open goal milestone notifications"
              aria-expanded={isNotificationsOpen}
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              {unreadGoalNotifications.length > 0 ? (
                <>
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-terracotta" />
                  <span className="sr-only">
                    {unreadGoalNotifications.length} unread goal milestone notifications
                  </span>
                </>
              ) : null}
            </Button>

            <AnimatePresence>
              {isNotificationsOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-12 z-50 w-[22rem] rounded-xl border border-border bg-card p-4 shadow-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Goal milestones</p>
                      <p className="text-xs text-muted-foreground">
                        Updates from your goal trackers
                      </p>
                    </div>
                    {goalMilestonesEnabled && goalNotifications.length > 0 ? (
                      <Badge variant="outline" className="shrink-0">
                        {goalNotifications.length}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-2">
                    {isLoadingNotifications ? (
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                        Loading notifications...
                      </div>
                    ) : !goalMilestonesEnabled ? (
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-4">
                        <p className="text-sm font-medium text-foreground">
                          Goal milestone notifications are off
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Turn them on in Settings to get alerts here when a goal reaches its target.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            navigate("/dashboard/settings");
                          }}
                        >
                          Open Settings
                        </Button>
                      </div>
                    ) : goalNotifications.length === 0 ? (
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-4">
                        <p className="text-sm font-medium text-foreground">No milestone notifications</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          You will see completed goal milestones here as they come in.
                        </p>
                      </div>
                    ) : (
                      goalNotifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={handleNotificationItemClick}
                          className="w-full rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                              <Target className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {notification.title}
                                </p>
                                {!seenGoalMilestones.includes(notification.id) ? (
                                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terracotta" />
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Milestone reached: {notification.current} of {notification.target}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                View the goal tracker for more details.
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="flex -space-x-2">
            {members.slice(0, 5).map((person, i) => {
              const colorClass = avatarColors[i % avatarColors.length];
              return (
                <Avatar
                  key={person.id ?? `${person.name ?? "member"}-${i}`}
                  className="h-8 w-8 ring-2 ring-background"
                >
                  <AvatarFallback className={`${colorClass} text-xs font-semibold`}>
                    {firstLetter(person.display_name ?? person.username)}
                  </AvatarFallback>
                </Avatar>
              );
            })}

            {members.length > 5 && (
              <Avatar className="h-8 w-8 ring-2 ring-background">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                  +{members.length - 5}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </header>

      <AddTaskDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddTask={handleTaskCreated}
        households={households}
      />
    </>
  );
};

export default DashboardHeader;
