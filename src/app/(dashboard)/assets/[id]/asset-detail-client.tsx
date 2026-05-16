"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { SeverityBadge, PriorityBadge, StatusBadge, SlaBadge } from "@/components/shared/badges";
import { EChart } from "@/components/shared/echart";
import type { AssetDetailData } from "@/lib/services/assets";
import { updateAssetBusinessContextAction } from "@/actions/assets";
import {
  MapPin, Server, Shield, Wifi, User, Monitor, Wrench, Eye, ArrowRight,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const gabExposureOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "indoor_agency", label: "Indoor agency GAB" },
  { value: "outdoor_agency", label: "Outdoor agency GAB" },
  { value: "outdoor_commercial_center", label: "Outdoor commercial-center GAB" },
  { value: "outdoor_public_street", label: "Outdoor public/street GAB" },
] as const;

type GabExposureFormValue = (typeof gabExposureOptions)[number]["value"];

const cidtFields = [
  ["cidtConfidentiality", "C"],
  ["cidtIntegrity", "I"],
  ["cidtAvailability", "D"],
  ["cidtTraceability", "T"],
] as const;

export default function AssetDetailClient({ data }: { data: AssetDetailData }) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bgBorder = isDark ? "#27272a" : "#E9ECEF";
  const bgCard = isDark ? "#141419" : "#FFFFFF";
  const textDark = isDark ? "#fafafa" : "#1A1A2E";
  const textLight = isDark ? "#94A3B8" : "#6B7280";

  const asset = data.asset;
  const [showContextForm, setShowContextForm] = useState(false);
  const [showAdvancedOverride, setShowAdvancedOverride] = useState(false);
  const [contextMessage, setContextMessage] = useState<string | null>(null);
  const [isSavingContext, startSavingContext] = useTransition();
  const [contextForm, setContextForm] = useState<{
    gabExposureType: GabExposureFormValue;
    cidtOverrideEnabled: boolean;
    cidtConfidentiality: string;
    cidtIntegrity: string;
    cidtAvailability: string;
    cidtTraceability: string;
  }>({
    gabExposureType: gabExposureOptions.some(
      (option) => option.value === asset.gabExposureTypeDb
    )
      ? (asset.gabExposureTypeDb as GabExposureFormValue)
      : "unknown",
    cidtOverrideEnabled: Boolean(asset.cidt.isCustomOverride),
    cidtConfidentiality: asset.cidt.confidentiality?.toString() ?? "missing",
    cidtIntegrity: asset.cidt.integrity?.toString() ?? "missing",
    cidtAvailability: asset.cidt.availability?.toString() ?? "missing",
    cidtTraceability: asset.cidt.traceability?.toString() ?? "missing",
  });
  const assetVulns = data.vulnerabilities.slice(0, 5);
  const assetRemediation = data.remediationTasks.slice(0, 3);
  const assetScans = data.scanHistory.slice(0, 3);
  const assetAlerts = data.alerts.slice(0, 4);

  const riskTrendOption = {
    tooltip: { trigger: "axis" as const, backgroundColor: bgCard, borderColor: bgBorder, borderWidth: 1, textStyle: { color: textDark, fontSize: 12 } },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: { type: "category" as const, data: data.riskTrend.map((point) => point.month), axisLine: { lineStyle: { color: bgBorder } }, axisLabel: { color: textLight, fontSize: 11 } },
    yAxis: { type: "value" as const, min: 0, max: 100, splitLine: { lineStyle: { color: isDark ? "#1a1a22" : "#F3F4F6" } }, axisLabel: { color: textLight, fontSize: 11 } },
    series: [{
      type: "line" as const, smooth: true,
      data: data.riskTrend.map((point) => point.value),
      lineStyle: { color: "#E8533F", width: 3 }, itemStyle: { color: "#E8533F" }, symbol: "circle", symbolSize: 8,
      areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(232,83,63,0.15)" }, { offset: 1, color: "rgba(232,83,63,0)" }] } },
    }],
  };

  function cidtFormValue(value: string) {
    return value === "missing" ? null : Number(value);
  }

  function saveBusinessContext() {
    startSavingContext(async () => {
      setContextMessage(null);
      const result = await updateAssetBusinessContextAction({
        assetCode: asset.id,
        gabExposureType: contextForm.gabExposureType,
        cidtOverrideEnabled: contextForm.cidtOverrideEnabled,
        cidtConfidentiality: cidtFormValue(contextForm.cidtConfidentiality),
        cidtIntegrity: cidtFormValue(contextForm.cidtIntegrity),
        cidtAvailability: cidtFormValue(contextForm.cidtAvailability),
        cidtTraceability: cidtFormValue(contextForm.cidtTraceability),
      });

      if (!result.ok) {
        setContextMessage(result.message);
        return;
      }

      setContextMessage("Business context saved.");
      setShowContextForm(false);
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title={asset.name}
        breadcrumbs={[{ label: "Assets", href: "/assets" }, { label: asset.id }]}
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setShowContextForm((current) => !current)} className="cursor-pointer border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#F0FDF4] dark:hover:bg-[#1a1a22]">Edit Context</Button>
            <Button className="gradient-accent text-[#1A1A2E] dark:text-[#fafafa] cursor-pointer">
              <Wrench className="h-4 w-4 mr-2" /> Create Remediation
            </Button>
          </div>
        }
      />

      {/* Summary Header */}
      <Card className="p-5 mb-6 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <div className="text-center">
            <div className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-[#1A1A2E] dark:text-[#fafafa] ${asset.riskScore >= 80 ? "bg-red-500 glow-critical" : asset.riskScore >= 60 ? "bg-orange-500 glow-warning" : asset.riskScore >= 40 ? "bg-amber-500" : "bg-green-500 glow-success"}`}>
              {asset.riskScore}
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Risk Score</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#fafafa]">{asset.vulnerabilityCount}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Vulnerabilities</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1"><SeverityBadge severity={asset.maxSeverity} /></div>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Max Severity</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center"><PriorityBadge priority={asset.contextualPriority} /></div>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-1">Business Priority</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1"><StatusBadge status={asset.status} /></div>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Status</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{asset.lastScanDate}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Last Scanned</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Asset Information</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              {[
                { icon: Monitor, label: "Asset ID", value: asset.id },
                { icon: Server, label: "Type", value: asset.type },
                { icon: Monitor, label: "Model", value: asset.model },
                { icon: Server, label: "Manufacturer", value: asset.manufacturer },
                { icon: MapPin, label: "Branch", value: asset.branch },
                { icon: MapPin, label: "Region", value: asset.region },
                { icon: MapPin, label: "Location", value: asset.location },
                { icon: Wifi, label: "IP Address", value: asset.ipAddress },
                { icon: Monitor, label: "OS Version", value: asset.osVersion },
                { icon: Shield, label: "Criticality", value: asset.criticality },
                { icon: MapPin, label: "GAB Exposure", value: asset.gabExposureType },
                { icon: Shield, label: "GAB Sensitivity", value: asset.cidt.sensitivity },
                { icon: User, label: "Owner", value: asset.owner },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <item.icon className="h-4 w-4 text-[#6B7280] dark:text-[#94A3B8] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{item.label}</p>
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Linked CVEs */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Linked Vulnerabilities ({asset.vulnerabilityCount})</h3>
              <Link href="/vulnerabilities" prefetch={false} className="text-xs text-[#1B4332] font-medium hover:text-[#1B4332]-hover flex items-center gap-1 cursor-pointer">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">CVE</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">Severity</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">Priority</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">SLA</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assetVulns.map(v => (
                    <tr key={v.id} className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
                      <td className="py-2.5 px-3"><Link href={`/vulnerabilities/${v.id}`} prefetch={false} className="text-[#1B4332] font-semibold hover:text-[#1B4332]-hover cursor-pointer text-sm">{v.cveId}</Link></td>
                      <td className="py-2.5 px-3"><SeverityBadge severity={v.severity} score={v.cvssScore} /></td>
                      <td className="py-2.5 px-3"><PriorityBadge priority={v.businessPriority} /></td>
                      <td className="py-2.5 px-3"><SlaBadge status={v.slaStatus} /></td>
                      <td className="py-2.5 px-3 text-center">
                        <Link href={`/vulnerabilities/${v.id}`} prefetch={false}><Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer text-[#6B7280] hover:text-[#1A1A2E] dark:text-[#fafafa] hover:bg-[#F0FDF4] dark:hover:bg-[#1a1a22]"><Eye className="h-4 w-4" /></Button></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Remediation Tasks */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Remediation Tasks</h3>
            <div className="space-y-3">
              {assetRemediation.map(task => (
                <div key={task.id} className="flex items-center gap-4 p-3 rounded-lg border border-white/[0.04] hover:border-[#E9ECEF] dark:hover:border-[#3a3a42] hover:bg-white dark:border-[#27272a] dark:bg-[#0f0f13]/[0.02] transition-all cursor-pointer">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${task.slaStatus === "Overdue" ? "bg-red-400" : task.slaStatus === "At Risk" ? "bg-amber-400" : "bg-emerald-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] truncate">{task.title}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{task.relatedCve} · Due: {task.dueDate}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Risk Trend */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-2">Risk Score Trend</h3>
            <EChart option={riskTrendOption} height="200px" />
          </Card>

          {/* Scan History */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Scan History</h3>
            <div className="space-y-3">
              {assetScans.map(scan => (
                <Link key={scan.id} href={`/scan-import/${scan.id}`} prefetch={false} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#F0FDF4] dark:hover:bg-[#1a1a22] transition-colors cursor-pointer">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-600 text-xs font-bold shrink-0">{scan.scannerSource.substring(0, 2)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-[#1A1A2E] dark:text-[#fafafa]">{scan.scannerSource}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{scan.importDate} · {scan.findingsFound} findings</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Alert Timeline */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Recent Alerts</h3>
            <div className="space-y-3">
              {assetAlerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#F0FDF4] dark:hover:bg-[#1a1a22] transition-colors cursor-pointer">
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${alert.severity === "CRITICAL" ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" : alert.severity === "HIGH" ? "bg-orange-500" : "bg-amber-500"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa] truncate">{alert.title}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{alert.createdAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Business Context */}
          <Card className="p-5 border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#0f0f13]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Business Context</h3>
            <div className="space-y-3">
              <p className="rounded-lg border border-[#E9ECEF] bg-[#F9FAFB] px-3 py-2 text-xs leading-5 text-[#4B5563] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#CBD5E1]">
                This GAB supports ATM Payment Services.
              </p>
              {asset.cidt.isCustomOverride ? (
                <span className="inline-flex rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#1E3A8A] dark:border-[#1d4ed8]/60 dark:bg-[#0A1A2D] dark:text-[#BFDBFE]">
                  Custom CIDT
                </span>
              ) : null}
              {[
                ["GAB Exposure", asset.gabExposureType],
                ["GAB CIDT", `C${asset.cidt.confidentiality ?? "?"} I${asset.cidt.integrity ?? "?"} D${asset.cidt.availability ?? "?"} T${asset.cidt.traceability ?? "?"}`],
                ["GAB Sensitivity", asset.cidt.sensitivity],
                ["CIDT Source", asset.cidt.sourceLabel ?? "Inherited from ATM Payment Services"],
                ["Application", asset.businessApplication.label],
                ["ATM Payment Services CIDT", `C${asset.businessApplication.cidt.confidentiality} I${asset.businessApplication.cidt.integrity} D${asset.businessApplication.cidt.availability} T${asset.businessApplication.cidt.traceability}`],
                ["ATM Payment Services Profile", `${asset.businessApplication.profile} · ${asset.businessApplication.profileExplanation}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="flex justify-between gap-4">
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{label}</p>
                    <p className="max-w-[65%] text-right text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{value}</p>
                  </div>
                  <Separator className="mt-3 bg-[#F3F4F6] dark:bg-[#27272a]" />
                </div>
              ))}
              {contextMessage ? (
                <p className="text-xs text-[#0C5CAB] dark:text-[#60A5FA]">{contextMessage}</p>
              ) : null}
              {showContextForm ? (
                <div className="space-y-3 rounded-lg border border-[#E9ECEF] bg-[#F9FAFB] p-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
                  <label className="grid gap-1 text-xs font-medium text-[#6B7280] dark:text-[#94A3B8]">
                    GAB exposure
                    <select
                      value={contextForm.gabExposureType}
                      onChange={(event) =>
                        setContextForm((current) => ({
                          ...current,
                          gabExposureType: event.target.value as GabExposureFormValue,
                        }))
                      }
                      className="h-9 rounded-md border border-[#E9ECEF] bg-white px-2 text-sm text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#fafafa]"
                    >
                      {gabExposureOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs leading-5 text-[#1E3A8A] dark:border-[#1d4ed8]/60 dark:bg-[#0A1A2D] dark:text-[#BFDBFE]">
                    Resolved CIDT is currently C{asset.cidt.confidentiality} I
                    {asset.cidt.integrity} D{asset.cidt.availability} T
                    {asset.cidt.traceability} from{" "}
                    {asset.cidt.sourceLabel ?? "ATM Payment Services"}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOverride((current) => !current)}
                    className="text-xs font-semibold text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]"
                  >
                    Advanced: custom GAB CIDT override
                  </button>
                  {showAdvancedOverride ? (
                    <div className="space-y-3 rounded-lg border border-[#E9ECEF] bg-white p-3 dark:border-[#27272a] dark:bg-[#141419]">
                      <p className="text-xs leading-5 text-[#6B7280] dark:text-[#94A3B8]">
                        This GAB inherits CIDT from its exposure template. Set a custom
                        override only if this specific GAB differs from the rest of the
                        fleet.
                      </p>
                      <label className="flex items-center justify-between gap-3 text-xs font-medium text-[#6B7280] dark:text-[#94A3B8]">
                        Enable custom CIDT override
                        <input
                          type="checkbox"
                          checked={contextForm.cidtOverrideEnabled}
                          onChange={(event) =>
                            setContextForm((current) => ({
                              ...current,
                              cidtOverrideEnabled: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-[#D1D5DB]"
                        />
                      </label>
                      {contextForm.cidtOverrideEnabled ? (
                        <div className="grid grid-cols-4 gap-2">
                          {cidtFields.map(([key, label]) => (
                            <label key={key} className="grid gap-1 text-xs font-medium text-[#6B7280] dark:text-[#94A3B8]">
                              {label}
                              <select
                                value={contextForm[key]}
                                onChange={(event) =>
                                  setContextForm((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }
                                className="h-9 rounded-md border border-[#E9ECEF] bg-white px-2 text-sm text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#fafafa]"
                              >
                                {[1, 2, 3, 4].map((value) => (
                                  <option key={value} value={String(value)}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    onClick={saveBusinessContext}
                    disabled={isSavingContext}
                    className="w-full gradient-accent text-[#1A1A2E] dark:text-[#fafafa]"
                  >
                    {isSavingContext ? "Saving..." : "Save context"}
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
