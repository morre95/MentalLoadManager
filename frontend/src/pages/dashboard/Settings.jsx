import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings as SettingsIcon,
  Bell,
  Palette,
  Shield,
  Globe,
  Tag,
  Plus,
  X,
  User,
  Lock,
  Monitor,
  Sun,
  Moon,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  Download,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { toast } from "@/components/ui/sonner";
import { getUserFromLocalStorage } from "@/lib/auth";
import {
  changeMyPassword,
  createHouseholdCategory,
  deleteHouseholdCategory,
  fetchPreferences,
  fetchHouseholds,
  fetchMe,
  fetchHouseholdCategories,
  fetchNotificationSettings,
  resolveCurrentHouseholdId,
  updateMe,
  updateNotificationSettings,
  updatePreferences,
} from "@/lib/utils";

const SectionCard = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="rounded-xl border border-border bg-card p-5 space-y-4"
  >
    {children}
  </motion.div>
);

const SectionHeader = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-3 pb-1">
    <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

const SettingRow = ({ label, description, children }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div className="min-w-0">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const CALENDAR_DATE_FORMAT_STORAGE_KEY = "calendar_date_format";
const CALENDAR_FIRST_DAY_STORAGE_KEY = "calendar_first_day_of_week";

const Settings = () => {
  const [categories, setCategories] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [currentHouseholdId, setCurrentHouseholdId] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [isLoadingHouseholds, setIsLoadingHouseholds] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [theme, setTheme] = useState("light");
  const [displayName, setDisplayName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState(true);
  const [taskReminders, setTaskReminders] = useState(true);
  const [goalMilestones, setGoalMilestones] = useState(true);
  const [householdUpdates, setHouseholdUpdates] = useState(false);
  const [isSavingNotificationSettings, setIsSavingNotificationSettings] = useState(false);
  const hasHydratedNotificationSettings = useRef(false);
  const [dateFormat, setDateFormat] = useState("mdy");
  const [firstDayOfWeek, setFirstDayOfWeek] = useState("monday");
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const hasHydratedPreferences = useRef(false);

  // Privacy
  const [profileVisible, setProfileVisible] = useState(true);
  const [activityVisible, setActivityVisible] = useState(true);

  useEffect(() => {
    let active = true;

    const hydrateProfile = async () => {
      const cached = getUserFromLocalStorage();
      if (cached && active) {
        setDisplayName(cached.display_name || "");
        setProfileEmail(cached.email || "");
      }

      const me = await fetchMe();
      if (active && me) {
        setDisplayName(me.display_name || "");
        setProfileEmail(me.email || "");
      }

      try {
        const preferences = await fetchPreferences();
        if (active && preferences) {
          const nextDateFormat = String(preferences.date_format || "mdy");
          const nextFirstDayOfWeek = String(preferences.first_day_of_week || "monday");
          setDateFormat(nextDateFormat);
          setFirstDayOfWeek(nextFirstDayOfWeek);
          localStorage.setItem(CALENDAR_DATE_FORMAT_STORAGE_KEY, nextDateFormat);
          localStorage.setItem(CALENDAR_FIRST_DAY_STORAGE_KEY, nextFirstDayOfWeek);
        }
      } catch {
        if (active && typeof window !== "undefined") {
          setDateFormat(localStorage.getItem(CALENDAR_DATE_FORMAT_STORAGE_KEY) || "mdy");
          setFirstDayOfWeek(localStorage.getItem(CALENDAR_FIRST_DAY_STORAGE_KEY) || "monday");
        }
      } finally {
        if (active) {
          hasHydratedPreferences.current = true;
        }
      }

      try {
        const settings = await fetchNotificationSettings();
        if (!active || !settings) return;

        setEmailNotifications(Boolean(settings.email_notifications));
        setTaskReminders(Boolean(settings.task_reminders));
        setGoalMilestones(Boolean(settings.goal_milestones));
        setHouseholdUpdates(Boolean(settings.household_updates));
        setWeeklyAnalytics(Boolean(settings.weekly_analytics_email));
      } catch {
        // Keep local defaults when settings are unavailable.
      } finally {
        if (active) {
          hasHydratedNotificationSettings.current = true;
        }
      }

    };

    hydrateProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const hydrateHouseholds = async () => {
      setIsLoadingHouseholds(true);
      try {
        const data = await fetchHouseholds();
        if (!active) return;

        const householdList = Array.isArray(data?.households) ? data.households : [];
        setHouseholds(householdList);

        const resolvedHouseholdId = await resolveCurrentHouseholdId();
        if (!active) return;

        const fallbackHouseholdId = householdList[0]?.household_id
          ? String(householdList[0].household_id)
          : null;
        setCurrentHouseholdId(resolvedHouseholdId || fallbackHouseholdId);
      } catch {
        if (active) {
          setHouseholds([]);
          setCurrentHouseholdId(null);
          toast.error("Could not load households");
        }
      } finally {
        if (active) {
          setIsLoadingHouseholds(false);
        }
      }
    };

    hydrateHouseholds();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const hydrateCategories = async () => {
      if (!currentHouseholdId) {
        setCategories([]);
        return;
      }

      setIsLoadingCategories(true);
      try {
        const data = await fetchHouseholdCategories(currentHouseholdId);
        if (!active) return;
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
      } catch {
        if (active) {
          setCategories([]);
          toast.error("Could not load household categories");
        }
      } finally {
        if (active) {
          setIsLoadingCategories(false);
        }
      }
    };

    hydrateCategories();

    return () => {
      active = false;
    };
  }, [currentHouseholdId]);

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (!currentHouseholdId) {
      toast.error("No household selected");
      return;
    }

    const exists = categories.some(
      (category) => String(category?.name || "").toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error(`Category "${trimmed}" already exists`);
      return;
    }

    setIsSavingCategory(true);
    try {
      const created = await createHouseholdCategory(currentHouseholdId, trimmed);
      setCategories((previous) => [...previous, created]);
      setNewCategory("");
      toast.success(`Category "${trimmed}" added`);
    } catch (error) {
      toast.error(error?.message || "Could not add category");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!currentHouseholdId) {
      toast.error("No household selected");
      return;
    }

    const categoryId = category?.category_id;
    const categoryName = category?.name || "Category";
    if (!categoryId) {
      toast.error("Could not delete category");
      return;
    }

    setDeletingCategoryId(categoryId);
    try {
      await deleteHouseholdCategory(currentHouseholdId, categoryId);
      setCategories((previous) =>
        previous.filter((item) => item.category_id !== categoryId)
      );
      toast.success(`Category "${categoryName}" removed`);
    } catch (error) {
      toast.error(error?.message || "Could not remove category");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleThemeChange = (value) => {
    setTheme(value);
    const root = document.documentElement;

    if (value === "dark") root.classList.add("dark");
    else if (value === "light") root.classList.remove("dark");
    else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    }

    toast.success(`Theme set to ${value}`);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error?.message || "Could not update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveProfile = async () => {
    const trimmedDisplayName = displayName.trim();
    const trimmedEmail = profileEmail.trim();

    setIsSavingProfile(true);
    try {
      const updated = await updateMe({
        display_name: trimmedDisplayName || null,
        email: trimmedEmail || null,
      });

      setDisplayName(updated?.display_name || "");
      setProfileEmail(updated?.email || "");
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error?.message || "Could not save profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveNotificationSettings = useCallback(async () => {
    setIsSavingNotificationSettings(true);
    try {
      const updated = await updateNotificationSettings({
        email_notifications: emailNotifications,
        task_reminders: taskReminders,
        goal_milestones: goalMilestones,
        household_updates: householdUpdates,
        weekly_analytics_email: weeklyAnalytics,
      });

      setEmailNotifications(Boolean(updated?.email_notifications));
      setTaskReminders(Boolean(updated?.task_reminders));
      setGoalMilestones(Boolean(updated?.goal_milestones));
      setHouseholdUpdates(Boolean(updated?.household_updates));
      setWeeklyAnalytics(Boolean(updated?.weekly_analytics_email));
    } catch (error) {
      toast.error(error?.message || "Could not save notification settings");
    } finally {
      setIsSavingNotificationSettings(false);
    }
  }, [
    emailNotifications,
    taskReminders,
    goalMilestones,
    householdUpdates,
    weeklyAnalytics,
  ]);

  const handleSavePreferences = useCallback(async () => {
    setIsSavingPreferences(true);
    try {
      const updated = await updatePreferences({
        date_format: dateFormat,
        first_day_of_week: firstDayOfWeek,
      });

      const nextDateFormat = String(updated?.date_format || "mdy");
      const nextFirstDayOfWeek = String(updated?.first_day_of_week || "monday");
      setDateFormat(nextDateFormat);
      setFirstDayOfWeek(nextFirstDayOfWeek);
      localStorage.setItem(CALENDAR_DATE_FORMAT_STORAGE_KEY, nextDateFormat);
      localStorage.setItem(CALENDAR_FIRST_DAY_STORAGE_KEY, nextFirstDayOfWeek);
    } catch (error) {
      toast.error(error?.message || "Could not save calendar preferences");
    } finally {
      setIsSavingPreferences(false);
    }
  }, [dateFormat, firstDayOfWeek]);

  useEffect(() => {
    if (!hasHydratedNotificationSettings.current) return;

    const timeout = setTimeout(() => {
      void handleSaveNotificationSettings();
    }, 300);

    return () => clearTimeout(timeout);
  }, [
    emailNotifications,
    taskReminders,
    goalMilestones,
    householdUpdates,
    weeklyAnalytics,
    handleSaveNotificationSettings,
  ]);

  useEffect(() => {
    if (!hasHydratedPreferences.current) return;

    const timeout = setTimeout(() => {
      void handleSavePreferences();
    }, 300);

    return () => clearTimeout(timeout);
  }, [dateFormat, firstDayOfWeek, handleSavePreferences]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <SettingsIcon className="h-7 w-7 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </motion.div>

      <div className="space-y-6">
        {/* Profile */}
        <SectionCard delay={0.05}>
          <SectionHeader icon={User} title="Profile" description="Your personal information" />
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Email</Label>
              <Input
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </SectionCard>

        {/* Security */}
        <SectionCard delay={0.1}>
          <SectionHeader icon={Lock} title="Security" description="Password and account protection" />
          <Separator />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">New Password</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </SectionCard>

        {/* Appearance */}
        <SectionCard delay={0.15}>
          <SectionHeader icon={Palette} title="Appearance" description="Theme and display settings" />
          <Separator />
          <SettingRow label="Theme" description="Choose between light, dark, or system preference">
            <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/50">
              {[
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="Compact mode" description="Reduce spacing for denser layouts">
            <Switch />
          </SettingRow>
        </SectionCard>

        {/* Language */}
        <SectionCard delay={0.2}>
          <SectionHeader icon={Globe} title="Calendar & Date" description="Calendar and date formatting" />
          <Separator />
          <SettingRow label="Date format" description="How dates are displayed">
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="First day of week">
            <Select value={firstDayOfWeek} onValueChange={setFirstDayOfWeek}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="saturday">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          {isSavingPreferences ? (
            <p className="text-xs text-muted-foreground text-right">Saving...</p>
          ) : null}
        </SectionCard>

        {/* Notifications */}
        <SectionCard delay={0.25}>
          <SectionHeader icon={Bell} title="Notifications" description="Control what alerts you receive" />
          <Separator />
          <SettingRow label="Email notifications" description="Receive updates via email">
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </SettingRow>
          <SettingRow label="Task reminders" description="Reminders before tasks are due">
            <Switch checked={taskReminders} onCheckedChange={setTaskReminders} />
          </SettingRow>
          <SettingRow label="Goal milestones" description="Celebrate when you hit milestones">
            <Switch checked={goalMilestones} onCheckedChange={setGoalMilestones} />
          </SettingRow>
          <SettingRow label="Household updates" description="When members complete or add tasks">
            <Switch checked={householdUpdates} onCheckedChange={setHouseholdUpdates} />
          </SettingRow>
          <Separator />
          <SettingRow label="Weekly analytics email" description="Summary of your household's progress every Monday">
            <Switch checked={weeklyAnalytics} onCheckedChange={setWeeklyAnalytics} />
          </SettingRow>
          {isSavingNotificationSettings ? (
            <p className="text-xs text-muted-foreground text-right">Saving...</p>
          ) : null}
        </SectionCard>

        {/* Task Categories */}
        <SectionCard delay={0.3}>
          <SectionHeader icon={Tag} title="Task Categories" description="Organize tasks into custom categories" />
          <Separator />
          <SettingRow label="Household" description="Choose which household categories to manage">
            <Select
              value={currentHouseholdId ?? undefined}
              onValueChange={setCurrentHouseholdId}
              disabled={isLoadingHouseholds || households.length === 0}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={isLoadingHouseholds ? "Loading households..." : "Select household"} />
              </SelectTrigger>
              <SelectContent>
                {(households || []).map((household) => (
                  <SelectItem key={household.household_id} value={String(household.household_id)}>
                    {household.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {categories.map((cat) => (
                <motion.div
                  key={cat.category_id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Badge variant="secondary" className="gap-1.5 py-1.5 px-3 text-sm">
                    {cat.name}
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      disabled={deletingCategoryId === cat.category_id}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="New category name..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAddCategory()}
              className="flex-1"
            />
            <Button
              onClick={() => void handleAddCategory()}
              size="sm"
              className="gap-1"
              disabled={!newCategory.trim() || isSavingCategory || isLoadingCategories}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          {isLoadingCategories ? (
            <p className="text-xs text-muted-foreground">Loading categories...</p>
          ) : null}
        </SectionCard>

        {/* Privacy */}
        <SectionCard delay={0.35}>
          <SectionHeader icon={Shield} title="Privacy" description="Control your visibility and data" />
          <Separator />
          <SettingRow label="Profile visible to household" description="Others can see your name and avatar">
            <Switch checked={profileVisible} onCheckedChange={setProfileVisible} />
          </SettingRow>
          <SettingRow label="Show activity status" description="Others can see when you complete tasks">
            <Switch checked={activityVisible} onCheckedChange={setActivityVisible} />
          </SettingRow>
        </SectionCard>

        {/* Data & Account */}
        <SectionCard delay={0.4}>
          <SectionHeader icon={Download} title="Data & Account" description="Export, logout, or delete your account" />
          <Separator />
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => toast.success("Export started — check your email shortly")}
            >
              <Download className="h-4 w-4" /> Export all my data
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => toast.success("Logged out")}
            >
              <LogOut className="h-4 w-4" /> Log out
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> Delete my account
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account, all tasks, goals, and household data.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => toast.error("Account deletion is not available in demo mode")}
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SectionCard>
      </div>

      <div className="h-8" />
    </div>
  );
};

export default Settings;
