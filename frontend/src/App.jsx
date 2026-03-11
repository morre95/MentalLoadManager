import "./App.css";

import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import MoodTracker from "./pages/dashboard/MoodTracker";
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
            <Route path="mood" element={<MoodTracker />} />
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
