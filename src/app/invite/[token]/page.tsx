import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AlertCircle, Mail, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getInviteAcceptanceError,
  getOrganizationInvitePreview,
} from "@/lib/services/team-invites";
import { getActiveOrganizationForUser } from "@/lib/services/organizations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteAcceptClient } from "./invite-accept-client";

type Params = Promise<{ token: string }>;

function formatExpiration(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function InviteShell({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F8FAFC] px-6 py-10">
      <Card className="w-full max-w-[460px] rounded-2xl border border-[#E9ECEF] bg-white p-6 shadow-sm">
        <Image
          src="/pics/logo.png"
          alt="Fortexa"
          width={170}
          height={48}
          className="mb-6 h-auto w-[170px]"
          priority
        />
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#0C5CAB]">
          {icon}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1A1A2E]">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
        {children ? <div className="mt-5">{children}</div> : null}
      </Card>
    </main>
  );
}

export default async function InvitePage({ params }: { params: Params }) {
  const { token } = await params;
  const preview = await getOrganizationInvitePreview(token);

  if (!preview) {
    return (
      <InviteShell
        icon={<AlertCircle className="h-5 w-5" />}
        title="Invite not found"
        description="This invite link is invalid or no longer exists."
      >
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </InviteShell>
    );
  }

  const user = await getCurrentUser();

  if (!user && preview.status === "pending") {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const activeOrganization = user
    ? await getActiveOrganizationForUser(user.id)
    : null;
  const acceptanceError = getInviteAcceptanceError({
    invite: {
      email: preview.email,
      organizationId: preview.organizationId,
      status: preview.status,
      expiresAt: preview.expiresAt,
    },
    userEmail: user?.email ?? null,
    activeOrganizationId: activeOrganization?.organization.id ?? null,
  });

  if (acceptanceError) {
    return (
      <InviteShell
        icon={<AlertCircle className="h-5 w-5" />}
        title="Invite unavailable"
        description={acceptanceError}
      >
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Use another account</Link>
        </Button>
      </InviteShell>
    );
  }

  return (
    <InviteShell
      icon={<Mail className="h-5 w-5" />}
      title="Join Fortexa"
      description={`${preview.organizationName} invited you as ${preview.roleLabel}.`}
    >
      <div className="mb-4 rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 text-sm text-[#1A1A2E]">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          {preview.email}
        </div>
        <p className="mt-1 text-xs text-[#6B7280]">
          Expires {formatExpiration(preview.expiresAt)}
        </p>
      </div>
      <InviteAcceptClient token={token} />
    </InviteShell>
  );
}
