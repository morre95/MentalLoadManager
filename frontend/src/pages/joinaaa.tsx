import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { acceptHouseholdInvite, isUserLoggedIn } from "../lib/utils";

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

export default function JoinHousehold() {
    const query = useQuery();
    const navigate = useNavigate();
    const [status, setStatus] = useState("Joining…");
    const code = query.get("code");

    useEffect(() => {
        async function run() {
            if (!code) {
                setStatus("Missing invite code.");
                return;
            }

            // Not logged in -> store code and redirect to login
            if (!isUserLoggedIn()) {
                localStorage.setItem("pending_invite_code", code);
                navigate("/login", { replace: true });
                return;
            }

            try {
                await acceptHouseholdInvite(code);
                localStorage.removeItem("pending_invite_code");
                navigate("/dashboard/household", { replace: true });
            } catch (e) {
                setStatus("Could not accept invite.");
            }
        }

        run();
    }, [code, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-xl border border-border bg-card p-6">
                <h1 className="font-display text-xl font-bold text-foreground">Join household</h1>
                <p className="text-muted-foreground mt-2">{status}</p>
            </div>
        </div>
    );
}
