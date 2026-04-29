# Graph Report - FORTEXA  (2026-04-28)

## Corpus Check
- 192 files · ~93,784 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 786 nodes · 1234 edges · 23 communities detected
- Extraction: 69% EXTRACTED · 31% INFERRED · 0% AMBIGUOUS · INFERRED: 379 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 80 edges
2. `ok()` - 30 edges
3. `measureServerTiming()` - 24 edges
4. `processScanImport()` - 24 edges
5. `requireActiveOrganization()` - 21 edges
6. `toActionResult()` - 21 edges
7. `logAuditEvent()` - 18 edges
8. `requirePermission()` - 15 edges
9. `GET()` - 14 edges
10. `err()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Dashboard Design System Skill` --semantically_similar_to--> `Fortexa Design System`  [INFERRED] [semantically similar]
  dashboard-SKILL.md → DESIGN.md
- `Component Families` --semantically_similar_to--> `Product Components`  [INFERRED] [semantically similar]
  dashboard-SKILL.md → DESIGN.md
- `proxy()` --calls--> `startServerTiming()`  [INFERRED]
  proxy.ts → src/lib/observability/timing.ts
- `main()` --calls--> `getDb()`  [INFERRED]
  scripts/av-enrichment-smoke.ts → src/db/index.ts
- `main()` --calls--> `runAssetVulnerabilityEnrichment()`  [INFERRED]
  scripts/av-enrichment-smoke.ts → src/lib/services/asset-vulnerability-enrichment.ts

