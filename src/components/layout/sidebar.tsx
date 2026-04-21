"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type LucideIcon,
  LayoutDashboard, Server, Upload, Bug, Wrench, Bell, FileBarChart, Settings, ChevronRight, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SidebarDataProps {
  alertCount: number;
  userName: string;
  userRoleLabel: string;
  userInitials: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function getNavGroups(alertCount: number): NavGroup[] {
  return [
    {
      label: "MENU",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Assets", href: "/assets", icon: Server },
        { label: "Scan Import", href: "/scan-import", icon: Upload },
        { label: "Vulnerabilities", href: "/vulnerabilities", icon: Bug },
        { label: "Remediation", href: "/remediation", icon: Wrench },
        { label: "Alerts", href: "/alerts", icon: Bell, badge: alertCount },
      ],
    },
    {
      label: "GENERAL",
      items: [
        { label: "Reports", href: "/reports", icon: FileBarChart },
        { label: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];
}

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

function SidebarContent({
  mobile = false,
  onNavigate,
  alertCount,
  userName,
  userRoleLabel,
  userInitials,
}: SidebarProps & SidebarDataProps) {
  const pathname = usePathname();
  const navGroups = getNavGroups(alertCount);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0f0f13]">
      <div className="flex items-center px-5 h-16 border-b border-[#E9ECEF] dark:border-[#27272a] shrink-0">
        <span className="text-xl font-bold tracking-tight text-[#0C5CAB] dark:text-white heading-tight">
          Fortexa
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 mb-2.5 text-[10px] font-semibold tracking-[0.15em] text-[#9CA3AF] dark:text-[#64748B] uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer group",
                        isActive
                          ? "bg-[#EFF6FF] dark:bg-[#0C5CAB]/20 text-[#0C5CAB] dark:text-[#60A5FA]"
                          : "text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22] hover:text-[#374151] dark:hover:text-[#fafafa]"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-6 rounded-r-full bg-[#0C5CAB] dark:bg-[#3B82F6]" />
                      )}
                      <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-[#0C5CAB] dark:text-[#60A5FA]" : "text-[#9CA3AF] dark:text-[#64748B] group-hover:text-[#6B7280] dark:group-hover:text-[#94A3B8]")} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold bg-[#0C5CAB] text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Quick Actions Card */}
      <div className="px-3 pb-3 shrink-0">
        <div className="rounded-2xl bg-gradient-to-br from-[#0C5CAB] to-[#3B82F6] p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-[#93C5FD]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[#93C5FD]">Quick Actions</span>
          </div>
          <p className="text-xs text-white/80 mb-3 leading-relaxed">
            Import new scan results or generate a compliance report.
          </p>
          <Link
            href="/scan-import"
            onClick={onNavigate}
            className="flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg py-2 px-3 transition-colors w-full cursor-pointer backdrop-blur-sm"
          >
            Import Scan
          </Link>
        </div>
      </div>

      {/* User Profile */}
      <div className="border-t border-[#E9ECEF] dark:border-[#27272a] px-3 py-3 shrink-0">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22] transition-colors cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[#DBEAFE] dark:bg-[#0C5CAB]/30 text-[#0C5CAB] dark:text-[#60A5FA] text-xs font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-[#1A1A2E] dark:text-[#fafafa]">{userName}</p>
            <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] truncate">{userRoleLabel}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-[#D1D5DB] dark:text-[#64748B] shrink-0" />
        </div>
      </div>
      {mobile && <div className="h-3 shrink-0" />}
    </div>
  );
}

export function Sidebar(props: SidebarDataProps) {
  return (
    <aside className="z-40 hidden h-full w-[220px] shrink-0 flex-col border-r border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13] lg:flex">
      <SidebarContent {...props} />
    </aside>
  );
}

export { SidebarContent };
