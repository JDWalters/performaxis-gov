import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_RATING_SCALE,
  DEFAULT_BONUS_BANDS,
  type RatingScaleTerm,
  type BonusBand,
} from "@/lib/data/appraisal-scoring";

export type MayorTitle = "Executive Mayor" | "Mayor";

export type PolicyConfig = {
  /** The policy_templates row id, or null if no row exists yet for this municipality (fully-default policy). */
  templateId: string | null;
  orgId: string | null;
  kpaWeight: number;
  competencyWeight: number;
  ratingScale: RatingScaleTerm[];
  bonusBands: BonusBand[];
  /** Municipality branding + Mayor identity, set in EPAS Setup - used on the printed agreement and the gate/sidebar. */
  muniLogoUrl: string | null;
  mayorTitle: MayorTitle;
  mayorName: string | null;
  /** The Municipal Manager's name, as it should appear as "Employer" on a Director's (Section 56) agreement. */
  mmName: string | null;
  /**
   * These three feed the actual legal text of the unsigned agreement
   * ("signed at {place} on the {day} day of {month/year}") - every employee's
   * agreement uses the same municipality-wide values, exactly like the
   * reference tool's S.cfg.signPlace/signDay/signMonth. They are distinct
   * from the per-employee `agreements` table, which records who *actually*
   * signed and when.
   */
  signPlaceDefault: string | null;
  signDayDefault: string | null;
  signMonthDefault: string | null;
  /** Q1-Q4 review-due month/year, inserted into the agreement's clause 7 schedule - reference's S.cfg.revDates. Null entries fall back to a computed default (see defaultReviewDate below). */
  reviewDates: [string | null, string | null, string | null, string | null];
};

export const REVIEW_TYPE = [
  "Informal assessment",
  "Mid-year panel assessment",
  "Informal assessment",
  "Year-end panel assessment",
] as const;

const REVIEW_DUE_MONTH = ["December", "March", "June", "September"] as const;

/** The reference's defaultRevDate(fy,q): Q1 falls in the FY's start year, Q2-Q4 in the following year. */
export function defaultReviewDate(fyStartYear: number, quarterIndex: 0 | 1 | 2 | 3): string {
  const year = quarterIndex === 0 ? fyStartYear : fyStartYear + 1;
  return `${REVIEW_DUE_MONTH[quarterIndex]} ${year}`;
}

const FALLBACK: PolicyConfig = {
  templateId: null,
  orgId: null,
  kpaWeight: 80,
  competencyWeight: 20,
  ratingScale: DEFAULT_RATING_SCALE,
  bonusBands: DEFAULT_BONUS_BANDS,
  muniLogoUrl: null,
  mayorTitle: "Executive Mayor",
  mayorName: null,
  mmName: null,
  signPlaceDefault: null,
  signDayDefault: null,
  signMonthDefault: null,
  reviewDates: [null, null, null, null],
};

type PolicyConfigJson = Partial<{
  kpaWeight: number;
  competencyWeight: number;
  ratingScale: RatingScaleTerm[];
  bonusBands: BonusBand[];
  muniLogoUrl: string;
  mayorTitle: MayorTitle;
  mayorName: string;
  mmName: string;
  signPlaceDefault: string;
  signDayDefault: string;
  signMonthDefault: string;
  reviewDates: [string | null, string | null, string | null, string | null];
}>;

/**
 * Resolves any org (typically a department, since that's what employees and
 * scorecards are attached to) up to its owning municipality. Every
 * department's parent IS its municipality directly in the current
 * hierarchy, so this is at most one extra lookup, not a recursive walk -
 * if that ever changes (e.g. sub-departments), this is the one place to
 * extend into a real ancestor walk using orgs.path.
 */
export async function resolveMunicipalityOrgId(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: orgData, error } = await supabase.from("orgs").select("id, kind, parent_id").eq("id", orgId).maybeSingle();
  if (error || !orgData) return null;
  // Cast: same pragmatic workaround used elsewhere in this codebase - a
  // partial select against `orgs` (which has an ltree `path` column
  // surfaced as `unknown`) collapses supabase-js's inferred row type to
  // `never`, even when `path` itself isn't in the selected column list.
  const data = orgData as unknown as { id: string; kind: string; parent_id: string | null };
  if (data.kind === "municipality") return data.id;
  if (data.kind === "department" && data.parent_id) {
    const { data: parentData } = await supabase.from("orgs").select("id, kind").eq("id", data.parent_id).maybeSingle();
    const parent = parentData as unknown as { id: string; kind: string } | null;
    if (parent?.kind === "municipality") return parent.id;
  }
  return null;
}

/**
 * The active performance-policy config for one municipality (KPA/competency
 * weight split, rating scale terminology, bonus bands, Mayor identity,
 * branding) - one policy_templates row per municipality (policy_templates.org_id),
 * not a single global row, so a second municipality can run its own policy
 * without touching code. Falls back to sane MSA/MFMA-regulation defaults if
 * that municipality hasn't configured a policy yet (EPAS Setup not visited).
 */
export async function getPolicyConfig(municipalityOrgId: string | null): Promise<PolicyConfig> {
  if (!municipalityOrgId) return FALLBACK;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("policy_templates")
    .select("id, org_id, config")
    .eq("org_id", municipalityOrgId)
    .eq("is_locked", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return { ...FALLBACK, orgId: municipalityOrgId };

  const row = data as { id: string; org_id: string; config: PolicyConfigJson };
  const config = row.config ?? {};
  return {
    templateId: row.id,
    orgId: row.org_id,
    kpaWeight: config.kpaWeight ?? FALLBACK.kpaWeight,
    competencyWeight: config.competencyWeight ?? FALLBACK.competencyWeight,
    ratingScale: config.ratingScale?.length ? config.ratingScale : FALLBACK.ratingScale,
    bonusBands: config.bonusBands?.length ? config.bonusBands : FALLBACK.bonusBands,
    muniLogoUrl: config.muniLogoUrl ?? null,
    mayorTitle: config.mayorTitle ?? FALLBACK.mayorTitle,
    mayorName: config.mayorName ?? null,
    mmName: config.mmName ?? null,
    signPlaceDefault: config.signPlaceDefault ?? null,
    signDayDefault: config.signDayDefault ?? null,
    signMonthDefault: config.signMonthDefault ?? null,
    reviewDates: config.reviewDates?.length === 4 ? config.reviewDates : [null, null, null, null],
  };
}
