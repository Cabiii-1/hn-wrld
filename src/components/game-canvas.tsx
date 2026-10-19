"use client";
import { useEffect, useRef } from "react";
import type * as Phaser from "phaser";
import { GameBridge } from "@/game/bridge";
import { SCENES } from "@/game/scenes";
export default function GameCanvas({ bridge }: { bridge: GameBridge }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | undefined;
    let cancelled = false;
    void Promise.all([import("phaser"), import("@/game/house-scene")])
      .then(([Phaser, { PlaceScene }]) => {
        if (cancelled || !container.current) return;
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: container.current,
          backgroundColor: "#d8e6b1",
          pixelArt: true,
          roundPixels: true,
          antialias: false,
          scale: {
            mode: Phaser.Scale.RESIZE,
            width: container.current.clientWidth,
            height: container.current.clientHeight,
          },
          scene: [new PlaceScene(bridge)],
          render: { antialias: false, pixelArt: true, roundPixels: true },
        });
        game.canvas.setAttribute(
          "aria-label",
          bridge.visitor
            ? `${SCENES[bridge.mapKey].name}. Use WASD, arrow keys, or the direction pad to move your bear. Press E or tap Talk near a bear who shared their letter.`
            : `${SCENES[bridge.mapKey].name}. Use WASD or arrow keys to move Hanna, and E to talk to a nearby bear.`,
        );
        game.canvas.setAttribute("role", "img");
      })
      .catch(() => {
        if (!cancelled) bridge.onStatus("error");
      });
    return () => {
      cancelled = true;
      bridge.clear();
      game?.destroy(true);
    };
  }, [bridge]);
  return <div className="game-canvas" ref={container} />;
}
