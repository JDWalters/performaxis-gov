import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/data/access";

/**
 * Route group for printable documents (Performance Agreement, and future
 * report exports) - same auth gate as the main app shell, but deliberately
 * no sidebar/header chrome, so what prints is just the document.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const me = await getMyProfile();
  if (!me?.user) redirect("/login");

  return <>{children}</>;
}
