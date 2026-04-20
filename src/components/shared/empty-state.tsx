"use client";

import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${compact ? "py-10" : "py-16"} px-6 text-center`}>
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#0C5CAB]/10 to-transparent scale-150 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F3F4F6] dark:bg-[#1a1a22] border border-[#E9ECEF] dark:border-[#27272a]">
          {icon || <FileQuestion className="h-7 w-7 text-[#9CA3AF] dark:text-[#64748B]" />}
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-[#6B7280] dark:text-[#94A3B8] max-w-sm mb-5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="gradient-accent text-white cursor-pointer">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
