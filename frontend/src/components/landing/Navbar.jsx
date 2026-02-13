import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isUserLoggedIn, fetchMe as fetchUser } from "../../lib/utils";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];


const Navbar = () => {
  const [user, setUser] = useState (null);

  const refreshUser = async () => {
    if (!isUserLoggedIn()) {
      setUser(null);
      return;
    }
    const user = await fetchUser();
    setUser(user);
  };

  useEffect(() => {
    // run once on mount
    refreshUser();

    // listen to custom auth event
    const handler = () => refreshUser();
    window.addEventListener("auth:changed", handler);

    return () => window.removeEventListener("auth:changed", handler);
  }, []);

  const loggedIn = isUserLoggedIn();

  return (
        <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">M</span>
            </div>
            <span className="font-display font-semibold text-lg hidden sm:block">
              Mental Load Manager
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {loggedIn && user ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition"
              >
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                    {(user?.username?.[0] || "?").toUpperCase()}
                </div>

                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-sm font-medium text-foreground">
                    {user.username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </Link>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/login">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default Navbar;
