import { ContributionEntry } from "@/components/contribution-entry";
import { backendConfigured } from "@/lib/supabase/server";
import { readPageData } from "@/lib/backend/page-data";
import type { ContributorSnapshot } from "@/lib/backend/contracts";
export const dynamic = "force-dynamic";
export default async function ContributePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;
  const result = await readPageData<ContributorSnapshot>("contributor");
  return (
    <ContributionEntry
      configured={backendConfigured()}
      initialSnapshot={result.data}
      edit={params.edit === "1"}
    />
  );
}
