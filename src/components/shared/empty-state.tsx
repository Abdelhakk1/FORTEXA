import { isValidElement, type ReactNode } from "react";
import { LucideIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon | ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon = FileText,
  title,
  description,
  action,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const actionNode =
    action ??
    (actionLabel && onAction ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAction}
        className="border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a] dark:hover:text-[#60A5FA]"
      >
        {actionLabel}
      </Button>
    ) : null);
  const IconComponent = isValidElement(icon) ? null : (icon as LucideIcon);
  const iconNode = isValidElement(icon) ? icon : null;

  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E9ECEF] bg-white/50 text-center dark:border-[#27272a] dark:bg-[#141419]/50 ${compact ? "p-4 min-h-[120px]" : "p-10 min-h-[220px]"}`}>
      {icon && (
        <div className={`flex items-center justify-center rounded-full bg-[#F3F4F6] dark:bg-[#1a1a22] ${compact ? "h-10 w-10 mb-2" : "h-12 w-12 mb-4"}`}>
          {IconComponent ? (
            <IconComponent className={`${compact ? "h-5 w-5" : "h-6 w-6"} text-[#9CA3AF] dark:text-[#64748B]`} />
          ) : (
            iconNode
          )}
        </div>
      )}
      <h4 className="mb-1 text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{title}</h4>
      <p className={`max-w-sm text-xs text-[#6B7280] dark:text-[#94A3B8] ${compact ? "mb-0" : "mb-4"}`}>
        {description}
      </p>
      {actionNode && <div className={compact ? "mt-3" : ""}>{actionNode}</div>}
    </div>
  );
}
