import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search, Plus, Target, Clock3, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useHousehold } from "@/hooks/useHouseHold";
import AddTaskDialog from "@/components/tasks/AddTaskDialog";
import { fetchAchievements, fetchGoals, fetchInviteEmailNotifications, fetchNotificationSettings, fetchTaskReminderSummary } from "@/lib/utils";

const TASK_CREATED_EVENT = "kanban-task-created";
const GOAL_MILESTONES_UPDATED_EVENT = "goals:changed";
const GOAL_MILESTONE_SETTINGS_UPDATED_EVENT = "goal-milestones:settings-changed";
const NOTIFICATIONS_READ_STORAGE_KEY = "dashboard-notifications-read-v1";
const LEGACY_GOAL_MILESTONE_SEEN_STORAGE_KEY = "goal-milestone-notifications-seen-v1";

function firstLetter(name) {
  const s = String(name || "").trim();
  return s ? s[0].toUpperCase() : "?";
}

function readReadNotifications() {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(NOTIFICATIONS_READ_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    if (Array.isArray(parsedValue)) {
      return parsedValue.map(String);
    }

    const legacyRawValue = window.localStorage.getItem(LEGACY_GOAL_MILESTONE_SEEN_STORAGE_KEY);
    const legacyParsedValue = legacyRawValue ? JSON.parse(legacyRawValue) : [];
    return Array.isArray(legacyParsedValue) ? legacyParsedValue.map(String) : [];
  } catch {
    return [];
  }
}

function writeReadNotifications(ids) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIFICATIONS_READ_STORAGE_KEY, JSON.stringify(ids));
}

function getGoalMilestoneSignature(goal) {
  return `${goal.id}:${goal.target}`;
}

function formatNotificationDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString();
}

