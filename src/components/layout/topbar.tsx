"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, Mail, Command, Sun, Moon } from "lucide-react";
import { Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarContent } from "@/components/layout/sidebar";

interface TopbarAlertItem {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  relatedAsset: string;
  createdAt: string;
}

interface TopbarProps {
  unreadCount: number;
  recentAlerts: TopbarAlertItem[];
  userName: string;
  userEmail: string;
  userRoleLabel: string;
  userInitials: string;
}

export function Topbar({
  unreadCount,
  recentAlerts,
  userName,
  userEmail,
  userRoleLabel,
  userInitials,
}: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[280px] max-w-[280px] border-r border-[#E9ECEF] bg-white p-0 text-inherit dark:border-[#27272a] dark:bg-[#0f0f13]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Browse the Fortexa platform sections.</SheetDescription>
          </SheetHeader>
          <SidebarContent
            mobile
            onNavigate={() => setMenuOpen(false)}
            alertCount={unreadCount}
            userName={userName}
            userRoleLabel={userRoleLabel}
            userInitials={userInitials}
          />
        </SheetContent>
      </Sheet>

      <header className="sticky top-0 z-30 h-16 border-b border-[#E9ECEF] bg-white/95 backdrop-blur-sm dark:border-[#27272a] dark:bg-[#0f0f13]/95">
        <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              className="h-10 w-10 shrink-0 rounded-lg p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>

        {/* Left: Search */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF] dark:text-[#64748B]" />
              <Input
                type="text"
                aria-label="Search assets, CVEs, or tasks"
                placeholder="Search assets, CVEs, tasks..."
                className="h-10 w-full rounded-full border-transparent bg-[#F3F4F6] pl-10 pr-3 text-sm text-[#1A1A2E] placeholder:text-[#9CA3AF] focus:border-[#E9ECEF] focus:bg-white dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa] dark:placeholder:text-[#64748B] dark:focus:border-[#3a3a42] dark:focus:bg-[#141419] sm:pr-16"
              />
              <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 sm:flex">
                <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-[#E9ECEF] bg-white px-1.5 text-[10px] font-medium text-[#9CA3AF] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#64748B]">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              </div>
            </div>
          </div>

        {/* Right: Actions */}
          <div className="flex shrink-0 items-center gap-1">
          {/* Messages */}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open messages"
              className="h-10 w-10 rounded-lg p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]"
            >
            <Mail className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Open notifications, ${unreadCount} unread`}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#6B7280] transition-colors outline-none hover:bg-[#EFF6FF] hover:text-[#0C5CAB] focus-visible:ring-2 focus-visible:ring-ring dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]"
              >
              <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0C5CAB] px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0f0f13]">
                    {unreadCount}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 border-[#E9ECEF] bg-white shadow-lg dark:border-[#27272a] dark:bg-[#141419]">
                <div className="flex items-center justify-between border-b border-[#F3F4F6] px-3 py-2.5 dark:border-[#27272a]">
                  <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Notifications</p>
                  <span className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{unreadCount} unread</span>
                </div>
                {recentAlerts.map((alert) => (
                  <DropdownMenuItem
                    key={alert.id}
                    className="flex items-start gap-3 py-3 cursor-pointer focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22]"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        alert.severity === "CRITICAL"
                          ? "bg-red-500"
                          : alert.severity === "HIGH"
                            ? "bg-orange-500"
                            : "bg-blue-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{alert.title}</p>
                      <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">
                        {alert.relatedAsset} • {alert.createdAt}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-[#F3F4F6] dark:bg-[#27272a]" />
                <DropdownMenuItem
                  onClick={() => router.push("/alerts")}
                  className="justify-center text-center text-sm font-medium text-[#0C5CAB] cursor-pointer focus:bg-[#EFF6FF] dark:text-[#60A5FA] dark:focus:bg-[#1a1a22]"
                >
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              className="h-10 w-10 rounded-lg p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]"
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>

          {/* Divider */}
            <div className="mx-1 hidden h-8 w-px bg-[#E9ECEF] dark:bg-[#27272a] sm:block" />

          {/* User Avatar + Info */}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors outline-none hover:bg-[#F9FAFB] focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-[#1a1a22] sm:px-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-[#DBEAFE] text-xs font-semibold text-[#0C5CAB] dark:bg-[#0C5CAB]/30 dark:text-[#60A5FA]">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left md:block">
                  <p className="text-sm font-semibold leading-tight text-[#1A1A2E] dark:text-[#fafafa]">{userName}</p>
                  <p className="text-xs leading-tight text-[#9CA3AF] dark:text-[#64748B]">{userEmail}</p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-[#E9ECEF] bg-white shadow-lg dark:border-[#27272a] dark:bg-[#141419]">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{userName}</p>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{userEmail}</p>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{userRoleLabel}</p>
                </div>
                <DropdownMenuSeparator className="bg-[#F3F4F6] dark:bg-[#27272a]" />
                <DropdownMenuItem className="cursor-pointer text-[#6B7280] focus:bg-[#EFF6FF] focus:text-[#0C5CAB] dark:text-[#94A3B8] dark:focus:bg-[#1a1a22] dark:focus:text-[#60A5FA]">Profile</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-[#6B7280] focus:bg-[#EFF6FF] focus:text-[#0C5CAB] dark:text-[#94A3B8] dark:focus:bg-[#1a1a22] dark:focus:text-[#60A5FA]">Preferences</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#F3F4F6] dark:bg-[#27272a]" />
                <form action="/auth/sign-out" method="post" className="px-1">
                  <button
                    type="submit"
                    className="flex w-full items-center rounded-md px-1.5 py-1 text-left text-sm text-red-500 outline-hidden transition-colors hover:bg-red-50 focus:bg-red-50 focus:text-red-600 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10"
                  >
                    Sign out
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
