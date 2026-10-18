import Image from "next/image";
import { Heart, MapPin } from "lucide-react";
import { SCENES } from "@/game/scenes";

// Public scenery and an original static bear icon only; no contributor content.
export function ParkPreview() {
  return (
    <aside className="park-preview" aria-label="A preview of her little world">
      <div className="park-preview-picture">
        <Image
          src={SCENES.tuguegarao_park.background}
          alt="A little preview of the Park, with green lawns, paths and a bear statue."
          width={836}
          height={470}
          sizes="(max-width: 600px) 90vw, 240px"
        />
        <span className="park-preview-bear" aria-hidden="true">
          <span className="park-preview-hello">
            <Heart size={11} fill="currentColor" />
          </span>
          <svg
            viewBox="0 0 32 32"
            width="32"
            height="32"
            shapeRendering="crispEdges"
          >
            <path
              fill="#65483b"
              d="M6 4h7v6h7V4h7v16h-4v9h-5v-3h-3v3h-5v-9H6z"
            />
            <path fill="#f1d8b0" d="M8 6h3v6h11V6h3v12h-2v7H10v-7H8z" />
            <path fill="#dfa69a" d="M8 6h3v4H8zm14 0h3v4h-3z" />
            <path fill="#65483b" d="M11 13h2v3h-2zm10 0h2v3h-2z" />
            <path fill="#fff1d6" d="M14 17h6v4h-6z" />
            <path fill="#65483b" d="M16 17h2v2h-2z" />
            <path fill="#778b63" d="M10 22h13v3H10zm2 3h3v3h-3z" />
          </svg>
        </span>
        <span className="park-preview-place">
          <MapPin size={11} />
          Park · sample preview
        </span>
      </div>
      <div className="park-preview-copy">
        <span className="eyebrow">A LITTLE PEEK</span>
        <h3>Your hello has a place here.</h3>
        <p>Send your letter, then take a little walk as your own bear.</p>
        <small>
          Your invitation may lead to another little corner of her world.
        </small>
      </div>
    </aside>
  );
}
