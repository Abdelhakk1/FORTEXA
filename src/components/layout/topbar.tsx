"use client";

import { Bell, Search, Mail, Command, Sun, Moon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="shrink-0 z-30 h-16 bg-white dark:bg-[#0f0f13] border-b border-[#E9ECEF] dark:border-[#27272a]">
      <div className="flex h-full items-center justify-between px-6">
        {/* Left: Search */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF] dark:text-[#64748B]" />
          <Input
            type="text"
            placeholder="Search assets, CVEs, tasks..."
            className="pl-10 pr-16 h-10 bg-[#F3F4F6] dark:bg-[#1a1a22] border-transparent dark:border-[#27272a] rounded-full text-sm w-full focus:bg-white dark:focus:bg-[#141419] focus:border-[#E9ECEF] dark:focus:border-[#3a3a42] text-[#1A1A2E] dark:text-[#fafafa] placeholder:text-[#9CA3AF] dark:placeholder:text-[#64748B]"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
            <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] px-1.5 text-[10px] font-medium text-[#9CA3AF] dark:text-[#64748B]">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Messages */}
          <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] rounded-lg cursor-pointer">
            <Mail className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#6B7280] dark:text-[#94A3B8] transition-colors outline-none hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0C5CAB] text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0f0f13]">
                5
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a] shadow-lg">
              <div className="px-3 py-2.5 border-b border-[#F3F4F6] dark:border-[#27272a] flex items-center justify-between">
                <p className="font-semibold text-sm text-[#1A1A2E] dark:text-[#fafafa]">Notifications</p>
                <span className="text-xs text-[#9CA3AF] dark:text-[#64748B]">5 unread</span>
              </div>
              <DropdownMenuItem className="flex items-start gap-3 py-3 cursor-pointer focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22]">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">PrintNightmare SLA Breach</p>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">142 ATMs — 2 hours ago</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-start gap-3 py-3 cursor-pointer focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22]">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">PAN-OS Critical Vulnerability</p>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">Active exploitation — 4 hours ago</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-start gap-3 py-3 cursor-pointer focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22]">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">New scan import completed</p>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">Full ATM Fleet Scan — 6 hours ago</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#F3F4F6] dark:bg-[#27272a]" />
              <DropdownMenuItem className="text-center text-sm text-[#0C5CAB] dark:text-[#60A5FA] font-medium cursor-pointer justify-center focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22]">
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-10 w-10 p-0 text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] rounded-lg cursor-pointer"
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>

          {/* Divider */}
          <div className="h-8 w-px bg-[#E9ECEF] dark:bg-[#27272a] mx-2" />

          {/* User Avatar + Info */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22] focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-[#DBEAFE] dark:bg-[#0C5CAB]/30 text-[#0C5CAB] dark:text-[#60A5FA] text-xs font-semibold">AU</AvatarFallback>
              </Avatar>
              <div className="text-left hidden md:block">
                <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] leading-tight">Admin User</p>
                <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] leading-tight">admin@fortexa.com</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a] shadow-lg">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Admin User</p>
                <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">admin@fortexa.com</p>
              </div>
              <DropdownMenuSeparator className="bg-[#F3F4F6] dark:bg-[#27272a]" />
              <DropdownMenuItem className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22] focus:text-[#0C5CAB] dark:focus:text-[#60A5FA]">Profile</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-[#6B7280] dark:text-[#94A3B8] focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22] focus:text-[#0C5CAB] dark:focus:text-[#60A5FA]">Preferences</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#F3F4F6] dark:bg-[#27272a]" />
              <DropdownMenuItem className="text-red-500 cursor-pointer focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-600">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
