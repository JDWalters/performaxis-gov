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
