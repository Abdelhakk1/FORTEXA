"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/badges";
import { EChart } from "@/components/shared/echart";
import type { ScanImportDetailData } from "@/lib/services/scan-imports";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Server, Bug, Link2, Download, FileText } from "lucide-react";

export default function ImportDetailClient({
  data,
}: {
  data: ScanImportDetailData;
}) {
  const imp = data.scanImport;
  const steps = data.steps;
  const reviewFindings = data.findings.slice(0, 5);

  const sevDistOption = {
    tooltip: { trigger: "item" as const, backgroundColor: "#FFFFFF", borderColor: "#E9ECEF", borderWidth: 1, textStyle: { color: "#1A1A2E" } },
    series: [{
      type: "pie" as const, radius: ["50%", "78%"], center: ["50%", "50%"],
      itemStyle: { borderRadius: 5, borderColor: "#FFFFFF", borderWidth: 3 },
      label: { show: false },
      data: data.severityDistribution.map((entry) => ({
        value: entry.count,
        name: entry.label,
        itemStyle: { color: entry.color },
      })),
    }],
  };

  return (
    <div>
      <PageHeader
        title={imp.name}
        breadcrumbs={[{ label: "Scan Import", href: "/scan-import" }, { label: imp.id }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="cursor-pointer border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#F0FDF4] dark:hover:bg-[#1a1a22]" asChild={Boolean(data.downloadUrl)} disabled={!data.downloadUrl}>
              {data.downloadUrl ? (
                <a href={data.downloadUrl}><Download className="h-4 w-4 mr-2" /> Download Source</a>
              ) : (
                <span><Download className="h-4 w-4 mr-2" /> Download Pending</span>
              )}
            </Button>
            <Button className="gradient-accent text-[#1A1A2E] dark:text-[#fafafa] cursor-pointer" asChild>
              <Link href="/vulnerabilities">View Vulnerabilities <ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6 animate-stagger">
        {[
          { label: "Assets Found", value: imp.assetsFound, icon: Server, color: "text-blue-600 bg-blue-50" },
          { label: "Findings", value: imp.findingsFound.toLocaleString(), icon: Bug, color: "text-[#1B4332] bg-[#1B4332]/12" },
          { label: "CVEs Linked", value: imp.cvesLinked, icon: Link2, color: "text-purple-400 bg-purple-500/12" },
          { label: "New Assets", value: imp.newAssets, icon: Server, color: "text-emerald-600 bg-emerald-500/12" },
          { label: "New Vulns", value: imp.newVulnerabilities, icon: Bug, color: "text-amber-600 bg-amber-500/12" },
          { label: "Errors", value: imp.errors, icon: XCircle, color: imp.errors > 0 ? "text-red-600 bg-red-500/12" : "text-[#6B7280] dark:text-[#94A3B8] bg-[#F3F4F6] dark:bg-[#27272a]" },
        ].map(card => (
          <Card key={card.label} className="p-4 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13] text-center">
            <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}>
              <card.icon className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold text-[#1A1A2E] dark:text-[#fafafa]">{card.value}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{card.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Processing Pipeline */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-6">Processing Pipeline</h3>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={step.label} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step.status === "complete" ? "bg-emerald-500/12 text-emerald-600" : step.status === "warning" ? "bg-amber-500/12 text-amber-600" : "bg-[#F3F4F6] dark:bg-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"}`}>
                      {step.status === "complete" ? <CheckCircle2 className="h-4 w-4" /> : step.status === "warning" ? <AlertTriangle className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-[#3F3F46]" />}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`w-0.5 h-8 mt-1 ${step.status === "warning" ? "bg-amber-500/20" : "bg-emerald-500/20"}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{step.label}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Errors/Warnings */}
          {(imp.errors > 0 || imp.warnings > 0) && (
            <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
              <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Issues ({imp.errors + imp.warnings})</h3>
              <div className="space-y-2">
                {imp.errors > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/8 border border-red-500/15">
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-600">{imp.errors} parsing error(s)</p>
                      <p className="text-xs text-red-600/70">Some findings could not be parsed. Check source file format.</p>
                    </div>
                  </div>
                )}
                {imp.warnings > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/8 border border-amber-500/15">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-600">{imp.warnings} warning(s)</p>
                      <p className="text-xs text-amber-600/70">Some assets could not be automatically mapped. Manual review recommended.</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Findings Workbench */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Findings Workbench</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mb-4">Latest normalized findings from this import.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Host</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Finding</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Port / Protocol</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Match</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewFindings.map((row) => (
                    <tr key={row.id} className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
                      <td className="py-2.5 px-3 font-mono text-xs text-[#6B7280] dark:text-[#94A3B8]">{row.host}</td>
                      <td className="py-2.5 px-3 text-sm text-[#1A1A2E] dark:text-[#fafafa]">{row.title}</td>
                      <td className="py-2.5 px-3 text-xs text-[#6B7280] dark:text-[#94A3B8]">
                        {row.port ? `${row.port}${row.protocol ? ` / ${row.protocol.toUpperCase()}` : ""}` : row.protocol?.toUpperCase() ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[#6B7280] dark:text-[#94A3B8]">
                        {row.matchedAssetCode ?? row.matchedCveCode ?? "Pending correlation"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-[#1A1A2E] dark:text-[#fafafa]">{row.severity}</td>
                    </tr>
                  ))}
                  {reviewFindings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-[#6B7280] dark:text-[#94A3B8]">
                        No findings have been parsed for this import yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Audit Trail */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Import Audit Trail</h3>
            <div className="space-y-3">
              {data.timeline.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <span className="shrink-0 font-mono text-[#6B7280] dark:text-[#94A3B8] w-16">{entry.time}</span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold ${
                    entry.level === "WARN" ? "bg-amber-500/12 text-amber-600" : "bg-blue-50 text-blue-600"
                  }`}>{entry.level}</span>
                  <span className="text-[#1A1A2E] dark:text-[#fafafa]">{entry.event}</span>
                  <span className="text-[#6B7280] dark:text-[#94A3B8] ml-auto shrink-0">{entry.user}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Import Info */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Import Details</h3>
            <div className="space-y-3">
              {[
                { label: "Import ID", value: imp.id },
                { label: "Scanner Source", value: imp.scannerSource },
                { label: "File Name", value: imp.fileName },
                { label: "File Size", value: imp.fileSize },
                { label: "Import Date", value: imp.importDate },
                { label: "Imported By", value: imp.importedBy },
                { label: "Processing Time", value: imp.processingTime },
                { label: "Closed Vulns", value: String(imp.closedVulnerabilities) },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between">
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{item.label}</p>
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] text-right max-w-[60%] truncate">{item.value}</p>
                  </div>
                  <Separator className="mt-2 bg-[#F3F4F6] dark:bg-[#27272a]" />
                </div>
              ))}
              <div className="flex justify-between items-center pt-1">
                <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Status</p>
                <StatusBadge status={imp.status} />
              </div>
            </div>
          </Card>

          {/* Severity Distribution */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-2">Severity Distribution</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mb-2">Findings by severity level</p>
            <EChart option={sevDistOption} height="200px" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              {data.severityDistribution.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[#6B7280] dark:text-[#94A3B8]">{s.label}</span>
                  <span className="font-semibold text-[#1A1A2E] dark:text-[#fafafa] ml-auto">{s.count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Recent Alerts</h3>
            <div className="space-y-2 mb-4">
              {data.alerts.length === 0 && (
                <p className="text-sm text-[#6B7280] dark:text-[#94A3B8]">No alerts are linked to this import yet.</p>
              )}
              {data.alerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="rounded-lg border border-[#E9ECEF] px-3 py-2 dark:border-[#27272a]">
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{alert.title}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{alert.createdAt} · {alert.severity} · {alert.status}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full cursor-pointer justify-start border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#F0FDF4] dark:hover:bg-[#1a1a22]" asChild>
                <Link href="/remediation"><FileText className="h-4 w-4 mr-2" /> Process Remediation</Link>
              </Button>
              <Button variant="outline" className="w-full cursor-pointer justify-start border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#F0FDF4] dark:hover:bg-[#1a1a22]" asChild={Boolean(data.downloadUrl)} disabled={!data.downloadUrl}>
                {data.downloadUrl ? (
                  <a href={data.downloadUrl}><Download className="h-4 w-4 mr-2" /> Export Raw Data</a>
                ) : (
                  <span><Download className="h-4 w-4 mr-2" /> Export Unavailable</span>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
