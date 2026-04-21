"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, FileUp, CheckCircle2, FileText, Eye, Server, Bug, Clock, AlertTriangle, FileSearch, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge, ScannerBadge } from "@/components/shared/badges";
import type { listScanImports } from "@/lib/services/scan-imports";
import { createScanImportAction } from "@/actions/scan-imports";

type ScanImportPageData = Awaited<ReturnType<typeof listScanImports>>;

interface ScanImportPageClientProps {
  data: ScanImportPageData;
}

function guessScannerSource(fileName: string) {
  const normalized = fileName.toLowerCase();

  if (normalized.endsWith(".nessus")) return "nessus";
  if (normalized.includes("openvas")) return "openvas";
  if (normalized.includes("nmap")) return "nmap";
  if (normalized.includes("qualys") || normalized.endsWith(".csv")) return "qualys";
  return "other";
}

export function ScanImportPageClient({ data }: ScanImportPageClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<{
    importId: string;
    fileName: string;
    scannerSource: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitFile = (file: File) => {
    startTransition(async () => {
      setUploadError(null);
      const formData = new FormData();
      formData.set("file", file);
      formData.set("name", file.name);
      formData.set("scannerSource", guessScannerSource(file.name));

      const result = await createScanImportAction(formData);

      if (!result.ok) {
        setUploadError(result.message);
        return;
      }

      setUploadState({
        importId: result.data.id,
        fileName: file.name,
        scannerSource: guessScannerSource(file.name),
      });

      router.refresh();
    });
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];

    if (file) {
      submitFile(file);
    }
  };

  return (
    <div>
      <PageHeader title="Scan Import" description="Import vulnerability scan results from external scanners" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-stagger">
        <KpiCard label="Total Imports" value={data.summary.totalImports} change="Live history" changeType="neutral" icon={<Upload className="h-5 w-5" />} />
        <KpiCard label="Findings Processed" value={data.summary.totalFindings.toLocaleString()} change="Current backend total" changeType={data.summary.totalFindings > 0 ? "negative" : "neutral"} icon={<Bug className="h-5 w-5" />} />
        <KpiCard label="Assets Mapped" value={data.summary.totalAssetsMapped} change="From completed imports" changeType="neutral" icon={<Server className="h-5 w-5" />} />
        <KpiCard label="Avg. Processing" value={data.summary.averageProcessingTime} subtitle="Queued via Inngest scaffold" icon={<Clock className="h-5 w-5" />} />
      </div>

      <Card className="p-6 mb-6 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".nessus,.xml,.csv"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              submitFile(file);
            }
          }}
        />
        <div
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${dragOver ? "border-[#0C5CAB] bg-[#0C5CAB]/[0.06] glow-brand" : uploadState ? "border-emerald-500/30 bg-emerald-500/[0.04]" : isPending ? "border-blue-500/30 bg-blue-500/[0.04]" : "border-[#D1D5DB] dark:border-[#3a3a42] hover:border-[#93C5FD] dark:hover:border-[#3B82F6]/40 hover:bg-[#EFF6FF]/50 dark:hover:bg-[#0C5CAB]/[0.04]"
            }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploadState ? (
            <div className="space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-lg font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Import Queued Successfully</p>
              <p className="text-sm text-[#6B7280] dark:text-[#94A3B8]">{uploadState.fileName} was stored and queued for asynchronous processing.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mt-6">
                {[
                  { value: "Stored", label: "Upload", color: "text-emerald-600 dark:text-emerald-400" },
                  { value: "Processing", label: "Status", color: "text-[#1A1A2E] dark:text-[#fafafa]" },
                  { value: uploadState.importId.slice(0, 8), label: "Import ID", color: "text-[#1A1A2E] dark:text-[#fafafa]" },
                  { value: uploadState.scannerSource.toUpperCase(), label: "Source", color: "text-[#1A1A2E] dark:text-[#fafafa]" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-3 rounded-lg bg-[#F9FAFB] dark:bg-[#1a1a22] border border-[#E9ECEF] dark:border-[#27272a]">
                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{stat.label}</p>
                  </div>
                ))}
              </div>
              <Button className="mt-4 gradient-accent text-white cursor-pointer" onClick={() => setUploadState(null)}>
                Import Another Scan
              </Button>
            </div>
          ) : isPending ? (
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full border-4 border-blue-900 dark:border-blue-800 border-t-blue-400 animate-spin" />
              <p className="text-lg font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Uploading and Queueing Scan...</p>
              <p className="text-sm text-[#6B7280] dark:text-[#94A3B8]">Saving the file to Supabase Storage, creating the import record, and sending the Inngest event.</p>
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
                <Button className="gradient-accent text-white cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="h-4 w-4 mr-2" /> Select File
                </Button>
              </div>
            </div>
          )}
        </div>

        {uploadError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
            {uploadError}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3 justify-center">
          {[
            { name: "Nessus", ext: ".nessus" },
            { name: "OpenVAS", ext: ".xml" },
            { name: "Nmap", ext: ".xml" },
            { name: "Qualys", ext: ".csv" },
          ].map((scanner) => (
            <div key={scanner.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F9FAFB] dark:bg-[#1a1a22] border border-[#E9ECEF] dark:border-[#27272a]">
              <FileText className="h-4 w-4 text-[#6B7280] dark:text-[#94A3B8]" />
              <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{scanner.name}</span>
              <span className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{scanner.ext}</span>
            </div>
          ))}
        </div>
      </Card>

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
            ].map((field) => (
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
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5">Scaffold</span>
          </div>
          <div className="space-y-2">
            {[
              { level: "INFO", message: "Background parsing is scaffolded through Inngest", detail: "The file is stored and queued, but deep normalization is a future phase." },
              { level: "INFO", message: "Storage path is tracked on each import row", detail: "This enables later replay and artifact review." },
              { level: "INFO", message: "Server-side validation now blocks empty uploads", detail: "The page no longer simulates fake success states." },
            ].map((issue, index) => (
              <div key={index} className="flex items-start gap-3 p-2.5 rounded-lg border border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22]">
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400">{issue.level}</span>
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{issue.message}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{issue.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9ECEF] dark:border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Import History</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5">{data.imports.total}</span>
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                {["Import Name", "Scanner", "Date", "Imported By", "Assets", "Findings", "CVEs", "Status", "Actions"].map((heading) => (
                  <th key={heading} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.imports.items.map((scanImport) => (
                <tr key={scanImport.id} className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
                  <td className="py-3 px-4">
                    <Link href={`/scan-import/${scanImport.id}`} className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] cursor-pointer">{scanImport.name}</Link>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{scanImport.fileName}</p>
                  </td>
                  <td className="py-3 px-4"><ScannerBadge source={scanImport.scannerSource} /></td>
                  <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8] whitespace-nowrap">{scanImport.importDate}</td>
                  <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8]">{scanImport.importedBy}</td>
                  <td className="py-3 px-4 text-center font-medium text-[#1A1A2E] dark:text-[#fafafa]">{scanImport.assetsFound}</td>
                  <td className="py-3 px-4 text-center font-medium text-[#1A1A2E] dark:text-[#fafafa]">{scanImport.findingsFound.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center font-medium text-[#1A1A2E] dark:text-[#fafafa]">{scanImport.cvesLinked}</td>
                  <td className="py-3 px-4"><StatusBadge status={scanImport.status} /></td>
                  <td className="py-3 px-4">
                    <Link href={`/scan-import/${scanImport.id}`}><Button variant="ghost" size="sm" className="h-9 w-9 p-0 cursor-pointer text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22]"><Eye className="h-4 w-4" /></Button></Link>
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
