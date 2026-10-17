import { RecipientPlayer } from "@/components/recipient-player";
import { FinaleGateway } from "@/components/finale-gateway";
export const dynamic = "force-dynamic";
export default function Play() {
  return (
    <FinaleGateway>
      <RecipientPlayer />
    </FinaleGateway>
  );
}
