import { RecipientPlayer } from "@/components/recipient-player";
import { FinaleGateway } from "@/components/finale-gateway";
import { readPageData } from "@/lib/backend/page-data";
import { sceneSchema } from "@/game/connected";
import { finaleStatusSchema } from "@/game/finale";
import { redirect } from "next/navigation";
import { RECIPIENT_FINALE_ENABLED } from "@/game/recipient-release";
export const dynamic = "force-dynamic";
export default async function Play() {
  const [scene, ending] = await Promise.all([
    readPageData("recipient/scenes/tuguegarao_park"),
    RECIPIENT_FINALE_ENABLED
      ? readPageData("recipient/ending/status")
      : Promise.resolve({ data: null }),
  ]);
  if (scene.status === 401) redirect("/");
  const parsedScene = sceneSchema.safeParse(scene.data);
  const parsedEnding = finaleStatusSchema.safeParse(ending.data);
  const player = (
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
  );
  return RECIPIENT_FINALE_ENABLED ? (
    <FinaleGateway
      initialStatus={parsedEnding.success ? parsedEnding.data : null}
      initialResolved
    >
      {player}
    </FinaleGateway>
  ) : (
    player
  );
}
