# FORTEXA MVP Operations Flow

FORTEXA is a Next.js + Supabase vulnerability-operations MVP for ATM, GAB, branch, and edge environments. This phase keeps the current app architecture and design language intact while making the product more credible for real operators: deterministic lifecycle tracking, delta-aware Nessus imports, assignable remediation work, and persisted OpenRouter-backed playbooks with trust metadata.

## Canonical Importer

- Active MVP scan importer: `Nessus (.nessus)`
- Disabled in the UI for now: `OpenVAS`, `Nmap`, `Qualys`
- Reason: the current schema and workflow are already aligned with Nessus-style findings, CVE linkage, and remediation operations

## How Assets Enter The System

FORTEXA supports three stable asset entry paths:

1. Manual asset creation on `/assets`
2. CSV asset import on `/assets`
3. Nessus scan import on `/scan-import`

All three paths write into the same `assets` table and use deterministic matching:

1. `asset_code` when explicitly supplied
2. external scanner asset ID
3. `hostname + ip_address`
4. `hostname`
5. `ip_address`
6. `domain/url`

If a match is found, the asset is updated. Otherwise a new asset is created with a generated code such as `ATM-001` or `SRV-001`.

### Deterministic Asset Inference

FORTEXA now stores lightweight deterministic inference in `assets.metadata.inference`:

- `role`
- `siteArchetype`
- `confidence`
- `reasons`
- `inferredFromImportId` when the inference came from scan ingestion

Current inferred roles include:

- `atm_controller`
- `branch_router`
- `vendor_managed_server`
- `workstation`
- `support_terminal`
- `unknown`

This inference improves prioritization context and AI enrichment prompts, but it is not the source of truth for asset identity.

## Scan Import Flow

`/scan-import` runs a real Nessus ingestion flow:

1. Upload a `.nessus` file
2. Store the original file in Supabase Storage
3. Create a `scan_imports` row
4. Parse Nessus XML on the server
5. Normalize hosts into assets
6. Match or create assets deterministically
7. Create `scan_findings`
8. Create or update `cves`
9. Create or update `asset_vulnerabilities`
10. Queue optional AI enrichment after the deterministic records exist
11. Persist summary counters and final import status

### Import Deltas

Each import now stores and surfaces delta counters:

- `matched_assets`
- `new_findings`
- `fixed_findings`
- `reopened_findings`
- `unchanged_findings`
- `low_confidence_matches`

Delta handling is scoped to assets present in the current import. FORTEXA will not auto-close findings for assets that were out of scope for that scan.

### Asset-Vulnerability Lifecycle

The primary operator state is now the `asset_vulnerabilities` record, not the aggregate CVE row.

Supported lifecycle states:

- `new`
- `open`
- `mitigated`
- `closed`
- `reopened`
- `accepted`
- `false_positive`
- `compensating_control`

Immutable lifecycle history is stored in `asset_vulnerability_events`, with event types such as:

- `introduced`
- `unchanged`
- `fixed`
- `reopened`
- `status_changed`
- `task_linked`
- `task_completed`

## Primary Vulnerability Surface

`/vulnerabilities` is now instance-oriented and centered on asset-vulnerability work.

`/vulnerabilities/[id]` is UUID-first for `asset_vulnerabilities.id`, and legacy `CVE-*` links now resolve into the same AV-first operator screen by redirecting to the best matching asset-vulnerability record.

The asset-vulnerability detail view now shows:

- deterministic state: asset, CVE, status, first seen, last seen, SLA, risk score, business priority, last import
- raw scanner evidence with host, port, protocol, match confidence, and parser notes
- lifecycle timeline from `asset_vulnerability_events`
- related fleet exposure for the same CVE
- linked remediation tasks
- linked alerts
- AI operator playbook
- trust panel and provenance

## Remediation Workflow

FORTEXA now supports real remediation assignment and updates against persisted tasks.

### Supported Operations

- create remediation task from the asset-vulnerability detail page
- assign or reassign to any active profile
- update due date
- update priority
- update status
- update progress
- update notes and change request

### Permission Model

- `remediation.write`
  - create, assign, reassign, due date, and priority changes
- `remediation.update_status`
  - status, progress, and notes updates
- assigned users without broad write permissions
  - may update their own task status, progress, notes, and change request

The `/remediation` queue keeps its existing page structure, but now includes a real task detail sheet for operations instead of only passive rows.

