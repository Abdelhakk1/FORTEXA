-- Fortexa MVP GAB business context compatibility update.
-- Keeps legacy exposure enum values while adding named CIDT templates.

alter table gab_cidt_templates
  add column if not exists description text;

alter table gab_cidt_templates
  add column if not exists is_default boolean not null default false;

alter table gab_cidt_templates
  add column if not exists archived_at timestamptz;

alter table gab_cidt_templates
  drop constraint if exists chk_gab_cidt_templates_key;

alter table gab_cidt_templates
  drop constraint if exists chk_gab_cidt_templates_key_not_empty;

alter table gab_cidt_templates
  add constraint chk_gab_cidt_templates_key_not_empty
  check (length(trim(template_key)) > 0);

alter table assets
  add column if not exists cidt_template_key text;

create index if not exists idx_assets_org_cidt_template
  on assets (organization_id, cidt_template_key);

update gab_cidt_templates
set
  label = 'Default Indoor GAB CIDT template',
  description = coalesce(description, 'Default business-impact CIDT preset for GABs classified as indoor.'),
  is_default = true,
  updated_at = now()
where template_key = 'indoor_agency';

update gab_cidt_templates
set
  label = 'Default Outdoor GAB CIDT template',
  description = coalesce(description, 'Default business-impact CIDT preset for GABs classified as outdoor. Exposure is scored separately.'),
  is_default = true,
  updated_at = now()
where template_key = 'outdoor_agency';

-- Keep the legacy public/commercial template for historical compatibility, but
-- stop presenting it as a normal exposure class in the app.
update gab_cidt_templates
set
  archived_at = coalesce(archived_at, now()),
  description = coalesce(description, 'Legacy pre-v2 outdoor public/commercial template retained for historical compatibility.'),
  updated_at = now()
where template_key = 'outdoor_public_commercial';

notify pgrst, 'reload schema';
