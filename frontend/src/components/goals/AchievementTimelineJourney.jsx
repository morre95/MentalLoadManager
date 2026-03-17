import { Sparkles, Star, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const rarityStyles = {
    common: "border-border bg-card",
    rare: "border-sky-200 bg-sky-50/70",
    epic: "border-amber-200 bg-amber-50/70",
    legendary: "border-rose-200 bg-rose-50/70",
};

const formatDateLabel = (value) => {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
    }).format(parsed);
};

const groupTimelineItems = (timeline) => {
    const now = new Date();
    const oneDayAgo = new Date(now);
    const oneWeekAgo = new Date(now);
    oneDayAgo.setDate(now.getDate() - 1);
    oneWeekAgo.setDate(now.getDate() - 7);

    const groups = {
        Today: [],
        "This week": [],
        Earlier: [],
    };

    timeline.forEach((item) => {
        const unlockedAt = item?.unlocked_at ? new Date(item.unlocked_at) : null;
        if (!unlockedAt || Number.isNaN(unlockedAt.getTime())) {
            groups.Earlier.push(item);
            return;
        }

        if (unlockedAt >= oneDayAgo) {
            groups.Today.push(item);
            return;
        }

        if (unlockedAt >= oneWeekAgo) {
            groups["This week"].push(item);
            return;
        }

        groups.Earlier.push(item);
    });

    return Object.entries(groups).filter(([, items]) => items.length > 0);
};

const AchievementTimelineJourney = ({ timeline }) => {
    const groups = groupTimelineItems(timeline.slice(0, 12));

    if (!groups.length) {
        return null;
    }

    return (
        <div className="space-y-4">
            {groups.map(([label, items]) => (
                <Card key={label} className="overflow-hidden border-border bg-[linear-gradient(135deg,hsl(var(--muted)/0.55),hsl(var(--background)))]">
                    <CardContent className="p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
                                <p className="mt-1 text-sm text-foreground">
                                    {label === "Today"
                                        ? "Fresh unlocks on your path."
                                        : label === "This week"
                                        ? "Momentum worth keeping."
                                        : "Milestones you have already collected."}
                                </p>
                            </div>
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>

                        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] p-4">
                            <div className="absolute bottom-6 left-[1.45rem] top-6 w-px bg-[linear-gradient(180deg,hsl(var(--primary)/0.15),hsl(var(--primary)/0.5),hsl(var(--primary)/0.15))]" />
                            <div className="space-y-4">
                                {items.map((item) => (
                                    <div key={item.achievement_unlock_id} className="relative flex gap-4">
                                        <div className="relative z-10 mt-5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background ring-4 ring-background">
                                            <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.45)]" />
                                        </div>

                                        <div
                                            className={cn(
                                                "min-w-0 flex-1 rounded-3xl border p-4 shadow-sm backdrop-blur-sm",
                                                rarityStyles[item.rarity] || rarityStyles.common
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-primary shadow-sm">
                                                        {item.rarity === "legendary" ? (
                                                            <Trophy className="h-5 w-5" />
                                                        ) : (
                                                            <Star className="h-5 w-5" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                                                        <p className="mt-0.5 text-xs text-muted-foreground">{item.category}</p>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <span className="rounded-full bg-background/80 px-2 py-1 text-[11px] capitalize text-muted-foreground">
                                                        {item.rarity}
                                                    </span>
                                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                                        {formatDateLabel(item.unlocked_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default AchievementTimelineJourney;
