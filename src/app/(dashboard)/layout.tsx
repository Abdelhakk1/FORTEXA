import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireAuth } from "@/lib/auth";
import { listRecentAlertActivity } from "@/lib/services/alerts";

function formatRoleLabel(roleName: string | null) {
  if (!roleName) {
    return "No role assigned";
  }

  return roleName
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const identity = await requireAuth();
  const alertActivity = await listRecentAlertActivity(3);
  const fullName = identity.profile?.fullName || identity.user?.email || "Fortexa User";
  const roleLabel = formatRoleLabel(identity.roleName);
  const initials = getInitials(fullName);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F8F9FA] dark:bg-[#09090b]">
      <Sidebar
        alertCount={alertActivity.unreadCount}
        userName={fullName}
        userRoleLabel={roleLabel}
        userInitials={initials}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          unreadCount={alertActivity.unreadCount}
          recentAlerts={alertActivity.alerts}
          userName={fullName}
          userEmail={identity.profile?.email || identity.user?.email || "—"}
          userRoleLabel={roleLabel}
          userInitials={initials}
        />
        <main
          id="main-content"
          className="relative flex-1 overflow-y-auto bg-transparent px-4 py-5 outline-none sm:px-5 lg:px-6 lg:py-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
