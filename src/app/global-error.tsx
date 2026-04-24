"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { ThemeInitScript } from "@/components/theme-init-script";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="h-full bg-background text-foreground" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <ThemeInitScript />
        <NextError statusCode={500} />
      </body>
    </html>
  );
}
