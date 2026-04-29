"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className="gradient-accent border-0 text-white print:hidden"
    >
      <Printer className="mr-2 h-4 w-4" />
      Print
    </Button>
  );
}
