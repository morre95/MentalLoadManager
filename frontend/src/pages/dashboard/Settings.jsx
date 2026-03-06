import { useEffect, useMemo, useState } from "react";
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
import { useHousehold } from "@/hooks/useHouseHold";
import {
    changeMyPassword,
    createHouseholdCategory,
    deleteHouseholdCategory,
    fetchHouseholdCategories,
    fetchMe,
    getUserFromLocalStorage,
    updateMe,
} from "@/lib/utils";

const languages = [
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
    { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" },
    { value: "pt", label: "Português" },
    { value: "nl", label: "Nederlands" },
    { value: "sv", label: "Svenska" },
];

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

const Settings = () => {
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState("");
    const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [categoryIdBeingDeleted, setCategoryIdBeingDeleted] = useState("");
    const [meUsername, setMeUsername] = useState("");
    const [language, setLanguage] = useState("en");
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
    const [pushNotifications, setPushNotifications] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [weeklyAnalytics, setWeeklyAnalytics] = useState(true);
    const [taskReminders, setTaskReminders] = useState(true);
    const [goalMilestones, setGoalMilestones] = useState(true);
    const [householdUpdates, setHouseholdUpdates] = useState(false);

    // Privacy
    const [profileVisible, setProfileVisible] = useState(true);
    const [activityVisible, setActivityVisible] = useState(true);
    const { households } = useHousehold();

    const householdOptions = useMemo(() => {
        const list = Array.isArray(households) ? households : [];
        return list
            .map((household) => {
                const id = household?.household_id ?? household?.id;
                if (!id) return null;
                return {
                    id: String(id),
                    name: household?.name || "Unnamed household",
                    members: Array.isArray(household?.members) ? household.members : [],
                };
            })
            .filter(Boolean);
    }, [households]);

    const selectedHousehold = useMemo(
        () => householdOptions.find((household) => household.id === selectedHouseholdId) || null,
        [householdOptions, selectedHouseholdId]
    );

    const selectedHouseholdRole = useMemo(() => {
        if (!selectedHousehold) return "";
        const normalizedUsername = String(meUsername || "").trim().toLowerCase();
        const membership = selectedHousehold.members.find(
            (member) => String(member?.username || "").trim().toLowerCase() === normalizedUsername
        );
        return String(membership?.role || "").toLowerCase();
    }, [meUsername, selectedHousehold]);

    const canManageCategories = selectedHouseholdRole === "owner" || selectedHouseholdRole === "admin";

    useEffect(() => {
        let active = true;

        const hydrateProfile = async () => {
            const cached = getUserFromLocalStorage();
            if (cached && active) {
                setDisplayName(cached.display_name || "");
                setProfileEmail(cached.email || "");
                setMeUsername(cached.username || "");
            }

            const me = await fetchMe();
            if (!active || !me) return;

            setDisplayName(me.display_name || "");
            setProfileEmail(me.email || "");
            setMeUsername(me.username || "");
        };

        hydrateProfile();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!Array.isArray(householdOptions) || householdOptions.length === 0) {
            setSelectedHouseholdId("");
            setCategories([]);
            return;
        }

        let localPreferredId = "";
        try {
            const raw = localStorage.getItem("household");
            const parsed = raw ? JSON.parse(raw) : null;
            localPreferredId = String(parsed?.household_id ?? parsed?.id ?? parsed ?? "");
        } catch {
            localPreferredId = "";
        }

        setSelectedHouseholdId((previousHouseholdId) => {
            if (previousHouseholdId && householdOptions.some((household) => household.id === previousHouseholdId)) {
                return previousHouseholdId;
            }
            if (localPreferredId && householdOptions.some((household) => household.id === localPreferredId)) {
                return localPreferredId;
            }
            return householdOptions[0].id;
        });
    }, [householdOptions]);

    useEffect(() => {
        if (!selectedHouseholdId) {
            setCategories([]);
            return;
        }

        let cancelled = false;

        const loadCategories = async () => {
            setCategoriesLoading(true);
            try {
                const data = await fetchHouseholdCategories(selectedHouseholdId);
                if (cancelled) return;
                const nextCategories = Array.isArray(data?.categories) ? data.categories : [];
                setCategories(
                    nextCategories.map((category) => ({
                        category_id: String(category?.category_id || ""),
                        name: String(category?.name || ""),
                    }))
                );
            } catch (error) {
                if (cancelled) return;
                setCategories([]);
                toast.error(error?.message || "Could not load categories");
            } finally {
                if (!cancelled) setCategoriesLoading(false);
            }
        };

        loadCategories();

        return () => {
            cancelled = true;
        };
    }, [selectedHouseholdId]);

    const handleAddCategory = async () => {
        const trimmed = newCategory.trim();
        if (!trimmed || !selectedHouseholdId) return;

        if (!canManageCategories) {
            toast.error("Only household owners and admins can add categories");
            return;
        }

        const exists = categories.some((category) => category.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) {
            toast.error("Category already exists in this household");
            return;
        }

        setIsAddingCategory(true);
        try {
            const created = await createHouseholdCategory(selectedHouseholdId, trimmed);
            setCategories((previousCategories) => [
                ...previousCategories,
                {
                    category_id: String(created?.category_id || crypto.randomUUID()),
                    name: String(created?.name || trimmed),
                },
            ]);
            setNewCategory("");
            toast.success(`Category "${trimmed}" added`);
        } catch (error) {
            toast.error(error?.message || "Could not add category");
        } finally {
            setIsAddingCategory(false);
        }
    };

    const handleDeleteCategory = async (category) => {
        if (!selectedHouseholdId || !category?.category_id) return;

        if (!canManageCategories) {
            toast.error("Only household owners and admins can delete categories");
            return;
        }

        setCategoryIdBeingDeleted(category.category_id);
        try {
            await deleteHouseholdCategory(selectedHouseholdId, category.category_id);
            setCategories((previousCategories) =>
                previousCategories.filter((entry) => entry.category_id !== category.category_id)
            );
            toast.success(`Category "${category.name}" removed`);
        } catch (error) {
            toast.error(error?.message || "Could not remove category");
        } finally {
            setCategoryIdBeingDeleted("");
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

    const handleLanguageChange = (value) => {
        setLanguage(value);
        const lang = languages.find((l) => l.value === value);
        toast.success(`Language changed to ${lang?.label}`);
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
                    <SectionHeader icon={Globe} title="Language & Region" description="Interface language and formatting" />
                    <Separator />
                    <SettingRow label="Language" description="Choose your preferred language">
                        <Select value={language} onValueChange={handleLanguageChange}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {languages.map((lang) => (
                                    <SelectItem key={lang.value} value={lang.value}>
                                        {lang.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingRow>

                    <SettingRow label="Date format" description="How dates are displayed">
                        <Select defaultValue="mdy">
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
                        <Select defaultValue="monday">
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
                </SectionCard>

                {/* Notifications */}
                <SectionCard delay={0.25}>
                    <SectionHeader icon={Bell} title="Notifications" description="Control what alerts you receive" />
                    <Separator />
                    <SettingRow label="Push notifications" description="Get notified on your device">
                        <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
                    </SettingRow>
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
                </SectionCard>

                {/* Task Categories */}
                <SectionCard delay={0.3}>
                    <SectionHeader icon={Tag} title="Task Categories" description="Organize tasks into custom categories" />
                    <Separator />
                    <SettingRow label="Household" description="Choose which household these categories belong to">
                        <Select
                            value={selectedHouseholdId}
                            onValueChange={setSelectedHouseholdId}
                            disabled={householdOptions.length === 0}
                        >
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Select household" />
                            </SelectTrigger>
                            <SelectContent>
                                {householdOptions.map((household) => (
                                    <SelectItem key={household.id} value={household.id}>
                                        {household.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingRow>

                    {!selectedHouseholdId ? (
                        <p className="text-xs text-muted-foreground">Join or create a household to manage categories.</p>
                    ) : !canManageCategories ? (
                        <p className="text-xs text-muted-foreground">
                            You can view categories, but only household owners and admins can add or delete categories.
                        </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                        <AnimatePresence>
                            {categories.map((category) => (
                                <motion.div
                                    key={`${category.category_id}:${category.name}`}
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                >
                                    <Badge variant="secondary" className="gap-1.5 py-1.5 px-3 text-sm">
                                        {category.name}
                                        <button
                                            onClick={() => handleDeleteCategory(category)}
                                            className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                                            disabled={
                                                !canManageCategories ||
                                                categoryIdBeingDeleted === category.category_id
                                            }
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {categoriesLoading ? (
                        <p className="text-xs text-muted-foreground">Loading categories...</p>
                    ) : categories.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No categories saved for this household yet.</p>
                    ) : null}

                    <div className="flex gap-2">
                        <Input
                            placeholder="New category name..."
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                            className="flex-1"
                            disabled={!selectedHouseholdId || !canManageCategories || isAddingCategory}
                        />
                        <Button
                            onClick={handleAddCategory}
                            size="sm"
                            className="gap-1"
                            disabled={
                                !newCategory.trim() ||
                                !selectedHouseholdId ||
                                !canManageCategories ||
                                isAddingCategory
                            }
                        >
                            <Plus className="h-4 w-4" /> {isAddingCategory ? "Adding..." : "Add"}
                        </Button>
                    </div>
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
