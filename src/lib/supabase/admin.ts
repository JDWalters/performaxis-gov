import { createClient as createRawClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role Supabase client - bypasses RLS entirely, so it must NEVER be
 * imported into a Client Component or exposed to the browser. Server Actions
 * and Route Handlers only. Used specifically for supabase.auth.admin.*
 * calls (inviteUserByEmail, deleteUser, etc.) that the anon/session client
 * can't perform, since those require the service role key.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment (Vercel project
 * settings + local .env.local) - grab it from Supabase dashboard → Project
 * Settings → API → service_role secret. Never prefix it with NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set - add it to your environment (Vercel project settings + .env.local) to enable inviting users."
    );
  }
  return createRawClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
