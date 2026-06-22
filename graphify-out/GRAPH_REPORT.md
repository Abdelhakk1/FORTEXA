# Graph Report - FORTEXA  (2026-06-22)

## Corpus Check
- 214 files · ~129,375 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1003 nodes · 1809 edges · 28 communities detected
- Extraction: 70% EXTRACTED · 30% INFERRED · 0% AMBIGUOUS · INFERRED: 550 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 102 edges
2. `ok()` - 35 edges
3. `processScanImport()` - 31 edges
4. `GET()` - 30 edges
5. `Boolean()` - 30 edges
6. `measureServerTiming()` - 27 edges
7. `toActionResult()` - 24 edges
8. `getAssetVulnerabilityDetail()` - 24 edges
9. `logAuditEvent()` - 22 edges
10. `importAssetsFromCsv()` - 22 edges

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
Cohesion: 0.07
Nodes (57): resolveAssetVulnerabilityIdFromRoute(), getDb(), saveOnboardingWorkspaceAction(), completeOrganizationOnboarding(), createOrganizationForUser(), defaultSettingsValues(), deriveLegacyContext(), ensureAdministratorRole() (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (54): updateAssetVulnerabilityStatus(), buildAssetBusinessContext(), buildAssetWhere(), applicationProfileExplanation(), applicationProfileRank(), businessPriorityLabel(), businessRankV2(), calculateApplicationProfile() (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (50): checkAiGenerationBudget(), getAiBudgetLimits(), startOfUtcDay(), aggregateAssetVulnerabilityScannerEvidence(), buildAssetVulnerabilityPlaybookPrompt(), buildInputHash(), buildRankPeerContext(), calculateEvidenceBasedPlaybookTrust() (+42 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (52): applyAssetClassificationRulesToUnknownAssets(), classifyAssetByRules(), listAssetClassificationRules(), asArray(), asText(), buildRawEvidence(), buildSlaDueDate(), buildSlaStatus() (+44 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (38): acknowledgeAllNewAlerts(), buildAlertWhere(), listAlerts(), listRecentAlertActivity(), updateAlertStatus(), buildWhere(), listAssetVulnerabilities(), listAssets() (+30 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (52): Accessibility Requirements, Component Families, Dashboard Brand, Dashboard Design System Skill, Guideline Authoring Workflow, Quality Gates, Style Foundations, Authenticated Work Surface (+44 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (35): acknowledgeAlertAction(), acknowledgeAllAlertsAction(), dismissAlertAction(), resolveAlertAction(), enableAiPlaybooksAction(), logActionException(), logAuditEventSafe(), retryAssetVulnerabilityEnrichmentAction() (+27 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (37): retryCveEnrichmentAction(), acceptOrganizationInviteAction(), getRequestAuditContext(), logAuditEvent(), completeOnboardingAction(), saveOnboardingEnvironmentAction(), saveOnboardingRemediationPolicyAction(), seedSampleAssetsAction() (+29 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (39): buildDigitalOceanGradientChatPayload(), buildDigitalOceanGradientRequestPayload(), buildNormalizedError(), citationKindFromUnknown(), citationsFromUnknown(), cleanNullableText(), cleanText(), confidenceFromUnknown() (+31 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (28): mapAlertRow(), buildReadableSignalList(), compactJoin(), getAssetVulnerabilityDetail(), summarizeExposureByAsset(), formatPriorityFactorSummary(), prioritySummaryFromFactors(), simplifyGabExposureText() (+20 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (19): runRlsPolicyChecks(), getProtectedAreaLiveToken(), toLiveScope(), checkRateLimit(), cleanup(), getRateLimitRetryAfterSeconds(), buildRemediationCampaignSignature(), compactTitle() (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (20): inferAssetContext(), metadataText(), normalize(), createAsset(), getAssetDetail(), mapAssets(), updateAssetBusinessContext(), ensureAtmPaymentServicesApplication() (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (20): arrayOfRecords(), cleanText(), dedupeTrustedSourceCandidates(), extractEpssScoreFromSource(), extractNvdCvssFacts(), fetchCisaKevTrustedSource(), fetchEpssTrustedSource(), fetchJson() (+12 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (9): collectBackground(), navigateAndSample(), createConfirmedUser(), findRoleId(), createSupabaseAdminClient(), ensureSmokeUser(), findAuthUserByEmail(), getRequiredEnv() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.1
Nodes (7): AssetDetailClient(), DashboardCharts(), getPreferredTheme(), getSnapshot(), useTheme(), Topbar(), VulnerabilitiesPageClient()

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (16): createSupabaseAdminClient(), asRows(), buildExecutiveExposureReport(), buildRemediationBacklogReport(), buildReport(), buildScanDeltaReport(), buildStoragePath(), createReportDownloadUrl() (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.2
Nodes (11): assertRequiredEnv(), collectStoragePaths(), columnExists(), countAiCveRecommendedControls(), countRows(), existingTables(), fail(), qualifiedTable() (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.31
Nodes (10): emailLooksValid(), focusInput(), handleMfaChange(), handleMfaKeyDown(), handleMfaStep(), handlePasswordStep(), handleSignUp(), handleSubmit() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.26
Nodes (11): dispatchOrganizationNotification(), listRecipients(), readBoolean(), shouldSendNotification(), buildTeamInviteEmail(), escapeHtml(), getResendClient(), hasResendEmailConfig() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (4): downloadCsv(), exportQueue(), openTask(), toTaskFormState()

### Community 25 - "Community 25"
Cohesion: 0.38
Nodes (3): createCookieHeader(), createEphemeralUser(), getRequiredEnv()

### Community 29 - "Community 29"
Cohesion: 0.7
Nodes (4): createCookieHeader(), createEphemeralCredentials(), getCredentials(), getRequiredEnv()

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (2): handleDrop(), submitFile()

### Community 34 - "Community 34"
Cohesion: 0.83
Nodes (3): createCookieHeader(), createEphemeralUser(), getRequiredEnv()

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (2): Badge(), cn()

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (2): addInngestBreadcrumb(), readString()

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (2): getAiPlaybookStateMessage(), getAssetVulnerabilityBannerMessage()

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (3): Next.js Agent Rules, Next.js Dist Docs, AGENTS.md Reference

## Knowledge Gaps
- **23 isolated node(s):** `Dashboard Brand`, `Style Foundations`, `Guideline Authoring Workflow`, `Disabled Importers`, `Canonical Importer Rationale` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 30`** (5 nodes): `aiEnrichmentLabel()`, `handleDrop()`, `importStatusLabel()`, `submitFile()`, `scan-import-page-client.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (4 nodes): `Badge()`, `badge.tsx`, `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (3 nodes): `addInngestBreadcrumb()`, `readString()`, `functions.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (3 nodes): `getAiPlaybookStateMessage()`, `getAssetVulnerabilityBannerMessage()`, `asset-vulnerability-ai-state.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 15`, `Community 19`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Why does `GET()` connect `Community 10` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 7`, `Community 9`, `Community 11`, `Community 12`, `Community 16`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `Boolean()` connect `Community 2` to `Community 1`, `Community 3`, `Community 8`, `Community 9`, `Community 12`, `Community 14`, `Community 19`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Are the 101 inferred relationships involving `getDb()` (e.g. with `main()` and `logAuditEvent()`) actually correct?**
  _`getDb()` has 101 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `ok()` (e.g. with `generateReportAction()` and `createReportDownloadUrlAction()`) actually correct?**
  _`ok()` has 34 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `processScanImport()` (e.g. with `getDb()` and `getFortexaStorageBuckets()`) actually correct?**
  _`processScanImport()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `GET()` (e.g. with `runRlsPolicyChecks()` and `getSafeRedirectPath()`) actually correct?**
  _`GET()` has 27 INFERRED edges - model-reasoned connections that need verification._