"use client";

import { useState, useTransition } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { acceptOrganizationInviteAction } from "@/actions/invites";
import { Button } from "@/components/ui/button";

export function InviteAcceptClient({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </div>
      ) : null}
      <Button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await acceptOrganizationInviteAction(token);

            if (!result.ok) {
              setMessage(result.message);
              return;
            }

            window.location.assign(result.data.redirectTo);
          });
        }}
        className="h-10 w-full border-0 bg-[#0C5CAB] font-semibold text-white shadow-[0_8px_24px_rgba(12,92,171,0.25)] hover:bg-[#0a4a8a]"
      >
        {isPending ? (
          <>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Accepting...
          </>
        ) : (
          <>
            Accept invite
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
