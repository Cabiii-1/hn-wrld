import { InviteWelcome } from "@/components/invite-welcome";
import { backendConfigured } from "@/lib/supabase/server";
import { readPageData } from "@/lib/backend/page-data";
export const dynamic = "force-dynamic";
export default async function InvitePage() {
  const result = await readPageData("contributor");
  return (
    <InviteWelcome
      configured={backendConfigured()}
      initialSessionValid={result.status === 200}
    />
  );
}
