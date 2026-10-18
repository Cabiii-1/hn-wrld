"use client";
import { useEffect, useRef, useState } from "react";
import type * as Phaser from "phaser";

export default function ReunionCanvas({ still }: { still: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let cancelled = false,
      game: Phaser.Game | undefined;
    void Promise.all([import("phaser"), import("@/game/reunion-scene")])
      .then(([Phaser, { ReunionScene }]) => {
        if (cancelled || !root.current) return;
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: root.current,
          width: root.current.clientWidth,
          height: root.current.clientHeight,
          pixelArt: true,
          antialias: false,
          roundPixels: true,
          scale: {
            mode: Phaser.Scale.RESIZE,
          },
          scene: [
            new ReunionScene(
              still,
              () => {
                if (!cancelled) setStatus("ready");
              },
              () => {
                if (!cancelled) setStatus("error");
              },
            ),
          ],
        });
        game.canvas.setAttribute("role", "img");
        game.canvas.setAttribute(
          "aria-label",
          "Hanna and Cj meet at the university entrance. A little heart rests above them.",
        );
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [still]);
  return (
    <div className="reunion-wrap">
      <div ref={root} className="reunion-canvas" />
      {status !== "ready" && (
        <p role="status">
          {status === "error"
            ? "The picture couldn’t load. Hanna and Cj meet, side by side beneath a little heart. You can continue below."
            : "A familiar face is waiting…"}
        </p>
      )}
    </div>
  );
}
