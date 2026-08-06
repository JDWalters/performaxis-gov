import Link from "next/link";
import { getDepartmentOrgs } from "@/lib/data/kpi-library";
import { EmployeeForm } from "../EmployeeForm";

export default async function NewEmployeePage() {
  const departments = await getDepartmentOrgs();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/employees" className="text-xs font-semibold text-ink2 hover:underline">
          ← Employees
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-ink">Add employee</h1>
      </div>
      <EmployeeForm initial={null} departments={departments} />
    </div>
  );
}
