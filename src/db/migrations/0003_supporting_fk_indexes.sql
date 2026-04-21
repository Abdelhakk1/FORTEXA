CREATE INDEX IF NOT EXISTS idx_cve_enrichments_enriched_by
  ON public.cve_enrichments (enriched_by);

CREATE INDEX IF NOT EXISTS idx_cve_recommended_controls_cve_id
  ON public.cve_recommended_controls (cve_id);

CREATE INDEX IF NOT EXISTS idx_cve_source_references_cve_id
  ON public.cve_source_references (cve_id);

CREATE INDEX IF NOT EXISTS idx_scoring_policies_created_by
  ON public.scoring_policies (created_by);
