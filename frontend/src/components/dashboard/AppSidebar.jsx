import {
    LayoutDashboard,
    ListTodo,
    BarChart3,
    Calendar,
    Settings,
    Users,
    LogOut,
    Target,
} from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { clearAuth } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";


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
    { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
];

const teamItems = [
    { title: "Household", url: "/dashboard/household", icon: Users },
    { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
    const { state } = useSidebar();
    const collapsed = state === "collapsed";
    const navigate = useNavigate();

    const handleSignOut = () => {
        clearAuth();
        queryClient.clear();
        navigate("/", { replace: true });
    };

    return (
        <Sidebar collapsible="icon" className="border-r border-border">
            {/* Logo/Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary-foreground">M</span>
                </div>

                {!collapsed && (
                    <span className="font-display font-semibold text-foreground truncate">
                        Mental Load
                    </span>
                )}
            </div>

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
                                    <AvatarFallback className="bg-sage text-sage-light text-xs">
                                        MA
                                    </AvatarFallback>
                                </Avatar>

                                {!collapsed && (
                                    <div className="flex-1 text-left truncate">
                                        <p className="text-sm font-medium truncate">
                                            Maria Andersson
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            maria@example.com
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
