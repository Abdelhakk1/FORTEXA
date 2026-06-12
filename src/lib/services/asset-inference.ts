import "server-only";

type AssetType =
  | "atm"
  | "gab"
  | "kiosk"
  | "server"
  | "network_device"
  | "workstation"
  | "other";

export interface AssetInferenceInput {
  name: string;
  type: AssetType;
  manufacturer?: string | null;
  model?: string | null;
  osVersion?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AssetInferenceResult {
  role:
    | "gab_terminal"
    | "gab_connectivity_component"
    | "gab_maintenance_component"
    | "gab_operator_console"
    | "unknown";
  siteArchetype:
    | "gab_area"
    | "gab_connectivity"
    | "gab_maintenance"
    | "unknown";
  confidence: number;
  reasons: string[];
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function metadataText(metadata: Record<string, unknown> | null | undefined) {
  return Object.values(metadata ?? {})
    .flatMap((value) =>
      typeof value === "string"
        ? [value]
        : value && typeof value === "object"
          ? Object.values(value).filter(
              (entry): entry is string => typeof entry === "string"
            )
          : []
    )
    .join(" ")
    .toLowerCase();
}

export function inferAssetContext(
  input: AssetInferenceInput
): AssetInferenceResult {
  const haystack = [
    normalize(input.name),
    normalize(input.manufacturer),
    normalize(input.model),
    normalize(input.osVersion),
    metadataText(input.metadata),
  ]
    .filter(Boolean)
    .join(" ");
  const reasons: string[] = [];

  if (
    input.type === "atm" ||
    input.type === "gab" ||
    /(?:\batm\b|\bgab\b|\bxfs\b|diebold|wincor|ncr|hyosung)/.test(haystack)
  ) {
    reasons.push("scanner evidence matches GAB device vocabulary");
    return {
      role: "gab_terminal",
      siteArchetype: "gab_area",
      confidence: 92,
      reasons,
    };
  }

  if (
    input.type === "network_device" &&
    /(?:router|switch|firewall|wan|branch|cisco|juniper|fortinet|mikrotik)/.test(
      haystack
    )
  ) {
    reasons.push("device type and scanner strings suggest GAB connectivity equipment");
    return {
      role: "gab_connectivity_component",
      siteArchetype: "gab_connectivity",
      confidence: 88,
      reasons,
    };
  }

  if (
    input.type === "server" &&
    /(?:vendor|support|managed|maintenance|middleware|monitoring)/.test(haystack)
  ) {
    reasons.push("scanner strings suggest a GAB maintenance service component");
    return {
      role: "gab_maintenance_component",
      siteArchetype: "gab_maintenance",
      confidence: 76,
      reasons,
    };
  }

  if (
    input.type === "workstation" ||
    /(?:desktop|workstation|laptop|windows 10|windows 11)/.test(haystack)
  ) {
    reasons.push("host profile matches a GAB operations console");
    return {
      role: "gab_operator_console",
      siteArchetype: "gab_maintenance",
      confidence: 74,
      reasons,
    };
  }

  if (/support|helpdesk|ops terminal|jumpbox|bastion/.test(haystack)) {
    reasons.push("naming suggests a support or maintenance terminal");
    return {
      role: "gab_maintenance_component",
      siteArchetype: "gab_maintenance",
      confidence: 70,
      reasons,
    };
  }

  reasons.push("insufficient deterministic evidence for a more specific archetype");
  return {
    role: "unknown",
    siteArchetype: "unknown",
    confidence: 35,
    reasons,
  };
}