const DashboardHeader = ({ onAddTask }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { households, membersFlat: members } = useHousehold();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [goalMilestonesEnabled, setGoalMilestonesEnabled] = useState(true);
  const [taskRemindersEnabled, setTaskRemindersEnabled] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [readNotifications, setReadNotifications] = useState(readReadNotifications);
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

  const loadNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);

    try {
      const [settings, goalsData, achievementsData, taskReminderSummary, inviteEmailData] = await Promise.all([
        fetchNotificationSettings(),
        fetchGoals(),
        fetchAchievements(),
        fetchTaskReminderSummary(),
        fetchInviteEmailNotifications().catch(() => null),
      ]);

      const areGoalMilestonesEnabled = Boolean(settings?.goal_milestones);
      const areAchievementNotificationsEnabled = settings?.achievement_notifications ?? true;
      const areTaskRemindersEnabled = Boolean(taskReminderSummary?.task_reminders_enabled);
      setGoalMilestonesEnabled(areGoalMilestonesEnabled);
      setTaskRemindersEnabled(areTaskRemindersEnabled);

      const goals = Array.isArray(goalsData?.goals) ? goalsData.goals : [];
      const achievements = Array.isArray(achievementsData?.achievements) ? achievementsData.achievements : [];
      const goalMilestoneNotifications = goals
        .filter(
          (goal) =>
            areGoalMilestonesEnabled &&
            Number(goal?.current || 0) >= Number(goal?.target || 0),
        )
        .map((goal) => ({
          id: `goal-milestone:${getGoalMilestoneSignature(goal)}`,
          type: "goal_milestone",
          entityId: goal.id,
          title: goal.name,
          message: `Milestone reached: ${Number(goal.current || 0)} of ${Number(goal.target || 0)}`,
          actionLabel: "Open goal",
          createdAt: goal.createdAt instanceof Date ? goal.createdAt : null,
        }))
        .sort((a, b) => {
          const left = a.createdAt ? a.createdAt.getTime() : 0;
          const right = b.createdAt ? b.createdAt.getTime() : 0;
          return right - left;
        });

      const achievementNotifications = achievements
        .filter((achievement) => areAchievementNotificationsEnabled && Boolean(achievement?.completed))
        .map((achievement) => ({
          id: `achievement:${String(achievement?.completion_key || achievement?.id || "")}`,
          type: "achievement",
          entityId: achievement?.entity_id ? String(achievement.entity_id) : null,
          title: String(achievement?.title || "Achievement unlocked"),
          message: String(achievement?.description || "You completed an achievement."),
          actionLabel: achievement?.entity_id ? "Open goal" : "Open goals",
          createdAt: achievement?.unlocked_at ? new Date(achievement.unlocked_at) : null,
        }))
        .sort((a, b) => {
          const left = a.createdAt ? a.createdAt.getTime() : 0;
          const right = b.createdAt ? b.createdAt.getTime() : 0;
          return right - left;
        });

      const overdueTaskCount = Number(taskReminderSummary?.overdue_task_count || 0);
      const oldestOverdueTaskName = String(
        taskReminderSummary?.oldest_overdue_task_name || "task",
      ).trim();
      const oldestOverdueTaskDueDate = formatNotificationDate(
        taskReminderSummary?.oldest_overdue_task_due_date,
      );

      const taskReminderNotifications =
        areTaskRemindersEnabled && Boolean(taskReminderSummary?.should_notify) && overdueTaskCount > 0
          ? [
              {
                id: `task-reminder:${overdueTaskCount}:${taskReminderSummary?.oldest_overdue_task_id || "summary"}:${taskReminderSummary?.oldest_overdue_task_due_date || "none"}`,
                type: "task_reminder",
                entityId: taskReminderSummary?.oldest_overdue_task_id || null,
                title:
                  overdueTaskCount === 1
                    ? "1 overdue task"
                    : `${overdueTaskCount} overdue tasks`,
                message:
                  overdueTaskCount === 1
                    ? `${oldestOverdueTaskName} is overdue${oldestOverdueTaskDueDate ? ` since ${oldestOverdueTaskDueDate}` : ""}.`
                    : `${oldestOverdueTaskName} and ${overdueTaskCount - 1} more task${overdueTaskCount - 1 === 1 ? "" : "s"} are overdue.`,
                actionLabel: "Open tasks",
                createdAt: taskReminderSummary?.oldest_overdue_task_due_date
                  ? new Date(taskReminderSummary.oldest_overdue_task_due_date)
                  : null,
              },
            ]
          : [];

      const inviteEmailNotifications = (inviteEmailData?.notifications || []).map((n) => ({
        id: `invite-email:${n.id}`,
        type: "invite_email",
        status: n.status,
        title: n.status === "sent"
          ? `Invite sent to ${n.recipient_email}`
          : `Failed to send invite to ${n.recipient_email}`,
        message: n.status === "sent"
          ? `${n.recipient_email} was invited to join ${n.household_name}.`
          : `Could not send invite for ${n.household_name}. Please try again.`,
        actionLabel: n.status === "failed" ? "Open household" : null,
        entityId: null,
        createdAt: n.created_at ? new Date(n.created_at) : null,
      }));

      setNotifications([
        ...inviteEmailNotifications,
        ...taskReminderNotifications,
        ...achievementNotifications,
        ...goalMilestoneNotifications,
      ]);
    } catch {
      setGoalMilestonesEnabled(true);
      setTaskRemindersEnabled(true);
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const handleGoalUpdates = () => {
      void loadNotifications();
    };

    window.addEventListener(GOAL_MILESTONES_UPDATED_EVENT, handleGoalUpdates);
    window.addEventListener(GOAL_MILESTONE_SETTINGS_UPDATED_EVENT, handleGoalUpdates);
    window.addEventListener("auth:changed", handleGoalUpdates);

    return () => {
      window.removeEventListener(GOAL_MILESTONES_UPDATED_EVENT, handleGoalUpdates);
      window.removeEventListener(GOAL_MILESTONE_SETTINGS_UPDATED_EVENT, handleGoalUpdates);
      window.removeEventListener("auth:changed", handleGoalUpdates);
    };
  }, [loadNotifications]);

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

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !readNotifications.includes(notification.id)),
    [notifications, readNotifications]
  );

  const markNotificationsAsRead = useCallback((ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;

    setReadNotifications((currentIds) => {
      const nextIds = Array.from(new Set([...currentIds, ...ids.map(String)]));
      writeReadNotifications(nextIds);
      return nextIds;
    });
  }, []);

  const handleNotificationBellClick = async () => {
    const nextOpenState = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpenState);

    if (nextOpenState) {
      await loadNotifications();
    }
  };

  const handleNotificationItemClick = (notification) => {
    markNotificationsAsRead([notification.id]);
    setIsNotificationsOpen(false);
    if (notification.type === "goal_milestone") {
      navigate("/dashboard/goals", {
        state: {
          highlightGoalId: notification.entityId,
        },
      });
      return;
    }

    if (notification.type === "achievement") {
      navigate("/dashboard/goals", {
        state: notification.entityId
          ? {
              highlightGoalId: notification.entityId,
            }
          : {},
      });
      return;
    }

    if (notification.type === "task_reminder") {
      navigate("/dashboard/tasks");
      return;
    }

    if (notification.type === "invite_email") {
      navigate("/dashboard/household");
    }
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
              placeholder="Search tasks..."
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
              aria-label="Open notifications"
              aria-expanded={isNotificationsOpen}
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              {unreadNotifications.length > 0 ? (
                <>
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-terracotta" />
                  <span className="sr-only">
                    {unreadNotifications.length} unread notifications
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
                      <p className="text-sm font-semibold text-foreground">Notifications</p>
                      <p className="text-xs text-muted-foreground">
                        Updates from your workspace
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadNotifications.length > 0 ? (
                        <Badge variant="outline" className="shrink-0">
                          {unreadNotifications.length}
                        </Badge>
                      ) : null}
                      {unreadNotifications.length > 1 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => markNotificationsAsRead(unreadNotifications.map((notification) => notification.id))}
                        >
                          Mark all as read
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {isLoadingNotifications ? (
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                        Loading notifications...
                      </div>
                    ) : !goalMilestonesEnabled && !taskRemindersEnabled ? (
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-4">
                        <p className="text-sm font-medium text-foreground">
                          Notifications are off
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Turn on goal milestones or task reminders in Settings to see updates here.
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
                    ) : unreadNotifications.length === 0 ? (
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-4">
                        <p className="text-sm font-medium text-foreground">No new notifications</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Goal milestones and overdue task reminders will show up here.
                        </p>
                      </div>
                    ) : (
                      unreadNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="rounded-lg border border-border bg-background px-3 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 rounded-lg p-2 ${notification.type === "invite_email" && notification.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                              {notification.type === "task_reminder" ? (
                                <Clock3 className="h-4 w-4" />
                              ) : notification.type === "invite_email" ? (
                                <Mail className="h-4 w-4" />
                              ) : (
                                <Target className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {notification.title}
                                </p>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {notification.message}
                              </p>
                              <div className="mt-3 flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-primary hover:text-primary"
                                  onClick={() => handleNotificationItemClick(notification)}
                                >
                                  {notification.actionLabel}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => markNotificationsAsRead([notification.id])}
                                >
                                  Mark as read
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
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
