"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BarChart3, Download, Eye, FileText, Presentation } from "lucide-react";
import {
  createReportDownloadUrlAction,
  generateReportAction,
} from "@/actions/reports";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { listReports } from "@/lib/services/reports";

interface ReportsPageClientProps {
  data: Awaited<ReturnType<typeof listReports>>;
}

type Notice =
  | { status: "success"; message: string }
  | { status: "error"; message: string }
  | null;

export function ReportsPageClient({ data }: ReportsPageClientProps) {
  const [isPending, startTransition] = useTransition();
  const [activeDefinitionId, setActiveDefinitionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  function generate(definitionId: string) {
    setActiveDefinitionId(definitionId);
    setNotice(null);
    startTransition(async () => {
      const result = await generateReportAction(definitionId);
      setActiveDefinitionId(null);
      if (!result.ok) {
        setNotice({ status: "error", message: result.message });
        return;
      }

      setNotice({ status: "success", message: `${result.data.name} generated.` });
      if (result.data.signedUrl) {
        window.location.href = result.data.signedUrl;
      }
    });
  }

  function download(generatedReportId: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await createReportDownloadUrlAction(generatedReportId);
      if (!result.ok) {
        setNotice({ status: "error", message: result.message });
        return;
      }
      window.location.href = result.data.signedUrl;
    });
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate CSV exports and printable previews from real Fortexa vulnerability-operations data"
      />

      {notice && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            notice.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Reports Generated"
          value={data.summary.reportsGenerated}
          change="Stored CSV history"
          changeType="positive"
          icon={<FileText className="h-5 w-5" />}
        />
        <KpiCard
          label="Scheduled Reports"
          value={data.summary.scheduledReports}
          change="Deferred for P1"
          changeType="neutral"
          icon={<Presentation className="h-5 w-5" />}
        />
        <KpiCard
          label="Report Types"
          value={data.summary.totalTemplates}
          change="MVP definitions"
          changeType="neutral"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <KpiCard
          label="Active Viewers"
          value={data.summary.activeViewers}
          change="Analytics deferred"
          changeType="neutral"
          icon={<Eye className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden rounded-2xl border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
            <div className="border-b border-[#E9ECEF] px-5 py-4 dark:border-[#27272a]">
              <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                Report History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Generated</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Format</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentReports.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-sm text-[#6B7280] dark:text-[#94A3B8]"
                      >
                        No reports generated yet. Generate an MVP report from the definitions on the right.
                      </td>
                    </tr>
                  ) : (
                    data.recentReports.map((report) => (
                      <tr
                        key={report.id}
                        className="dark-table-row border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] dark:border-[#27272a] dark:hover:bg-[#1a1a22]/50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">{report.name}</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{report.description}</p>
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] dark:text-[#94A3B8]">{report.generatedAt}</td>
                        <td className="px-4 py-3 text-[#6B7280] dark:text-[#94A3B8]">{report.author}</td>
                        <td className="px-4 py-3 text-[#6B7280] dark:text-[#94A3B8]">{report.fileFormat}</td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => download(report.id)}
                            disabled={isPending}
                            className="h-8 w-8 p-0 text-[#6B7280] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:text-[#60A5FA]"
                          >
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
          <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-5 dark:border-[#27272a] dark:bg-[#141419]">
            <h3 className="mb-4 text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
              Generate Report
            </h3>
            <div className="space-y-3">
              {data.templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D1D5DB] p-4 text-sm text-[#6B7280] dark:border-[#3a3a42] dark:text-[#94A3B8]">
                  Report definitions could not be loaded.
                </div>
              ) : (
                data.templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] p-3 dark:border-[#27272a] dark:bg-[#1a1a22]"
                  >
                    <div className="mb-3">
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{template.name}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                        {template.type} · {template.schedule}
                      </p>
                      <p className="mt-1 text-xs text-[#6B7280] dark:text-[#94A3B8]">
                        {template.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => generate(template.id)}
                        disabled={isPending}
                        className="gradient-accent border-0 text-white"
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        {activeDefinitionId === template.id ? "Generating..." : "CSV"}
                      </Button>
                      <Button
                        asChild
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-[#E9ECEF] bg-white text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#94A3B8] dark:hover:bg-[#27272a] dark:hover:text-[#60A5FA]"
                      >
                        <Link href={`/reports/preview?definitionId=${template.id}`} prefetch={false}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Preview
                        </Link>
                      </Button>
                    </div>
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
