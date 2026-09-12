"use client";

/** The "Client" org picker repeated at the top of every Mandate screen - pulled into one client component so read-only server-component pages (instruments, decisions) can use it too, not just the fully client-rendered register/authority/governance screens. */
import { useRouter } from "next/navigation";

export function MandateOrgSwitcher({
  orgs,
  currentOrgId,
  basePath,
}: {
  orgs: { id: string; name: string }[];
  currentOrgId: string;
  basePath: string;
}) {
  const router = useRouter();
  if (orgs.length <= 1) return null;
  return (
    <div className="btnrow" style={{ marginBottom: 14 }}>
      <span className="eyebrow" style={{ marginBottom: 0 }}>
        Client
      </span>
      <select
        value={currentOrgId}
        onChange={(ev) => router.push(`${basePath}?org=${ev.target.value}`)}
        style={{ width: "auto", minWidth: 220 }}
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