## CSV Asset Import Format

Supported headers:

- `asset_code`
- `name`
- `type`
- `hostname`
- `ip_address`
- `domain`
- `url`
- `region_code`
- `criticality`
- `exposure_level`
- `owner_email`
- `owner_id`
- `branch`
- `manufacturer`
- `model`
- `location`
- `os_version`
- `status`

Notes:

- `name` or `hostname` should be present for every row
- `region_code` must match a seeded region such as `CTR`, `EST`, `OUE`, or `SUD`
- `owner_email` must match an existing `profiles.email`
- invalid rows are reported and skipped without crashing the page

Sample file:

- [`fixtures/sample-assets.csv`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-assets.csv)

## AI Enrichment Flow

AI is assistive and async-first. Deterministic import persists the baseline records first. OpenRouter never blocks import success.

### Persisted AI Layers

FORTEXA now keeps AI responsibilities split:

- `cve_enrichments`
  - shared knowledge-level enrichment for the CVE itself
- `asset_vulnerability_enrichments`
  - operator-facing, context-aware playbooks for a specific asset-vulnerability instance

### OpenRouter Contract

FORTEXA sends structured enrichment requests through OpenRouter using `inclusionai/ling-2.6-flash:free` by default, overridable with `OPENROUTER_MODEL`.

Structured AI output is validated before persistence.

For CVE knowledge enrichment, the contract includes:

- `summary`
- `riskExplanation`
- `impactAnalysis`
- `exploitConditions`
- `remediationGuidance`
- `recommendedControls`
- `citations`
- `confidence`
- `unsupportedClaims`
- `trustLabels`
- `tags`

For asset-vulnerability playbooks, the contract includes:

- `summary`
- `technicalRationale`
- `businessRationale`
- `primaryMitigation`
- `recommendedActions`
- `validationSteps`
- `compensatingControls`
- `rollbackCaution`
- `maintenanceWindowNote`
- `citations`
- `confidence`
- `unsupportedClaims`
- `trustLabels`

### Trust Metadata

Persisted enrichment metadata now includes:

- input hash / source fingerprint
- prompt version
- provider
- model
- validation result
- citations
- unsupported claims
- trust labels
- error state
- enrichment timestamp

### Where Enrichment Runs

- automatically after Nessus import processing
- on explicit retry from `/vulnerabilities/[uuid]`

### Failure Behavior

- malformed AI JSON is rejected and stored as `failed`
- OpenRouter downtime or missing `OPENROUTER_API_KEY` does not break imports
- pages render deterministic facts even when enrichment is absent
- failed enrichments store error state and remain retryable

## Trust Panel

The asset-vulnerability detail page includes a trust panel that separates:

- deterministic facts
- retrieved factual sources
- model-generated claims
- unsupported or unverified claims
- confidence and enrichment status
- timestamps and graceful pending/failed states

Real empty states are shown when enrichment or citations are missing. There is no fake fallback AI prose.

## Tables Involved

- `assets`
- `scan_imports`
- `scan_findings`
- `cves`
- `asset_vulnerabilities`
- `asset_vulnerability_events`
- `cve_enrichments`
- `asset_vulnerability_enrichments`
- `cve_source_references`
- `cve_recommended_controls`
- `remediation_tasks`
- `alerts`
- `report_definitions`

## Dev Fixtures

- Nessus baseline: [`fixtures/sample-nessus-import.nessus`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-nessus-import.nessus)
- Nessus delta follow-up: [`fixtures/sample-nessus-delta-followup.nessus`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-nessus-delta-followup.nessus)
- Asset CSV: [`fixtures/sample-assets.csv`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-assets.csv)
- Valid CVE enrichment payload: [`fixtures/sample-cve-enrichment-response.json`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-cve-enrichment-response.json)
- Malformed CVE enrichment payload: [`fixtures/malformed-cve-enrichment-response.json`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/malformed-cve-enrichment-response.json)

## Local Verification

1. Ensure `.env.local` points to the working Supabase pooler connection and service role credentials.
2. Set the AI provider env vars when you want enrichment enabled:

```bash
OPENROUTER_API_KEY=__CHANGE_ME__
OPENROUTER_MODEL=inclusionai/ling-2.6-flash:free
OPENROUTER_FALLBACK_MODEL=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TIMEOUT_MS=30000
```

3. Apply the latest DB migration before runtime verification.
4. Run:

