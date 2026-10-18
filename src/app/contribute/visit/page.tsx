import { redirect } from "next/navigation";
import { readPageData } from "@/lib/backend/page-data";
import { contributorVisitSchema } from "@/game/connected";
import { ContributorVisitView } from "@/components/contributor-visit";
export const dynamic = "force-dynamic";
export default async function VisitPage() {
  const result = await readPageData("contributor/visit");
  if (result.status === 401) redirect("/contribute");
  const parsed = contributorVisitSchema.safeParse(result.data);
  return (
    <ContributorVisitView
      initialVisit={parsed.success ? parsed.data : null}
      initialError={
        result.error ||
        (parsed.success ? "" : "Your place couldn’t load. Please try again.")
      }
    />
  );
}
