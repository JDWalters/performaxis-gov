"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SCOPE_COOKIE } from "@/lib/data/scope";

/** Sets the active viewing scope (see src/lib/data/scope.ts) and returns to the calling page. */
export async function setScope(formData: FormData) {
  const orgId = String(formData.get("orgId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/dashboard");
  if (orgId) {
    const store = await cookies();
    store.set(SCOPE_COOKIE, orgId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  redirect(returnTo);
}

/** Clears the active viewing scope, going back to "everything I can see". */
export async function clearScope(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "/dashboard");
  const store = await cookies();
  store.delete(SCOPE_COOKIE);
  redirect(returnTo);
}
