import "./App.css";

import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RequireAuth from "@/components/RequireAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineIndicator from "@/components/OfflineIndicator";
import { Toaster } from "@/components/ui/sonner";


// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import About from "./pages/About";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import HowItWorks from "./pages/HowItWorks";
import NotFound from "./pages/NotFound";
import Test from "./pages/Test";
import JoinHousehold from "./pages/JoinaHousehold";


// Dashboard pages
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/dashboard/Tasks";
import Calendar from "./pages/dashboard/Calendar";
import Goals from "./pages/dashboard/Goals";
import Analytics from "./pages/dashboard/Analytics";
import Household from "./pages/dashboard/Household";
import MoodTracker from "./pages/dashboard/MoodTracker";
import Settings from "./pages/dashboard/Settings";
import Summarys from "./pages/dashboard/Summarys";

// Layout
import DashboardLayout from "./layouts/DashboardLayout";

const queryClient = new QueryClient();
const THEME_STORAGE_KEY = "theme_preference";

function RouteBoundary({ title, description, children }) {
  return (
    <ErrorBoundary title={title} description={description}>
      {children}
    </ErrorBoundary>
  );
}

const App = () => {
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "system";

      if (storedTheme === "dark") {
        root.classList.add("dark");
        return;
      }

      if (storedTheme === "light") {
        root.classList.remove("dark");
        return;
      }

      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    };

    applyTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if ((localStorage.getItem(THEME_STORAGE_KEY) || "system") === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <OfflineIndicator />
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<RouteBoundary title="Home Unavailable"><Index /></RouteBoundary>} />
          <Route path="/login" element={<RouteBoundary title="Login Unavailable"><Login /></RouteBoundary>} />
          <Route path="/features" element={<RouteBoundary title="Features Unavailable"><Features /></RouteBoundary>} />
          <Route path="/pricing" element={<RouteBoundary title="Pricing Unavailable"><Pricing /></RouteBoundary>} />
          <Route path="/about" element={<RouteBoundary title="About Unavailable"><About /></RouteBoundary>} />
          <Route path="/contact" element={<RouteBoundary title="Contact Unavailable"><Contact /></RouteBoundary>} />
          <Route path="/how-it-works" element={<RouteBoundary title="How It Works Unavailable"><HowItWorks /></RouteBoundary>} />
          <Route path="/test" element={<RouteBoundary title="Test Page Unavailable"><Test /></RouteBoundary>} />
          <Route path="/join" element={<RouteBoundary title="Join Page Unavailable"><JoinHousehold /></RouteBoundary>} />

          {/* Dashboard layout wrapper */}

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <RouteBoundary
                  title="Dashboard Unavailable"
                  description="The dashboard shell failed to render. Reload and try again."
                >
                  <DashboardLayout />
                </RouteBoundary>
              </RequireAuth>
            }
          >
            <Route index element={<RouteBoundary title="Dashboard Unavailable"><Dashboard /></RouteBoundary>} />
            <Route path="tasks" element={<RouteBoundary title="Task Board Unavailable"><Tasks /></RouteBoundary>} />
            <Route path="calendar" element={<RouteBoundary title="Calendar Unavailable"><Calendar /></RouteBoundary>} />
            <Route path="goals" element={<RouteBoundary title="Goals Unavailable"><Goals /></RouteBoundary>} />
            <Route path="mood" element={<RouteBoundary title="Mood Tracker Unavailable"><MoodTracker /></RouteBoundary>} />
            <Route path="analytics" element={<RouteBoundary title="Analytics Unavailable"><Analytics /></RouteBoundary>} />
            <Route path="summarys" element={<RouteBoundary title="Summaries Unavailable"><Summarys /></RouteBoundary>} />
            <Route path="household" element={<RouteBoundary title="Household Unavailable"><Household /></RouteBoundary>} />
            <Route path="settings" element={<RouteBoundary title="Settings Unavailable"><Settings /></RouteBoundary>} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
};

export default App;
