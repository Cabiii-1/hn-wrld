import { AdminDesk } from "@/components/admin-desk";
import { backendConfigured } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default function AdminPage() {
  return <AdminDesk configured={backendConfigured()} />;
}
