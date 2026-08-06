import { createClient } from "@/lib/supabase/server";

export { PDP_MODES, PDP_STATUSES, type PdpItem } from "@/lib/data/pdp-shared";
import type { PdpItem } from "@/lib/data/pdp-shared";

export type PdpData = {
  cycleId: string;
  employeeName: string;
  fyLabel: string;
  /** Same has_employee_access("capture_appraisal_ratings") check the RLS write policies enforce - admin-or-self, matching the reference's `ed = isAdmin() || canSelfAssess(S.eid)`. */
  canEdit: boolean;
  items: PdpItem[];
  totalDays: number;
};

type CycleHeaderRow = {
  id: string;
  employee_id: string;
  employee: { name: string } | null;
  financial_year: { label: string } | null;
};

type PdpItemRow = {
  id: string;
  priority: string | null;
  gap: string | null;
  outcome: string | null;
  activity: string | null;
  mode: string | null;
  timeframe: string | null;
  opportunity: string | null;
  support_person: string | null;
  days: number | null;
  status: string;
  sort_order: number;
};

/**
 * The Personal Development Plan for one employee's cycle - the reference
 * tool's pagePdp(), a 7-column table of training needs arising from the
 * competency assessment, plus a running total of planned training days
 * against the 5-day-per-year guideline.
 */
export async function getPdpData(cycleId: string): Promise<PdpData | null> {
  const supabase = await createClient();

  const { data: cycle, error: cycleErr } = await supabase
    .from("appraisal_cycles")
    .select("id, employee_id, employee:employees(name), financial_year:financial_years(label)")
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleErr) throw cycleErr;

  const header = cycle as unknown as CycleHeaderRow | null;
  if (!header || !header.employee) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("pdp_items")
    .select(
      "id, priority, gap, outcome, activity, mode, timeframe, opportunity, support_person, days, status, sort_order"
    )
    .eq("appraisal_cycle_id", cycleId)
    .order("sort_order");
  if (itemsErr) throw itemsErr;

  const { data: canEditData } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: boolean | null }>
  )("has_employee_access", {
    target_employee_id: header.employee_id,
    required_permission: "capture_appraisal_ratings",
  });

  const rows = (items ?? []) as unknown as PdpItemRow[];
  const pdpItems: PdpItem[] = rows.map((r) => ({
    id: r.id,
    priority: r.priority,
    gap: r.gap,
    outcome: r.outcome,
    activity: r.activity,
    mode: r.mode,
    timeframe: r.timeframe,
    opportunity: r.opportunity,
    supportPerson: r.support_person,
    days: r.days,
    status: r.status,
  }));

  const totalDays = Math.round(pdpItems.reduce((sum, r) => sum + (r.days || 0), 0) * 100) / 100;

  return {
    cycleId: header.id,
    employeeName: header.employee.name,
    fyLabel: header.financial_year?.label ?? "—",
    canEdit: Boolean(canEditData),
    items: pdpItems,
    totalDays,
  };
}
