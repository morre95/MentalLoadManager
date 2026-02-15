// src/pages/dashboard/Household.jsx
import { motion } from "framer-motion";
import { Users, UserPlus, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useHousehold, createHouseholdInvite } from "@/hooks/useHousehold";

function initialsFromUsername(username) {
    const parts = String(username || "")
        .replace(/[_-]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

const colors = ["bg-sage text-sage-light", "bg-terracotta text-white"];

function displayNameFromUsername(username) {
    return String(username || "")
        .trim()
        .replace(/[_-]+/g, " ") // maria_eriksson -> maria eriksson
        .replace(/\s+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1)) // Maria Eriksson
        .join(" ");
}

export default function Household() {
    // ✅ updated hook shape: households[]
    const { households, loading, error } = useHousehold();

    const [inviteUrl, setInviteUrl] = useState("");
    const [copied, setCopied] = useState(false);
    const [inviting, setInviting] = useState(false);

    const handleInvite = async () => {
        setInviting(true);
        setCopied(false);

        try {
            const data = await createHouseholdInvite(household.household_id);

            setInviteUrl(data.invite_url);

            await navigator.clipboard.writeText(data.invite_url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (e) {
            console.error(e);
            alert(e?.message || "Could not create invite");
        } finally {
            setInviting(false);
        }
    };


    return (
        <div className="p-4 md:p-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-6"
            >
                <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                        <Users className="h-7 w-7 text-primary" />
                        Household
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your household members
                    </p>

                    {loading && (
                        <p className="text-sm text-muted-foreground mt-2">Loading…</p>
                    )}
                    {error && (
                        <p className="text-sm text-destructive mt-2">
                            {error?.message || "Failed to load households"}
                        </p>
                    )}
                </div>

                <Button className="gap-2" onClick={handleInvite} disabled={inviting}>
                    <UserPlus className="h-4 w-4" />
                    {inviting ? "Creating…" : "Invite Member"}
                </Button>
            </motion.div>

            {inviteUrl ? (
                <div className="mb-6 rounded-xl border border-border bg-card p-4 flex items-center gap-3 justify-between">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Invite link</p>
                        <p className="text-sm text-muted-foreground truncate">{inviteUrl}</p>
                    </div>

                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={async () => {
                            await navigator.clipboard.writeText(inviteUrl);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        }}
                    >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied" : "Copy"}
                    </Button>
                </div>
            ) : null}

            {/* ✅ Multiple households, clearly separated */}
            <div className="space-y-8">
                {(households || []).map((h) => (
                    <motion.section
                        key={h.household_id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-baseline justify-between">
                            <h2 className="font-display text-xl font-bold text-foreground">
                                {h.name}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {h.members?.length ?? 0} member{(h.members?.length ?? 0) === 1 ? "" : "s"}
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {(h.members || []).map((member, idx) => (
                                <div
                                    // ✅ HERE is the key fix:
                                    key={`${h.household_id}:${member.user_id}`}
                                    className="p-4 rounded-xl border border-border bg-card flex items-center gap-4"
                                >
                                    <Avatar className="h-12 w-12">
                                        <AvatarFallback
                                            className={`${colors[idx % colors.length]} font-semibold`}
                                        >
                                            {initialsFromUsername(member.username)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="min-w-0">
                                        <p className="font-medium text-foreground truncate">
                                            {displayNameFromUsername(member.username)}
                                        </p>
                                        {member.email ? (
                                            <p className="text-sm text-muted-foreground truncate">
                                                {member.email}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.section>
                ))}

                {!loading && !error && (households || []).length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
                        You’re not in a household yet.
                    </div>
                ) : null}
            </div>
        </div>
    );
}
