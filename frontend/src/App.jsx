import "./App.css";

import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAuthToken } from "@/lib/auth";
import RequireAuth from "@/components/RequireAuth";


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
import Settings from "./pages/dashboard/Settings";

// Layout
import DashboardLayout from "./layouts/DashboardLayout";

const queryClient = new QueryClient();
const THEME_STORAGE_KEY = "theme_preference";

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

  // OAuth token from URL hash (Google, Facebook, etc)
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!token) return;

    setAuthToken(token, refreshToken || null);

    // Clean URL
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/test" element={<Test />} />
          <Route path="/join" element={<JoinHousehold />} />

          {/* Dashboard layout wrapper */}

          <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="goals" element={<Goals />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="household" element={<Household />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
