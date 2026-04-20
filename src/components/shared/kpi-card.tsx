"use client";

import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: ReactNode;
  subtitle?: string;
  accentColor?: string;
  hero?: boolean;
}

export function KpiCard({ label, value, change, changeType = "neutral", icon, subtitle, accentColor, hero = false }: KpiCardProps) {
  if (hero) {
    return (
      <Card className="relative p-5 rounded-2xl border-0 bg-[#0C5CAB] text-white cursor-default group overflow-hidden h-full flex flex-col justify-center">
        <div className="flex flex-col items-center justify-center text-center space-y-2 h-full">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 mb-1">
            {icon}
          </div>
          <p className="text-4xl font-extrabold tracking-tight leading-none">{value}</p>
          <p className="text-xs font-medium text-white/80 uppercase tracking-wide">{label}</p>

          {change && (
            <div className="flex items-center gap-1.5 pt-1">
              {changeType === "positive" && <TrendingUp className="h-3.5 w-3.5 text-[#93C5FD]" />}
              {changeType === "negative" && <TrendingDown className="h-3.5 w-3.5 text-red-300" />}
              {changeType === "neutral" && <Minus className="h-3.5 w-3.5 text-white/50" />}
              <span className="text-xs font-medium text-white/70">{change}</span>
            </div>
          )}
          {subtitle && <p className="text-xs text-white/60">{subtitle}</p>}
        </div>
        <button className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/70 hover:bg-white/25 transition-colors shrink-0 cursor-pointer">
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </Card>
    );
  }

  return (
    <Card className="relative p-5 rounded-2xl border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] hover:border-[#D1D5DB] dark:hover:border-[#3a3a42] hover:shadow-sm transition-all duration-200 cursor-default group h-full flex flex-col justify-center">
      <div className="flex flex-col items-center justify-center text-center space-y-2 h-full">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#F3F4F6] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] mb-1">
          {icon}
        </div>
        <p className="text-4xl font-extrabold tracking-tight text-[#1A1A2E] dark:text-[#fafafa] leading-none">{value}</p>
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wide">{label}</p>

        {change && (
          <div className="flex items-center gap-1.5 pt-1">
            {changeType === "positive" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
            {changeType === "negative" && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            {changeType === "neutral" && <Minus className="h-3.5 w-3.5 text-[#9CA3AF] dark:text-[#64748B]" />}
            <span className={`text-xs font-medium ${changeType === "positive" ? "text-emerald-600 dark:text-emerald-400" :
                changeType === "negative" ? "text-red-500 dark:text-red-400" : "text-[#6B7280] dark:text-[#94A3B8]"
              }`}>
              {change}
            </span>
          </div>
        )}
        {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{subtitle}</p>}
      </div>
      <button className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#E9ECEF] dark:border-[#27272a] text-[#9CA3AF] dark:text-[#64748B] hover:border-[#0C5CAB] dark:hover:border-[#3B82F6] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] transition-colors shrink-0 cursor-pointer">
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </Card>
  );
}