```bash
npm install
npm run ai:smoke
npm run av:smoke -- <asset-vulnerability-uuid>
npm run dev
# in a second shell, with the dev server running:
npm run smoke:browser
npm run smoke:dark-mode
```

5. Verify manual asset creation:
   - open `/assets`
   - create an asset with the inline form
6. Verify CSV asset import:
   - import [`fixtures/sample-assets.csv`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-assets.csv) on `/assets`
7. Verify Nessus baseline import:
   - open `/scan-import`
   - upload [`fixtures/sample-nessus-import.nessus`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-nessus-import.nessus)
8. Verify delta behavior:
   - upload [`fixtures/sample-nessus-delta-followup.nessus`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-nessus-delta-followup.nessus)
   - confirm the import detail page shows new, fixed, reopened, unchanged, and matched-asset counters where applicable
   - optionally re-import the baseline file to exercise a reopened path for findings that were fixed by the follow-up
9. Verify operator detail:
   - open `/vulnerabilities`
   - select an asset-vulnerability UUID-backed record
   - confirm evidence, lifecycle timeline, linked tasks, alerts, AI playbook, and trust panel render safely
10. Verify remediation workflow:
   - create a task from the vulnerability detail page
   - assign it to an active profile
   - change status, progress, due date, and notes from `/remediation`
11. Verify AI retry and failure tolerance:
   - use `Retry AI` on an asset-vulnerability detail page
   - remove `OPENROUTER_API_KEY` locally and confirm the page still renders while enrichment fails cleanly
   - validate the schema helpers against both the valid and malformed fixture payloads
12. Check downstream pages:
   - `/dashboard`
   - `/assets`
   - `/alerts`
   - `/remediation`
   - `/reports`

## Migration

This pass adds:

- [`src/db/migrations/0005_ops_lifecycle_and_trust.sql`](/Users/abdelhak/Documents/PFE/FORTEXA/src/db/migrations/0005_ops_lifecycle_and_trust.sql)
- [`src/db/migrations/0007_ai_enrichment_leases.sql`](/Users/abdelhak/Documents/PFE/FORTEXA/src/db/migrations/0007_ai_enrichment_leases.sql)

It introduces:

- expanded `asset_vulnerabilities.status` values
- `asset_vulnerability_events`
- `asset_vulnerability_enrichments`
- operator playbook fields for `primary_mitigation` and `validation_steps`
- scan import delta counters
- extra trust metadata columns on `cve_enrichments`
- nullable AI enrichment lease/retry metadata for stale processing recovery

### Safe Production Migration Workflow

Use forward-only SQL migration files from `src/db/migrations`. Never edit an
already-applied production migration; add a new numbered migration instead.

1. Review the SQL file and confirm it is non-destructive.
2. Ensure `.env.local` points to the target Supabase database.
3. Apply one migration at a time:

```bash
npm run db:migrate:file -- src/db/migrations/0007_ai_enrichment_leases.sql
```

4. Verify the app:

```bash
npm run typecheck
npm run test:ai
npm run test:import
npm run build
```

For larger schema changes, run the Supabase/Drizzle diff process in a staging
project first, then copy the reviewed forward-only SQL into the next migration
file.

## Known MVP Limits

- Only Nessus is active as a scan importer right now
- Delta intelligence is scoped to assets seen in the current import
- Legacy `CVE-*` links resolve to the AV-first detail screen instead of rendering a separate detail UI
- Alerts remain simple and deterministic, not a full rules engine
- Report generation is still scaffold-level; this phase mainly feeds it better lifecycle and enrichment data
- Fleet clustering is intentionally deferred; the current differentiator is deterministic asset-role/site-archetype inference plus operator-safe AI playbooks

## Deferred Platform Roadmap

- P0: organization/team tenancy, tenant-scoped policies, and tenant-aware audit queries before serious multi-customer use.
- P0: complete migration runbook with staging promotion and rollback-by-forward-fix procedures.
- P1: durable background jobs for large imports and AI enrichment with queue rows, leases, retries, cron recovery, and progress UI.
- P1: stronger scan provenance with stable finding fingerprints, scan-to-scan diff views, and reviewed deduplication constraints.
- P1: report export and email notifications backed by stored report runs and notification preferences.
- P2: accepted-risk/false-positive approvals, SLA policy customization, comments, and activity timelines.
- P2: EPSS, CISA KEV, exploit intelligence, and asset criticality tuning in risk scoring.
