import {
  LayoutDashboard,
  ListTodo,
  BarChart3,
  Calendar,
  Palette,
  Settings,
  Users,
  LogOut,
  Target,
  Sparkles,
} from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  apiFetch,
  getInitials,
} from "@/lib/utils";
import { clearAuth, getUserFromLocalStorage } from "@/lib/auth";


import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Tasks", url: "/dashboard/tasks", icon: ListTodo },
  { title: "Calendar", url: "/dashboard/calendar", icon: Calendar },
  { title: "Goals", url: "/dashboard/goals", icon: Target },
  { title: "Mood", url: "/dashboard/mood", icon: Palette },
  { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
  { title: "Summarys", url: "/dashboard/summarys", icon: Sparkles },
];

const teamItems = [
  { title: "Household", url: "/dashboard/household", icon: Users },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [user, setUser] = useState(() => getUserFromLocalStorage());
  const fullName = user.display_name || user.username || "User";
  const initials = getInitials(fullName);

  useEffect(() => {
    const syncUser = () => setUser(getUserFromLocalStorage());
    window.addEventListener("user:changed", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("user:changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await apiFetch("/api/v1/password/logout", { method: "POST" });
    } catch {
      // Ignore logout API errors and continue local cleanup.
    }

    clearAuth();
    queryClient.clear();
    navigate("/", { replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      {/* Logo/Header */}
      <NavLink
        to="/"
        className="flex items-center gap-3 p-4 border-b border-border no-underline"
      >
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary-foreground">M</span>
        </div>

        {!collapsed && (
          <span className="font-display font-semibold text-foreground truncate">
            Mental Load
          </span>
        )}
      </NavLink>

      {/* Sidebar Content */}
      <SidebarContent className="px-2">
        {/* Main */}
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Main
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}   // 👈 THIS LINE
                      className="flex items-center gap-3 no-underline text-foreground"
                      activeClassName="bg-sage-light text-sage font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Team */}
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Team
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {teamItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                      activeClassName="bg-sage-light text-sage font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border p-2">
        <SidebarMenu>
          {/* Profile */}
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full" tooltip="Profile">
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-sage text-sage-light text-sm font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {!collapsed && (
                  <div className="flex-1 text-left truncate">
                    <p className="text-sm font-medium truncate">
                      {fullName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email || ""}
                    </p>
                  </div>
                )}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Logout */}
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive"
              tooltip="Sign out"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
