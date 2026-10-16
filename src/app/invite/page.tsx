import { InviteWelcome } from "@/components/invite-welcome";
import { backendConfigured } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default function InvitePage() {
  return <InviteWelcome configured={backendConfigured()} />;
}
