"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SearchInput({ placeholder = "Search...", value, onChange, className = "" }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF] dark:text-[#64748B]" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 h-9 bg-[#F9FAFB] dark:bg-[#1a1a22] border-[#E9ECEF] dark:border-[#27272a] text-sm text-[#1A1A2E] dark:text-[#fafafa] placeholder:text-[#9CA3AF] dark:placeholder:text-[#64748B] focus:bg-white dark:border-[#27272a] dark:bg-[#0f0f13] dark:focus:bg-[#141419]"
      />
    </div>
  );
}
