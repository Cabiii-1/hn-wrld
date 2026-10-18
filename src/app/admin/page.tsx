import { AdminDesk } from "@/components/admin-desk";
import { backendConfigured } from "@/lib/supabase/server";
import { readPageData } from "@/lib/backend/page-data";
import type { AdminData } from "@/lib/backend/contracts";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const result = await readPageData<AdminData>("admin/dashboard");
  return (
    <AdminDesk
      configured={backendConfigured()}
      initialData={result.data}
      initialResolved
      initialError={result.status >= 500 ? result.error : ""}
    />
  );
}
