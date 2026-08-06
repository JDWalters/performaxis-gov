/**
 * The 5 national Key Performance Areas every municipal SDBIP/EPAS KPI is
 * meant to align to (per the Local Government: Municipal Planning and
 * Performance Management Regulations). Pure constant, no framework
 * imports - safe from both server data layers and client components
 * (AnnexureEditor's KPA datalist, the agreement document's KPA table).
 */
export const NATIONAL_KPAS = [
  { code: "BSD", name: "Basic Service Delivery" },
  { code: "MTOD", name: "Municipal Transformation and Organisational Development" },
  { code: "LED", name: "Local Economic Development" },
  { code: "MFVM", name: "Municipal Financial Viability and Management" },
  { code: "GGPP", name: "Good Governance and Public Participation" },
] as const;

/**
 * A KPI's position in the canonical KPA order above (999 for an unrecognised
 * or blank code, sorting after every real KPA) - the reference tool groups
 * every KPI list (Capture results, Annexure A, Assessment ratings, the
 * printed agreement) by KPA in this order, never alphabetically by
 * indicator name. Pair with a stable secondary key (e.g. created_at) so
 * KPIs within one KPA keep a consistent, natural reading order.
 */
export function kpaRank(kpaCode: string | null): number {
  if (!kpaCode) return 999;
  const idx = NATIONAL_KPAS.findIndex((k) => k.code === kpaCode.trim().toUpperCase());
  return idx === -1 ? 999 : idx;
}
