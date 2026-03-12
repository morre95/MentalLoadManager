import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchMe } from "@/lib/utils";

export default function RequireAuth({ children }) {
  const location = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let alive = true;

    const checkAuth = async () => {
      const me = await fetchMe({ force: true });
      if (!alive) return;
      setIsAuthenticated(Boolean(me?.username));
      setIsCheckingAuth(false);
    };

    void checkAuth();

    return () => {
      alive = false;
    };
  }, []);

  if (isCheckingAuth) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
    }

  return children;
}
