import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full bg-[#F8F9FA] dark:bg-[#09090b] overflow-hidden p-4">
      <div className="app-shell h-full w-full flex overflow-hidden relative relative-shell">
        <Sidebar />
        <div className="ml-[220px] flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <Topbar />
          <main className="flex-1 p-6 overflow-y-auto bg-transparent relative outline-none">{children}</main>
        </div>
      </div>
    </div>
  );
}
