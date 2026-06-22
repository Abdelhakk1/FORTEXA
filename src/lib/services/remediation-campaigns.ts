import "server-only";

import { createHash } from "node:crypto";

export const MS17_010_CVE_IDS = new Set([
  "CVE-2017-0143",
  "CVE-2017-0144",
  "CVE-2017-0145",
  "CVE-2017-0146",
  "CVE-2017-0147",
  "CVE-2017-0148",
]);

type RemediationCampaignBasis =
  | "kb"
  | "ms17_010"
  | "nessus_plugin"
  | "solution"
  | "title"
  | "same_cve";

export interface RemediationCampaignSignature {
  key: string;
  title: string;
  basis: RemediationCampaignBasis;
  rationale: string;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/cve-\d{4}-\d{4,}/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 14);
}

function extractMicrosoftKb(value: string) {
  const text = value.replace(/\s+/g, " ");
  const direct = text.match(/\bKB\s*([0-9]{6,8})\b/i);
  const update = text.match(/\bSecurity Update\s+([0-9]{6,8})\b/i);
  const id = direct?.[1] ?? update?.[1];

  return id ? `KB${id}` : null;
}

function kbDisplayTitle(kbId: string, value: string) {
  const title = value
    .replace(new RegExp(`^${kbId}\\s*:\\s*`, "i"), "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\bVersion\s+\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return `${kbId} — ${compactTitle(title) ?? "Windows Security Update"}`;
}

export function formatCvePreview(cveIds: string[], limit = 5) {
  const shown = cveIds.slice(0, limit).join(", ");
  const hidden = cveIds.length - limit;

  return hidden > 0
    ? `${shown} +${hidden} other CVE${hidden === 1 ? "" : "s"}`
    : shown;
}

function compactTitle(value: string | null | undefined) {
  const text = (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*\([^)]*CVE-\d{4}-\d{4,}[^)]*\)\s*/gi, " ")
    .trim();

  if (!text) {
    return null;
  }

  return text.length > 96 ? `${text.slice(0, 93).trim()}...` : text;
}

export function buildRemediationCampaignSignature(input: {
  cveId: string;
  cveTitle?: string | null;
  scannerFindingCode?: string | null;
  scannerFindingTitle?: string | null;
  remediationText?: string | null;
}): RemediationCampaignSignature {
  const cveId = input.cveId.toUpperCase();
  const searchableText = normalizeText(
    [
      input.scannerFindingCode,
      input.scannerFindingTitle,
      input.cveTitle,
      input.remediationText,
      cveId,
    ].join(" ")
  );
  const isMs17_010 =
    MS17_010_CVE_IDS.has(cveId) ||
    /\bms17\s*010\b/.test(searchableText) ||
    /\beternalblue\b/.test(searchableText) ||
    input.scannerFindingCode === "97833";

  if (isMs17_010) {
    return {
      key: "campaign:ms17-010",
      title: "MS17-010 / EternalBlue remediation campaign",
      basis: "ms17_010",
      rationale: "same Microsoft MS17-010 update and remediation path",
    };
  }

  const kbId = extractMicrosoftKb(
    [
      input.scannerFindingTitle,
      input.cveTitle,
      input.remediationText,
    ].join(" ")
  );

  if (kbId) {
    const sourceTitle = input.scannerFindingTitle ?? input.cveTitle ?? "";

    return {
      key: `campaign:kb:${kbId.toLowerCase()}`,
      title: `${kbDisplayTitle(kbId, sourceTitle)} remediation campaign`,
      basis: "kb",
      rationale: `same Microsoft ${kbId} update`,
    };
  }

  const normalizedSolution = normalizeText(input.remediationText);
  const normalizedTitle = normalizeText(
    input.scannerFindingTitle ?? input.cveTitle
  );
  const pluginCode = input.scannerFindingCode?.trim();

  if (pluginCode && (normalizedSolution || normalizedTitle)) {
    const fingerprint = shortHash(`${pluginCode}|${normalizedSolution || normalizedTitle}`);

    return {
      key: `campaign:nessus:${pluginCode}:${fingerprint}`,
      title: `${compactTitle(input.scannerFindingTitle ?? input.cveTitle) ?? `Nessus plugin ${pluginCode}`} remediation campaign`,
      basis: "nessus_plugin",
      rationale: "same Nessus plugin and remediation path",
    };
  }

  if (normalizedSolution) {
    return {
      key: `campaign:solution:${shortHash(normalizedSolution)}`,
      title: `${compactTitle(input.cveTitle) ?? cveId} remediation campaign`,
      basis: "solution",
      rationale: "same remediation guidance",
    };
  }

  if (normalizedTitle) {
    return {
      key: `campaign:title:${shortHash(normalizedTitle)}`,
      title: `${compactTitle(input.cveTitle) ?? cveId} remediation campaign`,
      basis: "title",
      rationale: "same scanner title and remediation family",
    };
  }

  return {
    key: `campaign:cve:${cveId.toLowerCase()}`,
    title: `${cveId} remediation campaign`,
    basis: "same_cve",
    rationale: "same CVE across GABs",
  };
}
