# FORTEXA MVP Backend Flow

FORTEXA is a Next.js + Supabase vulnerability-management MVP. This phase keeps the current app architecture and UI, but stabilizes the product around one canonical ingestion path so the main pages can be backed by real data instead of placeholders.

## Canonical Importer

- Active MVP scan importer: `Nessus (.nessus)`
- Disabled for now in the UI: `OpenVAS`, `Nmap`, `Qualys`
- Reason: the existing schema and findings model are already aligned with Nessus-style vulnerability findings, CVE mapping, and remediation workflows

## How Assets Enter The System

FORTEXA now supports three stable asset entry paths:

1. Manual asset creation on `/assets`
2. CSV asset import on `/assets`
3. Nessus scan import on `/scan-import`

All three paths write into the same `assets` table and use the same deterministic matching strategy:

1. `asset_code` when explicitly supplied
2. external scanner asset ID
3. `hostname + ip_address`
4. `hostname`
5. `ip_address`
6. `domain/url`

If a match is found, the asset is updated. Otherwise a new asset is created with a generated code such as `ATM-001` or `SRV-001`.

## Scan Import Flow

`/scan-import` now runs a real MVP flow:

1. Upload a `.nessus` file
2. Store the original file in Supabase Storage
3. Create a `scan_imports` row
4. Parse the Nessus XML on the server
5. Normalize hosts into assets
6. Create or update assets
7. Create `scan_findings`
8. Create or update `cves`
9. Create or update `asset_vulnerabilities`
10. Create simple alerts for new critical or high-risk imported issues
11. Persist summary counters and final import status

The same processing function is also wired into Inngest for future async offload, but the MVP path processes inline so local development stays reliable.

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

## Dev Fixtures

- Nessus sample: [`fixtures/sample-nessus-import.nessus`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-nessus-import.nessus)
- CSV sample: [`fixtures/sample-assets.csv`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-assets.csv)

## Tables Involved

- `assets`
- `scan_imports`
- `scan_findings`
- `cves`
- `asset_vulnerabilities`
- `cve_enrichments`
- `cve_recommended_controls`
- `remediation_tasks`
- `alerts`
- `report_definitions`

## AI Enrichment Flow

AI enrichment is now a persisted, optional post-import step for CVE-backed findings.

1. Nessus import completes normally
2. Newly seen or changed CVEs are queued for enrichment
3. Inngest calls the server-side Gemini enrichment runner
4. Gemini returns structured JSON only
5. The app validates and sanitizes the JSON before saving
6. Saved results land in:
   - `cve_enrichments`
   - `cve_recommended_controls`
7. The vulnerability detail page reads those persisted results directly

Core import success does not depend on Gemini. If AI is unavailable, the import still completes and enrichment stays pending or failed for later retry.

### Persisted Enrichment Fields

FORTEXA persists AI output in `cve_enrichments` using these fields:

- `summary`
- `impact_analysis`
- `exploit_conditions`
- `primary_remediation`
- `context_reason`
- `confidence_score`
- `enrichment_status`
- `ai_model`
- `ai_error`
- `source_fingerprint`
- `tags`
- `enriched_at`

Recommended controls are stored in `cve_recommended_controls` with `source = 'ai'`.

### Where Enrichment Runs

- automatically after Nessus import processing
- on explicit retry from `/vulnerabilities/[id]`

### Retry Behavior

- vulnerability detail pages show an enrichment status badge
- authorized users with `cves.enrich` can use the `Retry AI` action
- retry first attempts background queueing through Inngest
- if queueing is unavailable, the action falls back to a direct server-side run

### Failure Behavior

- malformed Gemini JSON is rejected and recorded as `failed`
- Gemini downtime or missing `GEMINI_API_KEY` does not break imports
- failed enrichments store `ai_error` and can be retried later
- pages render safe fallback text when enrichment is absent

### Environment

Required for live enrichment:

- `GEMINI_API_KEY`

Optional but recommended:

- `GEMINI_MODEL`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_APP_ID`

### Validation / Smoke Fixture

Use this fixture to validate the expected Gemini response shape during local smoke testing:

- [`fixtures/sample-cve-enrichment-response.json`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-cve-enrichment-response.json)

The validation schema lives in:

- [`src/lib/services/gemini.ts`](/Users/abdelhak/Documents/PFE/FORTEXA/src/lib/services/gemini.ts)

The pure prompt/fingerprint helpers live in:

- [`src/lib/services/cve-enrichment.ts`](/Users/abdelhak/Documents/PFE/FORTEXA/src/lib/services/cve-enrichment.ts)

## Local Verification

1. Ensure `.env.local` points to the working Supabase pooler connection and service role credentials.
2. Run:

```bash
npm install
npm run dev
```

3. Verify manual asset creation:
   - open `/assets`
   - create an asset with the inline form
4. Verify CSV asset import:
   - use [`fixtures/sample-assets.csv`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-assets.csv) on `/assets`
5. Verify scan import:
   - open `/scan-import`
   - upload [`fixtures/sample-nessus-import.nessus`](/Users/abdelhak/Documents/PFE/FORTEXA/fixtures/sample-nessus-import.nessus)
6. Verify AI enrichment:
   - open a CVE detail page from `/vulnerabilities`
   - confirm `AI Summary`, `Why This Priority?`, and remediation guidance show persisted content when enrichment is complete
   - if the status is `Pending` or `Failed`, use `Retry AI`
   - if `GEMINI_API_KEY` is removed locally, confirm the page still renders and retries fail safely without breaking the import pipeline
7. Check downstream pages:
   - `/dashboard`
   - `/assets`
   - `/vulnerabilities`
   - `/alerts`
   - `/remediation`
   - `/reports`

## Known MVP Limits

- Only Nessus is active as a scan importer right now
- Nessus findings without CVEs are stored as `scan_findings`, but only CVE-backed findings become `asset_vulnerabilities`
- AI enrichment remains optional and non-blocking, and currently targets CVE-backed records rather than non-CVE findings
- Report generation is still scaffolded; default report definitions are seeded automatically, but generated artifacts are not the focus of this phase