## Hyperedges (group relationships)
- **Deterministic Ingestion Flow** — readme_asset_entry_paths, readme_deterministic_asset_matching, readme_scan_import_flow, readme_assets_table, readme_asset_vulnerabilities_record [EXTRACTED 1.00]
- **Operator Trust AI Pattern** — readme_ai_enrichment_flow, readme_openrouter_contract, readme_trust_metadata, readme_trust_panel, readme_asset_vulnerability_detail_view [EXTRACTED 1.00]
- **Fortexa Dashboard Visual System** — design_fortexa_design_system, design_fortexa_blue, design_ibm_plex_sans, design_dashboard_layout, dashboard_style_foundations [INFERRED 0.82]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (60): createSupabaseAdminClient(), aggregateAssetVulnerabilityScannerEvidence(), buildAssetVulnerabilityPlaybookPrompt(), buildInputHash(), compact(), compactList(), compactRequired(), getEvidenceDedupeKey() (+52 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (42): acknowledgeAllNewAlerts(), buildAlertWhere(), listAlerts(), listRecentAlertActivity(), updateAlertStatus(), inferAssetContext(), metadataText(), normalize() (+34 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (44): resolveAssetVulnerabilityIdFromRoute(), getDb(), completeOrganizationOnboarding(), createOrganizationForUser(), defaultSettingsValues(), deriveLegacyContext(), ensureAdministratorRole(), ensureOrganizationSettings() (+36 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (47): asArray(), asText(), buildRawEvidence(), buildSlaDueDate(), buildSlaStatus(), businessPriorityFromRisk(), calculateRiskScore(), createAssetCodeGenerator() (+39 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (52): Accessibility Requirements, Component Families, Dashboard Brand, Dashboard Design System Skill, Guideline Authoring Workflow, Quality Gates, Style Foundations, Authenticated Work Surface (+44 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (29): acknowledgeAlertAction(), acknowledgeAllAlertsAction(), dismissAlertAction(), resolveAlertAction(), enableAiPlaybooksAction(), retryAssetVulnerabilityEnrichmentAction(), updateAssetVulnerabilityStatusAction(), createAssetAction() (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (21): mapAlertRow(), getAssetVulnerabilityDetail(), ScanImportDetailPage(), createScanImportRecord(), getScanImportDetail(), mapScanImportRow(), normalizeScanImportErrorDetails(), toStringList() (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (19): getProtectedAreaLiveToken(), toLiveScope(), getSafeRedirectPath(), isSafePathname(), assertRequiredEnv(), collectStoragePaths(), columnExists(), countRows() (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (23): buildNormalizedError(), createModelAttemptList(), enrichCveContent(), estimateTokenCount(), extractAssistantPayload(), extractOpenRouterBodyMessage(), extractTextPart(), findErrorInChain() (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (19): main(), buildCveEnrichmentFingerprint(), buildCveEnrichmentPrompt(), getProcessingStartedAt(), isActiveProcessing(), isProcessingStale(), loadCveEnrichmentContext(), queueCveEnrichment() (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (19): InvitePage(), coerceInviteRole(), createInviteToken(), getInviteAcceptanceError(), getInviteDisplayStatus(), hashInviteToken(), normalizeEmail(), acceptOrganizationInvite() (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (9): collectBackground(), navigateAndSample(), createConfirmedUser(), findRoleId(), createSupabaseAdminClient(), ensureSmokeUser(), findAuthUserByEmail(), getRequiredEnv() (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (7): AssetDetailClient(), DashboardCharts(), getPreferredTheme(), getSnapshot(), useTheme(), Topbar(), VulnerabilitiesPageClient()

### Community 13 - "Community 13"
Cohesion: 0.31
Nodes (10): emailLooksValid(), focusInput(), handleMfaChange(), handleMfaKeyDown(), handleMfaStep(), handlePasswordStep(), handleSignUp(), handleSubmit() (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (4): downloadCsv(), exportQueue(), openTask(), toTaskFormState()

### Community 19 - "Community 19"
Cohesion: 0.38
Nodes (3): createCookieHeader(), createEphemeralUser(), getRequiredEnv()

### Community 21 - "Community 21"
Cohesion: 0.4
Nodes (2): classify(), extractBodyMessage()

### Community 24 - "Community 24"
Cohesion: 0.7
Nodes (4): createCookieHeader(), createEphemeralCredentials(), getCredentials(), getRequiredEnv()

### Community 28 - "Community 28"
Cohesion: 0.83
Nodes (3): createCookieHeader(), createEphemeralUser(), getRequiredEnv()

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (2): Badge(), cn()

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (2): handleDrop(), submitFile()

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (2): getAiPlaybookStateMessage(), getAssetVulnerabilityBannerMessage()

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (3): Next.js Agent Rules, Next.js Dist Docs, AGENTS.md Reference

## Knowledge Gaps
- **23 isolated node(s):** `Dashboard Brand`, `Style Foundations`, `Guideline Authoring Workflow`, `Disabled Importers`, `Canonical Importer Rationale` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 21`** (6 nodes): `classify()`, `extractBodyMessage()`, `extractTextPart()`, `normalizeStructuredJsonText()`, `printResult()`, `openrouter-smoke.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (4 nodes): `Badge()`, `badge.tsx`, `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (3 nodes): `handleDrop()`, `submitFile()`, `scan-import-page-client.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (3 nodes): `getAiPlaybookStateMessage()`, `getAssetVulnerabilityBannerMessage()`, `asset-vulnerability-ai-state.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Why does `GET()` connect `Community 7` to `Community 0`, `Community 1`, `Community 3`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `processScanImport()` connect `Community 3` to `Community 0`, `Community 9`, `Community 2`, `Community 7`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 79 inferred relationships involving `getDb()` (e.g. with `main()` and `logAuditEvent()`) actually correct?**
  _`getDb()` has 79 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `ok()` (e.g. with `generateReportAction()` and `createReportDownloadUrlAction()`) actually correct?**
  _`ok()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `measureServerTiming()` (e.g. with `createRemediationTaskAction()` and `updateRemediationStatusAction()`) actually correct?**
  _`measureServerTiming()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `processScanImport()` (e.g. with `getDb()` and `getFortexaStorageBuckets()`) actually correct?**
  _`processScanImport()` has 6 INFERRED edges - model-reasoned connections that need verification._