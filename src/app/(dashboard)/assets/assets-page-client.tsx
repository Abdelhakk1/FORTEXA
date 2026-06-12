"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Download, Eye, Landmark, MapPin, Shield, Plus, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SeverityBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import {
  bulkUpdateAssetClassificationAction,
  createAssetAction,
  importAssetsCsvAction,
} from "@/actions/assets";
import { downloadCsv } from "@/lib/download";
import type { AssetsPageData } from "@/lib/services/assets";

interface AssetsPageClientProps {
  data: AssetsPageData;
  filters: {
    search: string;
    type: string;
    regionId: string;
    criticality: string;
    status: string;
    exposureLevel: string;
    gabExposureType: string;
    page: number;
  };
}

const gabExposureOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "indoor_agency", label: "Indoor GAB" },
  { value: "outdoor_agency", label: "Outdoor GAB" },
];

function templateKeyForExposure(value: string) {
  if (value === "indoor_agency") return "indoor_agency";
  if (value === "outdoor_agency") return "outdoor_agency";
  return null;
}

export function AssetsPageClient({ data, filters }: AssetsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [formState, setFormState] = useState({
    assetCode: "",
    name: "",
    regionId: "all",
    branch: "",
    ipAddress: "",
    criticality: "medium",
    exposureLevel: "internal",
    gabExposureType: "unknown",
    cidtTemplateKey: "",
    status: "active",
  });
  const [selectedAssetCodes, setSelectedAssetCodes] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkOperation, setBulkOperation] = useState<
    "set_exposure" | "apply_template" | "clear_custom_override" | "clear_template" | "copy_cidt_from_asset"
  >("apply_template");
  const [bulkExposure, setBulkExposure] = useState("indoor_agency");
  const [bulkTemplateKey, setBulkTemplateKey] = useState("");
  const [bulkSourceAssetCode, setBulkSourceAssetCode] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [csvSummary, setCsvSummary] = useState<{
    totalRows: number;
    createdAssets: number;
    updatedAssets: number;
    errorCount: number;
  } | null>(null);
  const [isCreatingAsset, startCreateAsset] = useTransition();
  const [isImportingCsv, startImportCsv] = useTransition();
  const [isBulkUpdating, startBulkUpdate] = useTransition();

  const activeFilters = useMemo(
    () =>
      [
        filters.type,
        filters.regionId,
        filters.criticality,
        filters.status,
        filters.gabExposureType,
      ].filter((value) => value !== "all").length + (filters.search ? 1 : 0),
    [filters]
  );

  const updateFilters = (next: Partial<AssetsPageClientProps["filters"]>) => {
    const params = new URLSearchParams();
    const merged = {
      ...filters,
      ...next,
    };

    if (merged.search) params.set("search", merged.search);
    if (merged.type !== "all") params.set("type", merged.type);
    if (merged.regionId !== "all") params.set("regionId", merged.regionId);
    if (merged.criticality !== "all") {
      params.set("criticality", merged.criticality);
    }
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.exposureLevel !== "all") {
      params.set("exposureLevel", merged.exposureLevel);
    }
    if (merged.gabExposureType !== "all") {
      params.set("gabExposureType", merged.gabExposureType);
    }
    if ((merged.page ?? 1) > 1) params.set("page", String(merged.page));

    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  };

  const clearFilters = () => {
    router.replace(pathname, { scroll: false });
  };

  const selectedCount = selectedAssetCodes.size;
  const allVisibleSelected =
    data.assets.items.length > 0 &&
    data.assets.items.every((asset) => selectedAssetCodes.has(asset.id));
  const selectedAssetCodeList = Array.from(selectedAssetCodes);
  const selectedExposurePreview = useMemo(() => {
    const templateKey =
      formState.cidtTemplateKey || templateKeyForExposure(formState.gabExposureType);
    const template = templateKey
      ? data.gabCidtTemplates.find((row) => row.templateKey === templateKey)
      : null;

    if (template) {
      return `Resolved CIDT: C${template.cidtConfidentiality} I${template.cidtIntegrity} D${template.cidtAvailability} T${template.cidtTraceability} (${template.sensitivity}) from ${template.label}. Exposure stays ${gabExposureOptions.find((option) => option.value === formState.gabExposureType)?.label ?? "Unknown"}.`;
    }

    return `Resolved CIDT: C${data.atmPaymentServicesCidt.cidtConfidentiality} I${data.atmPaymentServicesCidt.cidtIntegrity} D${data.atmPaymentServicesCidt.cidtAvailability} T${data.atmPaymentServicesCidt.cidtTraceability} (${data.atmPaymentServicesCidt.sensitivity}) from ATM Payment Services`;
  }, [
    data.atmPaymentServicesCidt,
    data.gabCidtTemplates,
    formState.cidtTemplateKey,
    formState.gabExposureType,
  ]);

  const toggleAssetSelection = (assetCode: string) => {
    setSelectedAssetCodes((current) => {
      const next = new Set(current);
      if (next.has(assetCode)) {
        next.delete(assetCode);
      } else {
        next.add(assetCode);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedAssetCodes((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const asset of data.assets.items) {
          next.delete(asset.id);
        }
      } else {
        for (const asset of data.assets.items) {
          next.add(asset.id);
        }
      }
      return next;
    });
  };

  const handleExport = () => {
    downloadCsv({
      filename: "fortexa-assets.csv",
      columns: [
        { key: "id", label: "Asset ID" },
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "branch", label: "Coverage Area" },
        { key: "region", label: "Region" },
        { key: "criticality", label: "Criticality" },
        { key: "exposureLevel", label: "Network Exposure" },
        { key: "gabExposureType", label: "GAB Exposure" },
        { key: "cidtSensitivity", label: "GAB Sensitivity" },
        { key: "vulnerabilityCount", label: "Vulnerability Count" },
        { key: "maxSeverity", label: "Max Severity" },
        { key: "status", label: "Status" },
      ],
      rows: data.assets.items.map((asset) => ({
        ...asset,
        cidtSensitivity: asset.cidt.sensitivity,
      })),
    });
  };

  const submitAsset = () => {
    startCreateAsset(async () => {
      setFormMessage(null);
      const result = await createAssetAction({
        assetCode: formState.assetCode,
        name: formState.name,
        type: "gab",
        branch: formState.branch,
        ipAddress: formState.ipAddress,
        criticality: formState.criticality as Parameters<typeof createAssetAction>[0]["criticality"],
        exposureLevel: formState.exposureLevel as Parameters<typeof createAssetAction>[0]["exposureLevel"],
        gabExposureType:
          formState.gabExposureType as Parameters<typeof createAssetAction>[0]["gabExposureType"],
        cidtTemplateKey: formState.cidtTemplateKey || undefined,
        status: formState.status as Parameters<typeof createAssetAction>[0]["status"],
        regionId: formState.regionId === "all" ? null : formState.regionId,
      });

      if (!result.ok) {
        setFormMessage(result.message);
        return;
      }

      setFormState({
        assetCode: "",
        name: "",
        regionId: "all",
        branch: "",
        ipAddress: "",
        criticality: "medium",
        exposureLevel: "internal",
        gabExposureType: "unknown",
        cidtTemplateKey: "",
        status: "active",
      });
      setFormMessage("Asset created successfully.");
      setShowCreateForm(false);
      router.refresh();
    });
  };

  const submitBulkClassification = () => {
    startBulkUpdate(async () => {
      setFormMessage(null);
      const result = await bulkUpdateAssetClassificationAction({
        assetCodes: selectedAssetCodeList,
        operation: bulkOperation,
        gabExposureType:
          bulkOperation === "set_exposure"
            ? (bulkExposure as Parameters<
                typeof bulkUpdateAssetClassificationAction
              >[0]["gabExposureType"])
            : undefined,
        cidtTemplateKey:
          bulkOperation === "apply_template" ? bulkTemplateKey : undefined,
        sourceAssetCode:
          bulkOperation === "copy_cidt_from_asset" ? bulkSourceAssetCode : undefined,
      });

      if (!result.ok) {
        setFormMessage(result.message);
        return;
      }

      setFormMessage(`${result.data.updated} GAB classification update(s) saved.`);
      setSelectedAssetCodes(new Set());
      router.refresh();
    });
  };

  const submitCsvFile = (file: File | null) => {
    if (!file) {
      return;
    }

    startImportCsv(async () => {
      setCsvMessage(null);
      setCsvSummary(null);
      const formData = new FormData();
      formData.set("file", file);
      const result = await importAssetsCsvAction(formData);

      if (!result.ok) {
        setCsvMessage(result.message);
        return;
      }

      setCsvSummary({
        totalRows: result.data.totalRows,
        createdAssets: result.data.createdAssets,
        updatedAssets: result.data.updatedAssets,
        errorCount: result.data.errors.length,
      });
      setCsvMessage(
        result.data.errors.length > 0
          ? `${result.data.errors.length} row(s) were skipped. Review the CSV and retry if needed.`
          : "CSV asset import completed successfully."
      );
      setShowCsvImport(false);
      router.refresh();
    });
  };

  return (
    <div>
      <PageHeader
        title="GAB Asset Management"
        description={`${data.summary.totalAssets} monitored GABs across ${data.regionOptions.length} regions`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateForm((current) => !current);
                setShowCsvImport(false);
              }}
              className="border-[#E9ECEF] bg-white text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#fafafa]"
            >
              <Plus className="mr-2 h-4 w-4" /> New GAB
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCsvImport((current) => !current);
                setShowCreateForm(false);
              }}
              className="border-[#E9ECEF] bg-white text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#fafafa]"
            >
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={handleExport} className="gradient-accent border-0 text-white">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>
        }
      />

      {(showCreateForm || showCsvImport || formMessage || csvMessage || csvSummary) && (
        <Card className="mb-5 border border-[#E9ECEF] bg-white p-4 dark:border-[#27272a] dark:bg-[#141419]">
          {showCreateForm && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <input value={formState.assetCode} onChange={(event) => setFormState((current) => ({ ...current, assetCode: event.target.value }))} placeholder="Asset code" className="h-10 rounded-lg border border-[#E9ECEF] bg-[#F9FAFB] px-3 text-sm text-[#1A1A2E] outline-none focus:border-[#93C5FD] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]" />
                <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} placeholder="Asset name" className="h-10 rounded-lg border border-[#E9ECEF] bg-[#F9FAFB] px-3 text-sm text-[#1A1A2E] outline-none focus:border-[#93C5FD] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]" />
                <Select value={formState.regionId} onValueChange={(value) => setFormState((current) => ({ ...current, regionId: value || "all" }))}>
                  <SelectTrigger className="h-10 border-[#E9ECEF] bg-[#F9FAFB] text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]"><SelectValue placeholder="Region" /></SelectTrigger>
                  <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                    <SelectItem value="all">Unassigned</SelectItem>
                    {data.regionOptions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input value={formState.branch} onChange={(event) => setFormState((current) => ({ ...current, branch: event.target.value }))} placeholder="Coverage area" className="h-10 rounded-lg border border-[#E9ECEF] bg-[#F9FAFB] px-3 text-sm text-[#1A1A2E] outline-none focus:border-[#93C5FD] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]" />
                <input value={formState.ipAddress} onChange={(event) => setFormState((current) => ({ ...current, ipAddress: event.target.value }))} placeholder="IP address" className="h-10 rounded-lg border border-[#E9ECEF] bg-[#F9FAFB] px-3 text-sm text-[#1A1A2E] outline-none focus:border-[#93C5FD] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]" />
                <Select value={formState.criticality} onValueChange={(value) => setFormState((current) => ({ ...current, criticality: value || "medium" }))}>
                  <SelectTrigger className="h-10 border-[#E9ECEF] bg-[#F9FAFB] text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]"><SelectValue placeholder="Criticality" /></SelectTrigger>
                  <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                    {["critical", "high", "medium", "low"].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={formState.gabExposureType} onValueChange={(value) => setFormState((current) => ({ ...current, gabExposureType: value || "unknown" }))}>
                  <SelectTrigger className="h-10 border-[#E9ECEF] bg-[#F9FAFB] text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]"><SelectValue placeholder="GAB exposure" /></SelectTrigger>
                  <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                    {gabExposureOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={formState.cidtTemplateKey || "default"} onValueChange={(value) => setFormState((current) => ({ ...current, cidtTemplateKey: value === "default" ? "" : value || "" }))}>
                  <SelectTrigger className="h-10 border-[#E9ECEF] bg-[#F9FAFB] text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]"><SelectValue placeholder="CIDT template" /></SelectTrigger>
                  <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                    <SelectItem value="default">Default for exposure</SelectItem>
                    {data.gabCidtTemplates.map((template) => (
                      <SelectItem key={template.templateKey} value={template.templateKey}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-xs leading-5 text-[#1E3A8A] dark:border-[#1d4ed8]/60 dark:bg-[#0A1A2D] dark:text-[#BFDBFE]">
                {selectedExposurePreview}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={submitAsset} disabled={isCreatingAsset} className="gradient-accent border-0 text-white">
                  {isCreatingAsset ? "Creating..." : "Create GAB"}
                </Button>
                <span className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Every asset is treated as a GAB supporting ATM Payment Services.</span>
              </div>
            </div>
          )}

          {showCsvImport && (
            <div className="space-y-3">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(event) => submitCsvFile(event.target.files?.[0] ?? null)}
              />
              <div className="rounded-xl border border-dashed border-[#D1D5DB] p-4 dark:border-[#3a3a42]">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">CSV column contract</p>
                <p className="mt-1 text-xs text-[#6B7280] dark:text-[#94A3B8]">Supported columns: asset_code, name, type, hostname, ip_address, domain, region_code, criticality, gab_exposure_type, cidt_template_key, cidt_confidentiality, cidt_integrity, cidt_availability, cidt_traceability, owner_email, owner_id, coverage area, manufacturer, model, location, os_version, status.</p>
                <Button type="button" onClick={() => csvInputRef.current?.click()} disabled={isImportingCsv} className="mt-3 gradient-accent border-0 text-white">
                  <Upload className="mr-2 h-4 w-4" /> {isImportingCsv ? "Importing..." : "Choose CSV"}
                </Button>
              </div>
            </div>
          )}

          {formMessage && (
            <p className="mt-3 text-sm text-[#0C5CAB] dark:text-[#60A5FA]">{formMessage}</p>
          )}
          {csvMessage && (
            <p className="mt-3 text-sm text-[#0C5CAB] dark:text-[#60A5FA]">{csvMessage}</p>
          )}
          {csvSummary && (
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {[
                { label: "Rows", value: csvSummary.totalRows },
                { label: "Created", value: csvSummary.createdAssets },
                { label: "Updated", value: csvSummary.updatedAssets },
                { label: "Errors", value: csvSummary.errorCount },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[#E9ECEF] bg-[#F9FAFB] p-3 text-center dark:border-[#27272a] dark:bg-[#1a1a22]">
                  <p className="text-xl font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{item.value}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 animate-stagger md:grid-cols-4">
        <Card className="flex flex-col items-center justify-center gap-2 border border-[#E9ECEF] bg-white p-4 text-center dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-[#0A1A2D] dark:text-[#38BDF8]"><Landmark className="h-4 w-4" /></div>
          <div>
            <p className="mb-1 text-3xl font-extrabold leading-none text-[#1A1A2E] dark:text-[#fafafa]">{data.summary.totalAssets}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">Total GABs</p>
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 border border-[#E9ECEF] bg-white p-4 text-center dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0C5CAB]/10 text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]"><Shield className="h-4 w-4" /></div>
          <div>
            <p className="mb-1 text-3xl font-extrabold leading-none text-[#1A1A2E] dark:text-[#fafafa]">{data.summary.gabCount}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">GAB records</p>
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 border border-[#E9ECEF] bg-white p-4 text-center dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-[#1A0A2D] dark:text-[#C084FC]"><Shield className="h-4 w-4" /></div>
          <div>
            <p className="mb-1 text-3xl font-extrabold leading-none text-[#1A1A2E] dark:text-[#fafafa]">{data.summary.unknownGabExposureCount}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">Need classification</p>
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 border border-[#E9ECEF] bg-white p-4 text-center dark:border-[#27272a] dark:bg-[#141419]">
          <div className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-[#3B0F0F] dark:text-[#F87171]"><MapPin className="h-4 w-4" /></div>
          <div>
            <p className="mb-1 text-3xl font-extrabold leading-none text-red-600 dark:text-[#F87171]">{data.summary.outdoorGabs}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">Outdoor GABs</p>
          </div>
        </Card>
      </div>

      {data.summary.unknownGabExposureCount > 0 ? (
        <button
          type="button"
          onClick={() => updateFilters({ gabExposureType: "unknown", page: 1 })}
          className="mb-4 flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15"
        >
          <span className="font-medium">
            {data.summary.unknownGabExposureCount} GAB
            {data.summary.unknownGabExposureCount === 1 ? "" : "s"} need classification
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide">
            Filter unknown
          </span>
        </button>
      ) : null}

      <Card className="mb-4 border border-[#E9ECEF] bg-white p-4 dark:border-[#27272a] dark:bg-[#141419]">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Search GABs, IDs, coverage areas..."
            value={filters.search}
            onChange={(value) => updateFilters({ search: value, page: 1 })}
            className="w-full sm:w-64"
          />
          <Select
            value={filters.type}
            onValueChange={(value) => updateFilters({ type: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[140px]"><SelectValue placeholder="Asset Type" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Types</SelectItem>
              <SelectItem value="atm" className="cursor-pointer">ATM</SelectItem>
              <SelectItem value="gab" className="cursor-pointer">GAB</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.regionId}
            onValueChange={(value) => updateFilters({ regionId: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[200px]"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Regions</SelectItem>
              {data.regionOptions.map((region) => (
                <SelectItem key={region.id} value={region.id} className="cursor-pointer">{region.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.criticality}
            onValueChange={(value) => updateFilters({ criticality: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[140px]"><SelectValue placeholder="Criticality" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Criticality</SelectItem>
              {["critical", "high", "medium", "low"].map((criticality) => (
                <SelectItem key={criticality} value={criticality} className="cursor-pointer">
                  {criticality.charAt(0).toUpperCase() + criticality.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(value) => updateFilters({ status: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All Statuses</SelectItem>
              {["active", "maintenance", "inactive", "decommissioned"].map((status) => (
                <SelectItem key={status} value={status} className="cursor-pointer">
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.gabExposureType}
            onValueChange={(value) => updateFilters({ gabExposureType: value ?? "all", page: 1 })}
          >
            <SelectTrigger className="h-9 w-full cursor-pointer border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] sm:w-[220px]"><SelectValue placeholder="GAB Exposure" /></SelectTrigger>
            <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
              <SelectItem value="all" className="cursor-pointer">All GAB Exposure</SelectItem>
              {gabExposureOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-[#0C5CAB] hover:text-[#0a4a8a] dark:text-[#60A5FA] dark:hover:text-[#93C5FD]"
          >
            Clear
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-3 text-xs text-[#6B7280] dark:border-[#27272a] dark:text-[#94A3B8]">
          <span>{data.assets.total} assets match the current view</span>
          <span>{activeFilters > 0 ? `${activeFilters} filter${activeFilters === 1 ? "" : "s"} active` : "No active filters"}</span>
        </div>
      </Card>

      {selectedCount > 0 ? (
        <Card className="mb-4 border border-[#BFDBFE] bg-[#EFF6FF] p-4 dark:border-[#1d4ed8]/60 dark:bg-[#0A1A2D]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-[#1E3A8A] dark:text-[#BFDBFE]">
              {selectedCount} selected
            </span>
            <Select
              value={bulkOperation}
              onValueChange={(value) =>
                setBulkOperation(
                  (value || "apply_template") as typeof bulkOperation
                )
              }
            >
              <SelectTrigger className="h-9 w-full border-[#BFDBFE] bg-white text-[#1A1A2E] dark:border-[#1d4ed8]/60 dark:bg-[#141419] dark:text-[#fafafa] sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                <SelectItem value="apply_template">Apply CIDT template</SelectItem>
                <SelectItem value="set_exposure">Set exposure only</SelectItem>
                <SelectItem value="clear_custom_override">Clear custom CIDT</SelectItem>
                <SelectItem value="clear_template">Return to default template</SelectItem>
                <SelectItem value="copy_cidt_from_asset">Copy CIDT from GAB</SelectItem>
              </SelectContent>
            </Select>
            {bulkOperation === "set_exposure" ? (
              <Select value={bulkExposure} onValueChange={(value) => setBulkExposure(value || "indoor_agency")}>
                <SelectTrigger className="h-9 w-full border-[#BFDBFE] bg-white text-[#1A1A2E] dark:border-[#1d4ed8]/60 dark:bg-[#141419] dark:text-[#fafafa] sm:w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                  {gabExposureOptions.map((option) => (
                    <SelectItem key={`bulk-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {bulkOperation === "apply_template" ? (
              <Select value={bulkTemplateKey} onValueChange={(value) => setBulkTemplateKey(value || "")}>
                <SelectTrigger className="h-9 w-full border-[#BFDBFE] bg-white text-[#1A1A2E] dark:border-[#1d4ed8]/60 dark:bg-[#141419] dark:text-[#fafafa] sm:w-[260px]">
                  <SelectValue placeholder="CIDT template" />
                </SelectTrigger>
                <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                  {data.gabCidtTemplates.map((template) => (
                    <SelectItem key={`bulk-template-${template.templateKey}`} value={template.templateKey}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {bulkOperation === "copy_cidt_from_asset" ? (
              <Select
                value={bulkSourceAssetCode}
                onValueChange={(value) => setBulkSourceAssetCode(value || "")}
              >
                <SelectTrigger className="h-9 w-full border-[#BFDBFE] bg-white text-[#1A1A2E] dark:border-[#1d4ed8]/60 dark:bg-[#141419] dark:text-[#fafafa] sm:w-[220px]">
                  <SelectValue placeholder="Source GAB" />
                </SelectTrigger>
                <SelectContent className="border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
                  {data.assets.items.map((asset) => (
                    <SelectItem key={`source-${asset.id}`} value={asset.id}>
                      {asset.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
              type="button"
              onClick={submitBulkClassification}
              disabled={isBulkUpdating}
              className="gradient-accent border-0 text-white"
            >
              {isBulkUpdating ? "Saving..." : "Apply"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedAssetCodes(new Set())}
              className="text-[#1E3A8A] hover:bg-white/70 dark:text-[#BFDBFE] dark:hover:bg-[#141419]"
            >
              Clear selection
            </Button>
          </div>
        </Card>
      ) : null}

      {data.assets.items.length === 0 ? (
        <Card className="border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
          <EmptyState
            icon={<Landmark className="h-7 w-7 text-[#0C5CAB] dark:text-[#60A5FA]" />}
            title="No assets match these filters"
            description="Try widening the filters or clear the current search to see the monitored asset inventory again."
            actionLabel="Clear filters"
            onAction={clearFilters}
            compact
          />
        </Card>
      ) : (
        <Card className="overflow-hidden border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]">
          <div className="space-y-3 p-4 md:hidden">
            {data.assets.items.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-[#E9ECEF] p-4 dark:border-[#27272a]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <input
                      type="checkbox"
                      checked={selectedAssetCodes.has(asset.id)}
                      onChange={() => toggleAssetSelection(asset.id)}
                      aria-label={`Select ${asset.id}`}
                      className="mt-1 h-4 w-4 rounded border-[#D1D5DB]"
                    />
                    <div className="min-w-0">
                    <p className="font-mono text-[11px] text-[#6B7280] dark:text-[#64748B]">{asset.id}</p>
                    <Link href={`/assets/${asset.id}`} prefetch={false} className="mt-1 block text-sm font-semibold text-[#1A1A2E] hover:text-[#0C5CAB] dark:text-[#fafafa] dark:hover:text-[#60A5FA]">
                      {asset.name}
                    </Link>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.model}</p>
                    </div>
                  </div>
                  <Link href={`/assets/${asset.id}`} prefetch={false}>
                    <Button variant="ghost" size="sm" aria-label={`Open asset ${asset.name}`} className="h-9 w-9 p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Coverage area</p>
                    <p className="text-[#1A1A2E] dark:text-[#fafafa]">{asset.branch}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">GAB Exposure</p>
                    <p className="text-[#1A1A2E] dark:text-[#fafafa]">{asset.gabExposureType}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Severity</p>
                    <SeverityBadge severity={asset.maxSeverity} />
                  </div>
                  <div>
                    <p className="mb-1 text-[#9CA3AF] dark:text-[#64748B]">Priority</p>
                    <PriorityBadge priority={asset.contextualPriority} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] pt-3 dark:border-[#27272a]">
                  <StatusBadge status={asset.status} />
                  <span className="text-xs font-medium text-[#1A1A2E] dark:text-[#fafafa]">{asset.vulnerabilityCount} vulnerabilities</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select visible GABs"
                        className="h-4 w-4 rounded border-[#D1D5DB]"
                      />
                    </th>
                    {["Asset ID", "Name / Model", "Type", "Coverage / Region", "Criticality", "GAB Exposure", "Vulns", "Max Severity", "Priority", "Status", "Actions"].map((heading) => (
                      <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.assets.items.map((asset) => (
                    <tr key={asset.id} className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a] hover:bg-[#F9FAFB] dark:hover:bg-[#1a1a22]/50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedAssetCodes.has(asset.id)}
                          onChange={() => toggleAssetSelection(asset.id)}
                          aria-label={`Select ${asset.id}`}
                          className="h-4 w-4 rounded border-[#D1D5DB]"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#6B7280] dark:text-[#64748B]">{asset.id}</td>
                      <td className="px-4 py-3">
                        <Link href={`/assets/${asset.id}`} prefetch={false} className="text-sm font-medium text-[#1A1A2E] hover:text-[#0C5CAB] dark:text-[#fafafa] dark:hover:text-[#60A5FA]">{asset.name}</Link>
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.model}</p>
                      </td>
                      <td className="px-4 py-3"><span className="rounded border border-[#E9ECEF] bg-[#F3F4F6] px-2 py-0.5 text-xs font-medium text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8]">{asset.type}</span></td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#1A1A2E] dark:text-[#fafafa]">{asset.branch}</p>
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{asset.region}</p>
                      </td>
                      <td className="px-4 py-3"><SeverityBadge severity={asset.criticality.toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"} /></td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-[#1A1A2E] dark:text-[#fafafa]">{asset.gabExposureType}</span>
                        <p className="mt-0.5 text-[11px] text-[#6B7280] dark:text-[#94A3B8]">
                          {asset.cidt.sensitivity} · {asset.cidt.sourceLabel}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-[#1A1A2E] dark:text-[#fafafa]">{asset.vulnerabilityCount}</td>
                      <td className="px-4 py-3"><SeverityBadge severity={asset.maxSeverity} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={asset.contextualPriority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={asset.status} /></td>
                      <td className="px-4 py-3">
                        <Link href={`/assets/${asset.id}`} prefetch={false} className="cursor-pointer">
                          <Button variant="ghost" size="sm" aria-label={`Open asset ${asset.name}`} className="h-9 w-9 p-0 text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]"><Eye className="h-4 w-4" /></Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationControls
            currentPage={data.assets.page}
            totalPages={data.assets.totalPages}
            totalItems={data.assets.total}
            pageSize={data.assets.pageSize}
            itemLabel="assets"
            onPageChange={(page) => updateFilters({ page })}
          />
        </Card>
      )}
    </div>
  );
}
