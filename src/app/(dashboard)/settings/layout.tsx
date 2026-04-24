import { requirePermission } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("identity.read");

  return children;
}
