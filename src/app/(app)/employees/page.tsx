import Link from "next/link";
import { getOrgManageScopes } from "@/lib/data/orgs";
import { getEmployees, ROLE_LABEL, reportsToLabel } from "@/lib/data/employees";
import { ActiveToggle } from "./ActiveToggle";

export default async function EmployeesPage() {
  const scopes = await getOrgManageScopes();

  if (scopes.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold text-ink">Employees</h1>
        <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
          You don&apos;t have permission to manage employees. This requires the &quot;manage_org_setup&quot;
          permission on an org - ask Friday Management Solutions or your Municipal Admin.
        </p>
      </div>
    );
  }

  const employees = await getEmployees();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">Employees</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink2">
            Section 57 (Municipal Manager) and Section 56 (managers accountable to the MM) employees who
            appear on the EPAS system - performance agreements, assessments and development plans are all
            built from this list. Add the Municipal Manager first, then each Director.
          </p>
        </div>
        <Link
          href="/employees/new"
          className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink/90"
        >
          + Add employee
        </Link>
      </div>

      {employees.length === 0 ? (
        <p className="text-sm text-ink2">No employees yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-wide text-ink2">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Position</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Employee no.</th>
                <th className="px-4 py-2">Reports to</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className={`border-b border-line last:border-0 ${e.isActive ? "" : "opacity-50"}`}>
                  <td className="px-4 py-2 font-semibold text-ink">
                    <Link href={`/employees/${e.id}`} className="hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink2">{e.position ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`stag ${e.role === "MM" ? "stag-gold" : "stag-blue"}`}>{ROLE_LABEL[e.role]}</span>
                  </td>
                  <td className="px-4 py-2 text-ink2">
                    {e.orgName}
                    {e.municipalityName ? ` — ${e.municipalityName}` : ""}
                  </td>
                  <td className="px-4 py-2 text-ink2">{e.empno ?? "—"}</td>
                  <td className="px-4 py-2 text-ink2">{reportsToLabel(e.role)}</td>
                  <td className="px-4 py-2">
                    <span className={`stag ${e.isActive ? "stag-met" : "stag-missed"}`}>
                      {e.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ActiveToggle employeeId={e.id} isActive={e.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
