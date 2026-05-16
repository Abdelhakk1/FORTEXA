# Graph Report - FORTEXA  (2026-05-14)

## Corpus Check
- 207 files · ~110,764 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 904 nodes · 1555 edges · 26 communities detected
- Extraction: 70% EXTRACTED · 30% INFERRED · 0% AMBIGUOUS · INFERRED: 472 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 94 edges
2. `ok()` - 33 edges
3. `processScanImport()` - 28 edges
4. `measureServerTiming()` - 27 edges
5. `toActionResult()` - 24 edges
6. `importAssetsFromCsv()` - 22 edges
7. `GET()` - 21 edges
8. `requireActiveOrganization()` - 21 edges
9. `logAuditEvent()` - 21 edges
10. `Boolean()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Dashboard Design System Skill` --semantically_similar_to--> `Fortexa Design System`  [INFERRED] [semantically similar]
  dashboard-SKILL.md → DESIGN.md
- `Component Families` --semantically_similar_to--> `Product Components`  [INFERRED] [semantically similar]
  dashboard-SKILL.md → DESIGN.md
- `proxy()` --calls--> `startServerTiming()`  [INFERRED]
  proxy.ts → src/lib/observability/timing.ts
- `main()` --calls--> `getDb()`  [INFERRED]
  scripts/av-enrichment-smoke.ts → src/db/index.ts
- `fail()` --calls--> `GET()`  [INFERRED]
  scripts/reset-test-database.mjs → src/app/api/live-updates/route.ts

