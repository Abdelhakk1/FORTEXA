"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-7 pb-1">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-sm text-[#6B7280] dark:text-[#94A3B8] mb-2">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#D1D5DB] dark:text-[#475569]" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] transition-colors cursor-pointer">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[#1A1A2E] dark:text-[#fafafa] font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-[#1A1A2E] dark:text-[#fafafa] heading-tight">{title}</h1>
        {description && <p className="text-sm text-[#6B7280] dark:text-[#64748B] mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 mt-3 sm:mt-0 shrink-0">{actions}</div>}
    </div>
  );
}
