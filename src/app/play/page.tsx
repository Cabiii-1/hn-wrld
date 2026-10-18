import { RecipientPlayer } from "@/components/recipient-player";
import { FinaleGateway } from "@/components/finale-gateway";
import { readPageData } from "@/lib/backend/page-data";
import { sceneSchema } from "@/game/connected";
import { finaleStatusSchema } from "@/game/finale";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Play() {
  const [scene, ending] = await Promise.all([
    readPageData("recipient/scenes/sta_ana_house"),
    readPageData("recipient/ending/status"),
  ]);
  if (scene.status === 401) redirect("/");
  const parsedScene = sceneSchema.safeParse(scene.data);
  const parsedEnding = finaleStatusSchema.safeParse(ending.data);
  return (
    <FinaleGateway
      initialStatus={parsedEnding.success ? parsedEnding.data : null}
      initialResolved
    >
      <RecipientPlayer
        initialScene={parsedScene.success ? parsedScene.data : null}
        initialResolved
        initialError={
          scene.error ||
          (parsedScene.success
            ? ""
            : "Your world couldn’t load. Please try again.")
        }
      />
    </FinaleGateway>
  );
}
