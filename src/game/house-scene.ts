import * as Phaser from "phaser";
import { GameBridge } from "./bridge";
import { makeBearTextures } from "./bear-art";
import {
  WORLD,
  PLAYER_START,
  NPC_START,
  moveFeet,
  normalizedInput,
  nextRandom,
  type Point,
  type Direction,
} from "./world";
import type { WorldNpc } from "./connected";
type Actor = {
  data: WorldNpc;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  target: Point;
  facing: Direction;
  seed: number;
  next: number;
};
export class HouseScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private actors: Actor[] = [];
  private marker!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: Direction = "down";
  private elapsed = 0;
  private activeWindow = true;
  private debugOutput?: HTMLElement;
  constructor(private bridge: GameBridge) {
    super("sta_ana_house");
  }
  preload() {
    this.load.image("house", "/game/backgrounds/sta_ana_house.png");
    this.load.on("loaderror", () => this.bridge.onStatus("error"));
  }
  create() {
    if (!this.textures.exists("house")) return;
    this.add
      .image(0, 0, "house")
      .setOrigin(0)
      .setDisplaySize(WORLD.width, WORLD.height);
    makeBearTextures(this, "bubu", "#f8e8c9", "#d88182");
    makeBearTextures(this, "npc-cream-1", "#f1d8b0", "#778b63");
    makeBearTextures(this, "npc-brown-scarf", "#b78459", "#778b63");
    makeBearTextures(this, "npc-rose-bow", "#f3dfc5", "#ce8796");
    this.player = this.add
      .sprite(PLAYER_START.x, PLAYER_START.y, "bubu")
      .setOrigin(0.5, 30 / 32);
    const style = {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#fffdf4",
      backgroundColor: "#674d3deb",
      padding: { x: 7, y: 4 },
    };
    this.playerLabel = this.add.text(0, 0, "Bubu ♡", style).setOrigin(0.5, 1);
    const npcs = this.bridge.npcs ?? [
      {
        id: "sample",
        name: "Teddy · sample",
        variant: "npc-brown-scarf" as const,
        ...NPC_START,
        radius: 20,
        seen: false,
      },
    ];
    this.actors = npcs.map((data, i) => ({
      data,
      sprite: this.add
        .sprite(data.x, data.y, data.variant)
        .setOrigin(0.5, 30 / 32),
      label: this.add.text(0, 0, data.name, style).setOrigin(0.5, 1),
      target: { x: data.x, y: data.y },
      facing: "down",
      seed: 42 + i * 7919,
      next: 500 + i * 137,
    }));
    this.marker = this.add
      .text(0, 0, "E / Talk", {
        ...style,
        color: "#514638",
        backgroundColor: "#fff9dc",
      })
      .setOrigin(0.5, 1);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER",
    ) as typeof this.keys;
    this.input.keyboard!.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE"]);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.roundPixels = true;
    this.resize();
    this.scale.on("resize", this.resize, this);
    const blur = () => {
      this.activeWindow = false;
      this.clearInput();
    };
    const focus = () => {
      this.activeWindow = !document.hidden;
      this.clearInput();
    };
    const visibility = () => (document.hidden ? blur() : focus());
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    if (new URLSearchParams(location.search).has("debug")) {
      this.debugOutput = document.createElement("output");
      this.debugOutput.id = "game-debug";
      this.debugOutput.hidden = true;
      this.game.canvas.parentElement?.append(this.debugOutput);
    }
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.resize, this);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
      this.debugOutput?.remove();
      this.bridge.clear();
    });
    this.bridge.onStatus("ready");
  }
  private clearInput() {
    this.bridge.clear();
    this.input.keyboard?.resetKeys();
  }
  private resize() {
    const { width, height } = this.scale;
    const zoom = Math.max(
      1,
      Math.ceil(Math.max(width / WORLD.width, height / WORLD.height)),
    );
    this.cameras.main.setZoom(zoom).startFollow(this.player, true, 1, 1);
    if (width / zoom >= WORLD.width && height / zoom >= WORLD.height)
      this.cameras.main
        .stopFollow()
        .centerOn(WORLD.width / 2, WORLD.height / 2);
  }
  private animate(
    sprite: Phaser.GameObjects.Sprite,
    key: string,
    facing: Direction,
    walking: boolean,
  ) {
    sprite.setFlipX(facing === "left");
    sprite.play(
      `${key}-${walking ? "walk" : "idle"}-${facing === "left" || facing === "right" ? "side" : facing}`,
      true,
    );
    if (
      !walking &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      sprite.anims.pause();
    else sprite.anims.resume();
    sprite.setDepth(sprite.y);
  }
  update(_time: number, delta: number) {
    if (!this.player) return;
    const dt = Math.min(delta, 40) / 1000,
      paused = this.bridge.paused || !this.activeWindow;
    // Let native dialogue scrolling and audio keyboard controls receive arrows
    // and Space while React owns the interaction.
    if (this.input.keyboard) {
      this.input.keyboard.enabled = !this.bridge.paused;
      this.input.keyboard.manager.preventDefault = !this.bridge.paused;
    }
    let moving = false;
    if (this.bridge.resetRequested) {
      this.player.setPosition(PLAYER_START.x, PLAYER_START.y);
      this.bridge.resetRequested = false;
      this.clearInput();
    }
    if (!paused) {
      this.elapsed += dt * 1000;
      const down = (...names: string[]) =>
          names.some((n) => this.keys[n].isDown),
        held = this.bridge.held;
      const input = normalizedInput(
        Number(down("D", "RIGHT") || held.has("right")) -
          Number(down("A", "LEFT") || held.has("left")),
        Number(down("S", "DOWN") || held.has("down")) -
          Number(down("W", "UP") || held.has("up")),
      );
      moving = input.x !== 0 || input.y !== 0;
      if (moving) this.facing = this.direction(input);
      const p = moveFeet(
        this.player,
        input.x * 95 * dt,
        input.y * 95 * dt,
        this.actors.map((a) => a.sprite),
      );
      this.player.setPosition(p.x, p.y);
    } else this.clearInput();
    for (const actor of this.actors) {
      let walking = false;
      if (!paused && actor.data.radius > 0) {
        if (this.elapsed > actor.next) {
          actor.seed = nextRandom(actor.seed);
          const x =
            actor.data.x +
            (actor.seed % (actor.data.radius * 2 + 1)) -
            actor.data.radius;
          actor.seed = nextRandom(actor.seed);
          const y =
            actor.data.y +
            (actor.seed % (actor.data.radius * 2 + 1)) -
            actor.data.radius;
          actor.target = { x, y };
          actor.next = this.elapsed + 2400 + (actor.seed % 1800);
        }
        if (
          Phaser.Math.Distance.BetweenPoints(actor.sprite, actor.target) > 2
        ) {
          const d = normalizedInput(
            actor.target.x - actor.sprite.x,
            actor.target.y - actor.sprite.y,
          );
          const n = moveFeet(actor.sprite, d.x * 20 * dt, d.y * 20 * dt, [
            this.player,
            ...this.actors.filter((a) => a !== actor).map((a) => a.sprite),
          ]);
          walking = n.x !== actor.sprite.x || n.y !== actor.sprite.y;
          actor.facing = this.direction(d);
          actor.sprite.setPosition(n.x, n.y);
        }
      }
      this.animate(actor.sprite, actor.data.variant, actor.facing, walking);
      actor.label
        .setPosition(
          Math.round(actor.sprite.x),
          Math.round(actor.sprite.y - 34),
        )
        .setDepth(1000);
    }
    const nearest = this.actors.reduce<Actor | undefined>(
      (best, a) =>
        !best ||
        Phaser.Math.Distance.BetweenPoints(this.player, a.sprite) <
          Phaser.Math.Distance.BetweenPoints(this.player, best.sprite)
          ? a
          : best,
      undefined,
    );
    const near =
      !!nearest &&
      Phaser.Math.Distance.BetweenPoints(this.player, nearest.sprite) < 78;
    this.bridge.setNear(near, near ? nearest!.data.id : "");
    const action =
      Phaser.Input.Keyboard.JustDown(this.keys.E) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
      Phaser.Input.Keyboard.JustDown(this.keys.ENTER) ||
      this.bridge.interact;
    this.bridge.interact = false;
    if (!paused && near && action) {
      this.clearInput();
      this.bridge.paused = true;
      this.bridge.onTalk(nearest!.data.id);
    }
    this.animate(this.player, "bubu", this.facing, moving && !paused);
    this.playerLabel
      .setPosition(Math.round(this.player.x), Math.round(this.player.y - 34))
      .setDepth(1000);
    this.marker.setVisible(near && !paused).setDepth(1001);
    if (nearest)
      this.marker.setPosition(
        Math.round(nearest.sprite.x),
        Math.round(nearest.sprite.y - 59),
      );
    if (this.debugOutput)
      this.debugOutput.textContent = JSON.stringify({
        player: { x: this.player.x, y: this.player.y },
        npcCount: this.actors.length,
        near,
        paused,
        facing: this.facing,
        fps: Math.round(this.game.loop.actualFps),
      });
  }
  private direction(d: Point): Direction {
    return Math.abs(d.x) > Math.abs(d.y)
      ? d.x > 0
        ? "right"
        : "left"
      : d.y > 0
        ? "down"
        : "up";
  }
}
