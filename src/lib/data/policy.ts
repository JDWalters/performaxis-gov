import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_RATING_SCALE,
  DEFAULT_BONUS_BANDS,
  type RatingScaleTerm,
  type BonusBand,
} from "@/lib/data/appraisal-scoring";

export type PolicyConfig = {
  kpaWeight: number;
  competencyWeight: number;
  ratingScale: RatingScaleTerm[];
  bonusBands: BonusBand[];
};

const FALLBACK: PolicyConfig = {
  kpaWeight: 80,
  competencyWeight: 20,
  ratingScale: DEFAULT_RATING_SCALE,
  bonusBands: DEFAULT_BONUS_BANDS,
};

/**
 * The active performance-policy config (KPA/competency weight split, rating
 * scale terminology, bonus-eligibility bands) - kept in one editable place
 * (policy_templates.config) instead of hardcoded, per the original brief to
 * standardise and build on something scalable rather than baking magic
 * numbers into the capture/scoring code.
 */
export async function getPolicyConfig(): Promise<PolicyConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("policy_templates")
    .select("config")
    .eq("is_locked", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return FALLBACK;

  const config = (data as { config: Partial<PolicyConfig> }).config ?? {};
  return {
    kpaWeight: config.kpaWeight ?? FALLBACK.kpaWeight,
    competencyWeight: config.competencyWeight ?? FALLBACK.competencyWeight,
    ratingScale: config.ratingScale?.length ? config.ratingScale : FALLBACK.ratingScale,
    bonusBands: config.bonusBands?.length ? config.bonusBands : FALLBACK.bonusBands,
  };
}
