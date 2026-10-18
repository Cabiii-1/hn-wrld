import { RecipientEntry } from "@/components/recipient-entry";
import { readPageData } from "@/lib/backend/page-data";
export const dynamic = "force-dynamic";
export default async function Home() {
  const result = await readPageData("recipient/session");
  return (
    <RecipientEntry
      initialSessionValid={result.status === 200}
      initialResolved
    />
  );
}
