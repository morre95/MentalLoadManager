// src/components/dashboard/DashboardHeader.jsx
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";

function firstLetter(name) {
  const s = String(name || "").trim();
  return s ? s[0].toUpperCase() : "?";
}

const DashboardHeader = ({ onAddTask }) => {
  const navigate = useNavigate();
  const { members } = useHouseholdMembers();

  const handleAddClick = () => {
    if (onAddTask) onAddTask();
    else navigate("/dashboard/tasks");
  };

  const avatarColors = [
    "bg-sage text-sage-light",
    "bg-terracotta text-white",
  ];

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

        <div className="hidden md:flex items-center gap-2 relative">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="w-64 pl-9 h-9 bg-muted/50 border-transparent focus:border-border"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={handleAddClick}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Task</span>
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-terracotta rounded-full" />
        </Button>

        <div className="flex -space-x-2">
          {members.slice(0, 5).map((person, i) => {
            const colorClass = avatarColors[i % avatarColors.length]; // ✅ green/red alternating
            return (
              <Avatar
                key={person.id ?? `${person.name ?? "member"}-${i}`}
                className="h-8 w-8 ring-2 ring-background"
              >
                <AvatarFallback className={`${colorClass} text-xs font-semibold`}>
                  {firstLetter(person.display_name ?? person.username)}
                </AvatarFallback>
              </Avatar>
            );
          })}

          {members.length > 5 && (
            <Avatar className="h-8 w-8 ring-2 ring-background">
              <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                +{members.length - 5}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

      </div>
    </header>
  );
};

export default DashboardHeader;
