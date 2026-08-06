import Link from "next/link";
import { notFound } from "next/navigation";
import { getDepartmentOrgs } from "@/lib/data/kpi-library";
import { getEmployee } from "@/lib/data/employees";
import { EmployeeForm } from "../EmployeeForm";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [employee, departments] = await Promise.all([getEmployee(id), getDepartmentOrgs()]);
  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/employees" className="text-xs font-semibold text-ink2 hover:underline">
          ← Employees
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-ink">{employee.name}</h1>
      </div>
      <EmployeeForm initial={employee} departments={departments} />
    </div>
  );
}
