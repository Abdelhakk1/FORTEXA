"use client";

import { use } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, ScannerBadge, SeverityBadge } from "@/components/shared/badges";
import { EChart } from "@/components/shared/echart";
import { scanImports } from "@/lib/mock-data";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Server, Bug, Link2, Download, Clock, FileText } from "lucide-react";

export default function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const imp = scanImports.find(i => i.id === id) || scanImports[0];

  const steps = [
    { label: "File Upload", status: "complete" as const, detail: `${imp.fileName} (${imp.fileSize})` },
    { label: "Parsing", status: "complete" as const, detail: `${imp.scannerSource} format detected and parsed` },
    { label: "Normalization", status: "complete" as const, detail: `${imp.findingsFound} findings normalized` },
    { label: "Asset Mapping", status: imp.errors > 0 ? "warning" as const : "complete" as const, detail: `${imp.assetsFound} assets mapped${imp.newAssets > 0 ? `, ${imp.newAssets} new discovered` : ""}` },
    { label: "CVE Linking", status: "complete" as const, detail: `${imp.cvesLinked} CVEs linked from NVD` },
  ];

  const sevDistOption = {
    tooltip: { trigger: "item" as const, backgroundColor: "#FFFFFF", borderColor: "#E9ECEF", borderWidth: 1, textStyle: { color: "#1A1A2E" } },
    series: [{
      type: "pie" as const, radius: ["50%", "78%"], center: ["50%", "50%"],
      itemStyle: { borderRadius: 5, borderColor: "#FFFFFF", borderWidth: 3 },
      label: { show: false },
      data: [
        { value: 12, name: "Critical", itemStyle: { color: "#EF4444" } },
        { value: 28, name: "High", itemStyle: { color: "#F59E0B" } },
        { value: 45, name: "Medium", itemStyle: { color: "#3B82F6" } },
        { value: 15, name: "Low", itemStyle: { color: "#10B981" } },
      ],
    }],
  };

  return (
    <div>
      <PageHeader
        title={imp.name}
        breadcrumbs={[{ label: "Scan Import", href: "/scan-import" }, { label: imp.id }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F0FDF4]"><Download className="h-4 w-4 mr-2" /> Download Normalized</Button>
            <Button className="gradient-accent text-[#1A1A2E] cursor-pointer" asChild>
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
          { label: "Errors", value: imp.errors, icon: XCircle, color: imp.errors > 0 ? "text-red-600 bg-red-500/12" : "text-[#6B7280] bg-[#F3F4F6]" },
        ].map(card => (
          <Card key={card.label} className="p-4 border border-[#E9ECEF] bg-white text-center">
            <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}>
              <card.icon className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold text-[#1A1A2E]">{card.value}</p>
            <p className="text-xs text-[#6B7280]">{card.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Processing Pipeline */}
          <Card className="p-5 border border-[#E9ECEF] bg-white">
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-6">Processing Pipeline</h3>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={step.label} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step.status === "complete" ? "bg-emerald-500/12 text-emerald-600" : step.status === "warning" ? "bg-amber-500/12 text-amber-600" : "bg-[#F3F4F6] text-[#6B7280]"}`}>
                      {step.status === "complete" ? <CheckCircle2 className="h-4 w-4" /> : step.status === "warning" ? <AlertTriangle className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-[#3F3F46]" />}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`w-0.5 h-8 mt-1 ${step.status === "warning" ? "bg-amber-500/20" : "bg-emerald-500/20"}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-medium text-[#1A1A2E]">{step.label}</p>
                    <p className="text-xs text-[#6B7280]">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Errors/Warnings */}
          {(imp.errors > 0 || imp.warnings > 0) && (
            <Card className="p-5 border border-[#E9ECEF] bg-white">
              <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Issues ({imp.errors + imp.warnings})</h3>
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

          {/* Reconciliation Workbench */}
          <Card className="p-5 border border-[#E9ECEF] bg-white">
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Reconciliation Workbench</h3>
            <p className="text-xs text-[#6B7280] mb-4">Assets detected in scan but not matched to existing inventory.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="dark-table-head">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Detected IP</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Hostname</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">OS Fingerprint</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Findings</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { ip: "10.7.1.22", hostname: "ATM-UNKNOWN-01", os: "Windows 10 IoT", findings: 4 },
                    { ip: "10.7.1.23", hostname: "ATM-UNKNOWN-02", os: "Windows 10 IoT", findings: 7 },
                  ].map(row => (
                    <tr key={row.ip} className="dark-table-row">
                      <td className="py-2.5 px-3 font-mono text-xs text-[#6B7280]">{row.ip}</td>
                      <td className="py-2.5 px-3 text-sm text-[#1A1A2E]">{row.hostname}</td>
                      <td className="py-2.5 px-3 text-xs text-[#6B7280]">{row.os}</td>
                      <td className="py-2.5 px-3 text-center font-medium text-[#1A1A2E]">{row.findings}</td>
                      <td className="py-2.5 px-3">
                        <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F0FDF4]">Map to Asset</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Audit Trail */}
          <Card className="p-5 border border-[#E9ECEF] bg-white">
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Import Audit Trail</h3>
            <div className="space-y-3">
              {[
                { time: "14:32:05", event: "Import initiated", user: imp.importedBy, level: "INFO" },
                { time: "14:32:08", event: `File uploaded: ${imp.fileName}`, user: "System", level: "INFO" },
                { time: "14:33:12", event: `${imp.scannerSource} format detected`, user: "System", level: "INFO" },
                { time: "14:35:20", event: `${imp.findingsFound} findings parsed`, user: "System", level: "INFO" },
                { time: "14:36:15", event: `${imp.newAssets} new assets discovered`, user: "System", level: "WARN" },
                { time: "14:36:37", event: "Import completed", user: "System", level: "INFO" },
              ].map((entry, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <span className="shrink-0 font-mono text-[#6B7280] w-16">{entry.time}</span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold ${
                    entry.level === "WARN" ? "bg-amber-500/12 text-amber-600" : "bg-blue-50 text-blue-600"
                  }`}>{entry.level}</span>
                  <span className="text-[#1A1A2E]">{entry.event}</span>
                  <span className="text-[#6B7280] ml-auto shrink-0">{entry.user}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Import Info */}
          <Card className="p-5 border border-[#E9ECEF] bg-white">
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Import Details</h3>
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
                    <p className="text-xs text-[#6B7280]">{item.label}</p>
                    <p className="text-sm font-medium text-[#1A1A2E] text-right max-w-[60%] truncate">{item.value}</p>
                  </div>
                  <Separator className="mt-2 bg-[#F3F4F6]" />
                </div>
              ))}
              <div className="flex justify-between items-center pt-1">
                <p className="text-xs text-[#6B7280]">Status</p>
                <StatusBadge status={imp.status} />
              </div>
            </div>
          </Card>

          {/* Severity Distribution */}
          <Card className="p-5 border border-[#E9ECEF] bg-white">
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-2">Severity Distribution</h3>
            <p className="text-xs text-[#6B7280] mb-2">Findings by severity level</p>
            <EChart option={sevDistOption} height="200px" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { label: "Critical", count: 12, color: "bg-red-500" },
                { label: "High", count: 28, color: "bg-amber-500" },
                { label: "Medium", count: 45, color: "bg-blue-500" },
                { label: "Low", count: 15, color: "bg-emerald-500" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className={`h-2 w-2 rounded-full ${s.color}`} />
                  <span className="text-[#6B7280]">{s.label}</span>
                  <span className="font-semibold text-[#1A1A2E] ml-auto">{s.count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-5 border border-[#E9ECEF] bg-white">
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full cursor-pointer justify-start border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F0FDF4]" asChild>
                <Link href="/remediation"><FileText className="h-4 w-4 mr-2" /> Process Remediation</Link>
              </Button>
              <Button variant="outline" className="w-full cursor-pointer justify-start border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F0FDF4]">
                <Download className="h-4 w-4 mr-2" /> Export Raw Data
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