## Hyperedges (group relationships)
- **Deterministic Ingestion Flow** — readme_asset_entry_paths, readme_deterministic_asset_matching, readme_scan_import_flow, readme_assets_table, readme_asset_vulnerabilities_record [EXTRACTED 1.00]
- **Operator Trust AI Pattern** — readme_ai_enrichment_flow, readme_openrouter_contract, readme_trust_metadata, readme_trust_panel, readme_asset_vulnerability_detail_view [EXTRACTED 1.00]
- **Fortexa Dashboard Visual System** — design_fortexa_design_system, design_fortexa_blue, design_ibm_plex_sans, design_dashboard_layout, dashboard_style_foundations [INFERRED 0.82]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (58): retryCveEnrichmentAction(), requireAnyRole(), requireAuth(), requirePermission(), requireRole(), DashboardLayout(), formatRoleLabel(), getInitials() (+50 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (64): acknowledgeAllNewAlerts(), buildAlertWhere(), listAlerts(), listRecentAlertActivity(), updateAlertStatus(), inferAssetContext(), metadataText(), normalize() (+56 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (50): bulkUpdateAssetClassification(), classifyAssetByRules(), ensureGabCidtTemplates(), listAssetClassificationRules(), normalizeTemplatesForInsert(), replaceAssetClassificationRules(), updateGabCidtTemplates(), asArray() (+42 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (52): Accessibility Requirements, Component Families, Dashboard Brand, Dashboard Design System Skill, Guideline Authoring Workflow, Quality Gates, Style Foundations, Authenticated Work Surface (+44 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (32): acknowledgeAlertAction(), acknowledgeAllAlertsAction(), dismissAlertAction(), resolveAlertAction(), enableAiPlaybooksAction(), retryAssetVulnerabilityEnrichmentAction(), startAssetVulnerabilityEnrichmentAction(), updateAssetVulnerabilityStatusAction() (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (37): buildDigitalOceanGradientChatPayload(), buildDigitalOceanGradientRequestPayload(), buildNormalizedError(), citationKindFromUnknown(), citationsFromUnknown(), cleanNullableText(), cleanText(), confidenceFromUnknown() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (30): runRlsPolicyChecks(), getProtectedAreaLiveToken(), toLiveScope(), getSafeRedirectPath(), isSafePathname(), GET(), getClientIp(), POST() (+22 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (26): createSupabaseAdminClient(), buildCveEnrichmentFingerprint(), buildCveEnrichmentPrompt(), getProcessingStartedAt(), isActiveProcessing(), isProcessingStale(), loadCveEnrichmentContext(), queueCveEnrichment() (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (31): buildAssetVulnerabilityPlaybookPrompt(), buildAssetBusinessContext(), applicationProfileExplanation(), applicationProfileRank(), businessPriorityFromRiskScore(), calculateApplicationProfile(), calculateBusinessPriority(), calculateCidtSensitivity() (+23 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (22): mapAlertRow(), getAssetVulnerabilityDetail(), prioritySummaryFromFactors(), buildScanDeltaReport(), createScanImportRecord(), getScanImportDetail(), mapScanImportRow(), normalizeScanImportErrorDetails() (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (23): acceptOrganizationInviteAction(), InvitePage(), checkRateLimit(), cleanup(), getRateLimitRetryAfterSeconds(), coerceInviteRole(), createInviteToken(), getInviteAcceptanceError() (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (22): aggregateAssetVulnerabilityScannerEvidence(), buildInputHash(), calculateEvidenceBasedPlaybookTrust(), compact(), compactList(), compactRequired(), getEvidenceDedupeKey(), getEvidenceScope() (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (9): collectBackground(), navigateAndSample(), createConfirmedUser(), findRoleId(), createSupabaseAdminClient(), ensureSmokeUser(), findAuthUserByEmail(), getRequiredEnv() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.2
Nodes (11): assertRequiredEnv(), collectStoragePaths(), columnExists(), countAiCveRecommendedControls(), countRows(), existingTables(), fail(), qualifiedTable() (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (7): AssetDetailClient(), DashboardCharts(), getPreferredTheme(), getSnapshot(), useTheme(), Topbar(), VulnerabilitiesPageClient()

### Community 15 - "Community 15"
Cohesion: 0.31
Nodes (10): emailLooksValid(), focusInput(), handleMfaChange(), handleMfaKeyDown(), handleMfaStep(), handlePasswordStep(), handleSignUp(), handleSubmit() (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.26
Nodes (11): dispatchOrganizationNotification(), listRecipients(), readBoolean(), shouldSendNotification(), buildTeamInviteEmail(), escapeHtml(), getResendClient(), hasResendEmailConfig() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.29
Nodes (4): downloadCsv(), exportQueue(), openTask(), toTaskFormState()

### Community 23 - "Community 23"
Cohesion: 0.38
Nodes (3): createCookieHeader(), createEphemeralUser(), getRequiredEnv()

### Community 27 - "Community 27"
Cohesion: 0.7
Nodes (4): createCookieHeader(), createEphemeralCredentials(), getCredentials(), getRequiredEnv()

### Community 31 - "Community 31"
Cohesion: 0.83
Nodes (3): createCookieHeader(), createEphemeralUser(), getRequiredEnv()

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (2): Badge(), cn()

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (2): handleDrop(), submitFile()

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (2): addInngestBreadcrumb(), readString()

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (2): getAiPlaybookStateMessage(), getAssetVulnerabilityBannerMessage()

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (3): Next.js Agent Rules, Next.js Dist Docs, AGENTS.md Reference

## Knowledge Gaps
- **23 isolated node(s):** `Dashboard Brand`, `Style Foundations`, `Guideline Authoring Workflow`, `Disabled Importers`, `Canonical Importer Rationale` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 33`** (4 nodes): `Badge()`, `badge.tsx`, `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (3 nodes): `handleDrop()`, `submitFile()`, `scan-import-page-client.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (3 nodes): `addInngestBreadcrumb()`, `readString()`, `functions.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (3 nodes): `getAiPlaybookStateMessage()`, `getAssetVulnerabilityBannerMessage()`, `asset-vulnerability-ai-state.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 16`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Why does `GET()` connect `Community 6` to `Community 0`, `Community 1`, `Community 2`, `Community 8`, `Community 10`, `Community 13`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `Boolean()` connect `Community 11` to `Community 2`, `Community 5`, `Community 6`, `Community 7`, `Community 14`, `Community 16`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Are the 93 inferred relationships involving `getDb()` (e.g. with `main()` and `logAuditEvent()`) actually correct?**
  _`getDb()` has 93 INFERRED edges - model-reasoned connections that need verification._
- **Are the 32 inferred relationships involving `ok()` (e.g. with `generateReportAction()` and `createReportDownloadUrlAction()`) actually correct?**
  _`ok()` has 32 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `processScanImport()` (e.g. with `getDb()` and `getFortexaStorageBuckets()`) actually correct?**
  _`processScanImport()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 25 inferred relationships involving `measureServerTiming()` (e.g. with `createRemediationTaskAction()` and `updateRemediationStatusAction()`) actually correct?**
  _`measureServerTiming()` has 25 INFERRED edges - model-reasoned connections that need verification._