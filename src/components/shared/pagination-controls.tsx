"use client";

import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
}: PaginationControlsProps) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pages = getVisiblePages(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-[#E9ECEF] bg-[#FAFBFC] px-4 py-3 dark:border-[#27272a] dark:bg-[#0f0f13] sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
        Showing {start}-{end} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          className="h-7 border-[#E9ECEF] bg-[#F9FAFB] text-xs text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#64748B]"
          disabled={currentPage === 1}
        >
          Prev
        </Button>
        {pages.map((page, index) => {
          const showGap = index > 0 && page - pages[index - 1] > 1;

          return (
            <div key={page} className="flex items-center gap-1">
              {showGap && <span className="px-1 text-xs text-[#9CA3AF] dark:text-[#64748B]">…</span>}
              <Button
                size="sm"
                variant={page === currentPage ? "default" : "outline"}
                onClick={() => onPageChange(page)}
                className={
                  page === currentPage
                    ? "h-7 w-7 bg-[#0C5CAB] p-0 text-xs text-white hover:bg-[#0a4a8a] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB]"
                    : "h-7 w-7 border-[#E9ECEF] bg-white p-0 text-xs text-[#6B7280] hover:bg-[#EFF6FF] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22]"
                }
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </Button>
            </div>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          className="h-7 border-[#E9ECEF] bg-white text-xs text-[#6B7280] hover:bg-[#EFF6FF] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22]"
          disabled={currentPage === totalPages || totalPages === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
