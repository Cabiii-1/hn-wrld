import { ContributionForm } from "@/components/contribution-form";
import { backendConfigured } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default function ContributePage() {
  return <ContributionForm configured={backendConfigured()} />;
}
