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
    | "atm_controller"
    | "branch_router"
    | "vendor_managed_server"
    | "workstation"
    | "support_terminal"
    | "unknown";
  siteArchetype:
    | "atm_lane"
    | "branch_edge"
    | "vendor_support"
    | "user_endpoint"
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
    reasons.push("scanner evidence matches ATM/GAB device vocabulary");
    return {
      role: "atm_controller",
      siteArchetype: "atm_lane",
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
    reasons.push("device type and scanner strings match branch-edge network gear");
    return {
      role: "branch_router",
      siteArchetype: "branch_edge",
      confidence: 88,
      reasons,
    };
  }

  if (
    input.type === "server" &&
    /(?:vendor|support|managed|maintenance|middleware|monitoring)/.test(haystack)
  ) {
    reasons.push("server strings suggest vendor-managed or support infrastructure");
    return {
      role: "vendor_managed_server",
      siteArchetype: "vendor_support",
      confidence: 76,
      reasons,
    };
  }

  if (
    input.type === "workstation" ||
    /(?:desktop|workstation|laptop|windows 10|windows 11)/.test(haystack)
  ) {
    reasons.push("host profile matches a user endpoint or operator workstation");
    return {
      role: "workstation",
      siteArchetype: "user_endpoint",
      confidence: 74,
      reasons,
    };
  }

  if (/support|helpdesk|ops terminal|jumpbox|bastion/.test(haystack)) {
    reasons.push("naming suggests a support or maintenance terminal");
    return {
      role: "support_terminal",
      siteArchetype: "vendor_support",
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
