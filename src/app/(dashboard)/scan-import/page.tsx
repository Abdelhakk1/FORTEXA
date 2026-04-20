"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, FileUp, CheckCircle2, FileText, Eye, Server, Bug, Link2, Clock, AlertTriangle, FileSearch, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge, ScannerBadge } from "@/components/shared/badges";
import { scanImports } from "@/lib/mock-data";

export default function ScanImportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setUploading(true);
    setTimeout(() => { setUploading(false); setUploadComplete(true); }, 2000);
  };

  const simulateUpload = () => {
    setUploading(true);
    setTimeout(() => { setUploading(false); setUploadComplete(true); }, 2000);
  };

  const totalFindings = scanImports.reduce((s, i) => s + i.findingsFound, 0);
  const totalAssetsMapped = scanImports.reduce((s, i) => s + i.assetsFound, 0);
  const avgProcessing = "2m 24s";

  return (
    <div>
      <PageHeader title="Scan Import" description="Import vulnerability scan results from external scanners" />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-stagger">
        <KpiCard label="Total Imports" value={scanImports.length} change="Last 30 days" changeType="neutral" icon={<Upload className="h-5 w-5" />} />
        <KpiCard label="Findings Processed" value={totalFindings.toLocaleString()} change="+23 new CVEs" changeType="negative" icon={<Bug className="h-5 w-5" />} />
        <KpiCard label="Assets Mapped" value={totalAssetsMapped} change="3 unmatched" changeType="neutral" icon={<Server className="h-5 w-5" />} />
        <KpiCard label="Avg. Processing" value={avgProcessing} subtitle="Target: < 5 minutes" icon={<Clock className="h-5 w-5" />} />
      </div>

      {/* Upload Area */}
      <Card className="p-6 mb-6 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
        <div
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${dragOver ? "border-[#0C5CAB] bg-[#0C5CAB]/[0.06] glow-brand" : uploadComplete ? "border-emerald-500/30 bg-emerald-500/[0.04]" : uploading ? "border-blue-500/30 bg-blue-500/[0.04]" : "border-[#D1D5DB] dark:border-[#3a3a42] hover:border-[#93C5FD] dark:hover:border-[#3B82F6]/40 hover:bg-[#EFF6FF]/50 dark:hover:bg-[#0C5CAB]/[0.04]"
            }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploadComplete ? (
            <div className="space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-lg font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Import Completed Successfully</p>
              <p className="text-sm text-[#6B7280] dark:text-[#94A3B8]">nessus_atm_fleet_20260410.nessus processed in 4m 32s</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mt-6">
                {[
                  { value: "142", label: "Assets Detected", color: "text-[#1A1A2E] dark:text-[#fafafa]" },
                  { value: "1,847", label: "Findings", color: "text-[#1A1A2E] dark:text-[#fafafa]" },
                  { value: "326", label: "CVEs Linked", color: "text-[#1A1A2E] dark:text-[#fafafa]" },
                  { value: "5", label: "Warnings", color: "text-amber-600 dark:text-amber-400" },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-lg bg-[#F9FAFB] dark:bg-[#1a1a22] border border-[#E9ECEF] dark:border-[#27272a]">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{s.label}</p>
                  </div>
                ))}
              </div>
              <Button className="mt-4 gradient-accent text-white cursor-pointer" onClick={() => setUploadComplete(false)}>
                Import Another Scan
              </Button>
            </div>
          ) : uploading ? (
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full border-4 border-blue-900 dark:border-blue-800 border-t-blue-400 animate-spin" />
              <p className="text-lg font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Processing Scan Results...</p>
              <p className="text-sm text-[#6B7280] dark:text-[#94A3B8]">Parsing findings, normalizing data, mapping to assets...</p>
              <div className="w-full max-w-md mx-auto bg-[#F3F4F6] dark:bg-[#1a1a22] rounded-full h-2 overflow-hidden">
                <div className="gradient-accent h-full rounded-full animate-pulse" style={{ width: "65%" }} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className={`h-12 w-12 mx-auto ${dragOver ? "text-[#0C5CAB] dark:text-[#3B82F6]" : "text-[#6B7280] dark:text-[#94A3B8]"}`} />
              <p className="text-lg font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Drag & drop scan files here</p>
              <p className="text-sm text-[#6B7280] dark:text-[#94A3B8]">Supports Nessus (.nessus), OpenVAS (.xml), Nmap (.xml), Qualys (.csv)</p>
              <div className="flex justify-center gap-3 mt-4">
                <Button className="gradient-accent text-white cursor-pointer" onClick={simulateUpload}>
                  <FileUp className="h-4 w-4 mr-2" /> Select File
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Accepted Scanners */}
        <div className="mt-6 flex flex-wrap items-center gap-3 justify-center">
          {[
            { name: "Nessus", ext: ".nessus" },
            { name: "OpenVAS", ext: ".xml" },
            { name: "Nmap", ext: ".xml" },
            { name: "Qualys", ext: ".csv" },
          ].map(scanner => (
            <div key={scanner.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F9FAFB] dark:bg-[#1a1a22] border border-[#E9ECEF] dark:border-[#27272a]">
              <FileText className="h-4 w-4 text-[#6B7280] dark:text-[#94A3B8]" />
              <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{scanner.name}</span>
              <span className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{scanner.ext}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Field Mapping & Validation Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <div className="flex items-center gap-2 mb-4">
            <FileSearch className="h-4 w-4 text-[#6B7280] dark:text-[#94A3B8]" />
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Field Mapping Preview</h3>
          </div>
          <div className="space-y-2">
            {[
              { source: "host-ip", target: "Asset IP Address", status: "Mapped" },
              { source: "plugin-output", target: "Finding Description", status: "Mapped" },
              { source: "cvss-score", target: "CVSS Base Score", status: "Mapped" },
              { source: "cve-id", target: "CVE Identifier", status: "Mapped" },
              { source: "hostname", target: "Asset Name", status: "Partial" },
              { source: "mac-address", target: "—", status: "Unmapped" },
            ].map(field => (
              <div key={field.source} className="flex items-center justify-between p-2.5 rounded-lg bg-[#F9FAFB] dark:bg-[#1a1a22] border border-[#E9ECEF] dark:border-[#27272a]">
                <div className="flex items-center gap-3">
                  <code className="text-xs font-mono text-[#6B7280] dark:text-[#94A3B8] bg-[#F3F4F6] dark:bg-[#27272a] px-1.5 py-0.5 rounded">{field.source}</code>
                  <ArrowRight className="h-3 w-3 text-[#9CA3AF] dark:text-[#64748B]" />
                  <span className="text-sm text-[#1A1A2E] dark:text-[#fafafa]">{field.target}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${field.status === "Mapped" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" :
                    field.status === "Partial" ? "bg-amber-500/12 text-amber-600 dark:text-amber-400" :
                      "bg-[#F3F4F6] dark:bg-[#27272a] text-[#6B7280] dark:text-[#94A3B8]"
                  }`}>{field.status}</span>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4 cursor-pointer w-full border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#EFF6FF] dark:hover:bg-[#27272a]">Validate Mapping</Button>
        </Card>

        <Card className="p-5 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Validation Issues</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5">3</span>
          </div>
          <div className="space-y-2">
            {[
              { level: "WARN", message: "5 assets could not be matched to existing inventory", detail: "IP addresses not in asset database" },
              { level: "WARN", message: "3 findings missing CVSS scores", detail: "Manual scoring may be required" },
              { level: "INFO", message: "2 new assets discovered in scan", detail: "Will be added to asset inventory" },
            ].map((issue, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22]">
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5 ${issue.level === "WARN" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  }`}>{issue.level}</span>
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{issue.message}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{issue.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Import History */}
      <Card className="border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9ECEF] dark:border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Import History</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5">{scanImports.length}</span>
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="dark-table-head">
                {["Import Name", "Scanner", "Date", "Imported By", "Assets", "Findings", "CVEs", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scanImports.map(imp => (
                <tr key={imp.id} className="dark-table-row">
                  <td className="py-3 px-4">
                    <Link href={`/scan-import/${imp.id}`} className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] cursor-pointer">{imp.name}</Link>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{imp.fileName}</p>
                  </td>
                  <td className="py-3 px-4"><ScannerBadge source={imp.scannerSource} /></td>
                  <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8] whitespace-nowrap">{imp.importDate}</td>
                  <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8]">{imp.importedBy}</td>
                  <td className="py-3 px-4 text-center font-medium text-[#1A1A2E] dark:text-[#fafafa]">{imp.assetsFound}</td>
                  <td className="py-3 px-4 text-center font-medium text-[#1A1A2E] dark:text-[#fafafa]">{imp.findingsFound.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center font-medium text-[#1A1A2E] dark:text-[#fafafa]">{imp.cvesLinked}</td>
                  <td className="py-3 px-4"><StatusBadge status={imp.status} /></td>
                  <td className="py-3 px-4">
                    <Link href={`/scan-import/${imp.id}`}><Button variant="ghost" size="sm" className="h-9 w-9 p-0 cursor-pointer text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22]"><Eye className="h-4 w-4" /></Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
