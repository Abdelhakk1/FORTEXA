"use client";

import { Download, FileText, BarChart3, Presentation, Plus, Eye, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import type { listReports } from "@/lib/services/reports";

interface ReportsPageClientProps {
  data: Awaited<ReturnType<typeof listReports>>;
}

export function ReportsPageClient({ data }: ReportsPageClientProps) {
  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Generate, schedule, and distribute compliance and vulnerability reports."
        actions={
          <Button className="gradient-accent text-white cursor-pointer border-0">
            <Plus className="h-4 w-4 mr-2" /> Create Template
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-stagger">
        <KpiCard label="Reports Generated" value={data.summary.reportsGenerated} change="Live generated history" changeType="positive" icon={<FileText className="h-5 w-5" />} />
        <KpiCard label="Scheduled Reports" value={data.summary.scheduledReports} change="Definition schedule count" changeType="neutral" icon={<Presentation className="h-5 w-5" />} />
        <KpiCard label="Total Templates" value={data.summary.totalTemplates} change="Stored report definitions" changeType="neutral" icon={<BarChart3 className="h-5 w-5" />} />
        <KpiCard label="Active Viewers" value={data.summary.activeViewers} change="Placeholder metric for later analytics" changeType="neutral" icon={<Eye className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E9ECEF] dark:border-[#27272a] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Recent Reports</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Author</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentReports.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-[#6B7280] dark:text-[#94A3B8]">
                        No generated reports yet. The backend history table is connected and ready for the first run.
                      </td>
                    </tr>
                  ) : (
                    data.recentReports.map((report) => (
                      <tr key={report.id} className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">{report.name}</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{report.description}</p>
                        </td>
                        <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8]">{report.generatedAt}</td>
                        <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8]">{report.author}</td>
                        <td className="py-3 px-4">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA]">
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Report Templates</h3>
            </div>
            <div className="space-y-3">
              {data.templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D1D5DB] p-4 text-sm text-[#6B7280] dark:border-[#3a3a42] dark:text-[#94A3B8]">
                  No report definitions yet. Templates can now be stored against the real backend schema.
                </div>
              ) : (
                data.templates.map((template) => (
                  <div key={template.id} className="p-3 rounded-xl border border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{template.name}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{template.type} · {template.schedule}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-[#6B7280] dark:text-[#94A3B8]">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
                        <DropdownMenuItem className="cursor-pointer focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22] focus:text-[#0C5CAB] dark:focus:text-[#60A5FA]">Generate Report</DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22] focus:text-[#0C5CAB] dark:focus:text-[#60A5FA]">Edit Template</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
