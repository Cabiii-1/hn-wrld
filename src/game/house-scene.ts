import * as Phaser from "phaser";
import { GameBridge } from "./bridge";
import { makeBearTextures } from "./bear-art";
import {
  WORLD,
  WANDER,
  PLAYER_START,
  NPC_START,
  moveFeet,
  normalizedInput,
  nextRandom,
  type Point,
  type Direction,
} from "./world";

export class HouseScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private npc!: Phaser.GameObjects.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private npcLabel!: Phaser.GameObjects.Text;
  private marker!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: Direction = "down";
  private npcFacing: Direction = "down";
  private seed = 42;
  private target: Point = NPC_START;
  private nextWander = 1800;
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
    makeBearTextures(this, "npc", "#b78459", "#778b63");
    this.player = this.add
      .sprite(PLAYER_START.x, PLAYER_START.y, "bubu")
      .setOrigin(0.5, 30 / 32);
    this.npc = this.add
      .sprite(NPC_START.x, NPC_START.y, "npc")
      .setOrigin(0.5, 30 / 32);
    const style = {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#fffdf4",
      backgroundColor: "#674d3deb",
      padding: { x: 7, y: 4 },
    };
    this.playerLabel = this.add.text(0, 0, "Bubu ♡", style).setOrigin(0.5, 1);
    this.npcLabel = this.add
      .text(0, 0, "Teddy · sample", style)
      .setOrigin(0.5, 1);
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
    // Read-only diagnostics are explicitly opt-in for browser verification.
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
    // Integer zoom; portrait crops scenery and follows the player across the yard.
    const zoom = Math.max(
      1,
      Math.ceil(Math.max(width / WORLD.width, height / WORLD.height)),
    );
    this.cameras.main.setZoom(zoom);
    this.cameras.main.startFollow(this.player, true, 1, 1);
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
    ) {
      sprite.anims.pause();
    } else {
      sprite.anims.resume();
    }
    sprite.setDepth(sprite.y);
  }
  update(_time: number, delta: number) {
    if (!this.player) return;
    const dt = Math.min(delta, 40) / 1000;
    let moving = false,
      npcMoving = false;
    const paused = this.bridge.paused || !this.activeWindow;
    if (this.bridge.resetRequested) {
      this.player.setPosition(PLAYER_START.x, PLAYER_START.y);
      this.bridge.resetRequested = false;
      this.clearInput();
    }
    if (!paused) {
      this.elapsed += dt * 1000;
      const down = (...names: string[]) =>
        names.some((n) => this.keys[n].isDown);
      const held = this.bridge.held;
      const input = normalizedInput(
        Number(down("D", "RIGHT") || held.has("right")) -
          Number(down("A", "LEFT") || held.has("left")),
        Number(down("S", "DOWN") || held.has("down")) -
          Number(down("W", "UP") || held.has("up")),
      );
      moving = input.x !== 0 || input.y !== 0;
      if (moving)
        this.facing =
          Math.abs(input.x) > Math.abs(input.y)
            ? input.x > 0
              ? "right"
              : "left"
            : input.y > 0
              ? "down"
              : "up";
      const p = moveFeet(
        this.player,
        input.x * 95 * dt,
        input.y * 95 * dt,
        this.npc,
      );
      this.player.setPosition(p.x, p.y);
      if (this.elapsed > this.nextWander) {
        this.seed = nextRandom(this.seed);
        const x = WANDER.left + (this.seed % (WANDER.right - WANDER.left));
        this.seed = nextRandom(this.seed);
        const y = WANDER.top + (this.seed % (WANDER.bottom - WANDER.top));
        this.target = { x, y };
        this.nextWander = this.elapsed + 2400 + (this.seed % 1800);
      }
      const distance = Phaser.Math.Distance.BetweenPoints(
        this.npc,
        this.target,
      );
      if (distance > 2) {
        const d = normalizedInput(
          this.target.x - this.npc.x,
          this.target.y - this.npc.y,
        );
        const n = moveFeet(this.npc, d.x * 20 * dt, d.y * 20 * dt, this.player);
        npcMoving = n.x !== this.npc.x || n.y !== this.npc.y;
        this.npcFacing =
          Math.abs(d.x) > Math.abs(d.y)
            ? d.x > 0
              ? "right"
              : "left"
            : d.y > 0
              ? "down"
              : "up";
        this.npc.setPosition(
          Phaser.Math.Clamp(n.x, WANDER.left, WANDER.right),
          Phaser.Math.Clamp(n.y, WANDER.top, WANDER.bottom),
        );
      }
      const near =
        Phaser.Math.Distance.BetweenPoints(this.player, this.npc) < 78;
      this.bridge.setNear(near);
      const action =
        Phaser.Input.Keyboard.JustDown(this.keys.E) ||
        Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
        Phaser.Input.Keyboard.JustDown(this.keys.ENTER) ||
        this.bridge.interact;
      this.bridge.interact = false;
      if (near && action) {
        this.clearInput();
        this.bridge.paused = true;
        this.bridge.onTalk();
      }
    } else this.clearInput();
    this.animate(this.player, "bubu", this.facing, moving && !paused);
    this.animate(this.npc, "npc", this.npcFacing, npcMoving && !paused);
    this.playerLabel
      .setPosition(Math.round(this.player.x), Math.round(this.player.y - 34))
      .setDepth(1000);
    this.npcLabel
      .setPosition(Math.round(this.npc.x), Math.round(this.npc.y - 34))
      .setDepth(1000);
    this.marker
      .setPosition(Math.round(this.npc.x), Math.round(this.npc.y - 59))
      .setDepth(1001)
      .setVisible(this.bridge.near && !this.bridge.paused);
    if (this.debugOutput)
      this.debugOutput.textContent = JSON.stringify({
        player: { x: this.player.x, y: this.player.y },
        npc: { x: this.npc.x, y: this.npc.y },
        near: this.bridge.near,
        paused: this.bridge.paused,
        facing: this.facing,
        animation: this.player.anims.currentAnim?.key,
        fps: Math.round(this.game.loop.actualFps),
      });
  }
}
