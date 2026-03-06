import { Navigate, useLocation } from "react-router-dom";
import { isUserLoggedIn } from "@/lib/auth";

export default function RequireAuth({ children }) {
    const location = useLocation();

    if (!isUserLoggedIn()) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return children;
}
