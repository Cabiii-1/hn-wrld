import * as Phaser from "phaser";
import { GameBridge } from "./bridge";
import { makeBearTextures } from "./bear-art";
import { WORLD, normalizedInput, type Direction } from "./world";
import { Crowd, facingDirection, type BearState } from "./crowd";
import { demoNpcs } from "./demo-fixtures";
type Actor = {
  data: BearState;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
};
// Shared scenic renderer; each map supplies separate art, geometry and spawns.
export class PlaceScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private actors: Actor[] = [];
  private crowd!: Crowd;
  private marker!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: Direction = "down";
  private activeWindow = true;
  private debugOutput?: HTMLElement;
  private nextDebug = 0;
  private frameCount = 0;
  private measuredSeconds = 0;
  private benchmark = false;
  constructor(private bridge: GameBridge) {
    super(bridge.mapKey);
  }
  preload() {
    this.load.image("backdrop", `/game/backgrounds/${this.bridge.mapKey}.webp`);
    this.load.on("loaderror", () => this.bridge.onStatus("error"));
  }
  create() {
    if (!this.textures.exists("backdrop")) return;
    this.add
      .image(0, 0, "backdrop")
      .setOrigin(0)
      .setDisplaySize(WORLD.width, WORLD.height);
    makeBearTextures(this, "bubu", "#f8e8c9", "#d88182");
    makeBearTextures(this, "npc-cream-1", "#f1d8b0", "#778b63");
    makeBearTextures(this, "npc-brown-scarf", "#b78459", "#778b63");
    makeBearTextures(this, "npc-rose-bow", "#f3dfc5", "#ce8796");
    this.crowd = new Crowd(
      this.bridge.mapKey,
      this.bridge.npcs ?? demoNpcs(this.bridge.mapKey, 1),
    );
    this.player = this.add
      .sprite(
        this.crowd.player.x,
        this.crowd.player.y,
        this.bridge.visitor?.variant ?? "bubu",
      )
      .setOrigin(0.5, 30 / 32);
    const style = {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#fffdf4",
      backgroundColor: "#674d3deb",
      padding: { x: 7, y: 4 },
    };
    this.playerLabel = this.add
      .text(
        0,
        0,
        this.bridge.visitor
          ? `${this.bridge.visitor.name.length > 22 ? this.bridge.visitor.name.slice(0, 21) + "…" : this.bridge.visitor.name} (you)`
          : "Bubu ♡",
        style,
      )
      .setOrigin(0.5, 1);
    this.actors = this.crowd.bears.map((data) => ({
      data,
      sprite: this.add
        .sprite(data.x, data.y, data.variant)
        .setOrigin(0.5, 30 / 32),
      label: this.add
        .text(
          0,
          0,
          data.name.length > 22 ? data.name.slice(0, 21) + "…" : data.name,
          style,
        )
        .setOrigin(0.5, 1),
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
    const query = new URLSearchParams(location.search);
    this.benchmark =
      location.pathname === "/demo" && query.get("benchmark") === "1";
    if (query.has("debug")) {
      this.debugOutput = document.createElement("output");
      this.debugOutput.id = "game-debug";
      this.debugOutput.hidden = true;
      this.game.canvas.parentElement?.append(this.debugOutput);
    }
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.scale.off("resize", this.resize, this);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
      this.debugOutput?.remove();
      this.bridge.clear();
      this.bridge.setNear(false);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, release);
    this.events.once(Phaser.Scenes.Events.DESTROY, release);
    this.bridge.onStatus("ready");
  }
  private clearInput() {
    this.bridge.clear();
    this.input.keyboard?.resetKeys();
  }
  private resize() {
    const { width, height } = this.scale,
      zoom = Math.max(
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
    const depth = Math.round(sprite.y);
    if (sprite.depth !== depth) sprite.setDepth(depth);
  }
  update(time: number, delta: number) {
    if (!this.player) return;
    const paused = this.bridge.paused || !this.activeWindow,
      dt = Math.min(delta, 40) / 1000;
    if (this.input.keyboard) {
      this.input.keyboard.enabled = !this.bridge.paused;
      this.input.keyboard.manager.preventDefault = !this.bridge.paused;
    }
    if (this.bridge.resetRequested) {
      this.crowd.resetPlayer();
      this.bridge.resetRequested = false;
      this.clearInput();
    }
    const down = (...names: string[]) => names.some((n) => this.keys[n].isDown),
      held = this.bridge.held;
    let input = normalizedInput(
      Number(down("D", "RIGHT") || held.has("right")) -
        Number(down("A", "LEFT") || held.has("left")),
      Number(down("S", "DOWN") || held.has("down")) -
        Number(down("W", "UP") || held.has("up")),
    );
    if (this.benchmark && !paused)
      input = normalizedInput(
        Math.floor(time / 2500) % 2 ? 1 : -1,
        Math.floor(time / 5000) % 2 ? 0.3 : -0.3,
      );
    const moving = !paused && (input.x !== 0 || input.y !== 0);
    if (!paused) {
      if (moving) this.facing = facingDirection(input);
      this.crowd.step(input, dt);
    } else this.clearInput();
    this.player.setPosition(
      Math.round(this.crowd.player.x),
      Math.round(this.crowd.player.y),
    );
    const nearest = this.crowd.nearest();
    this.bridge.setNear(!this.bridge.visitor && !!nearest, nearest?.id ?? "");
    for (const actor of this.actors) {
      actor.sprite.setPosition(
        Math.round(actor.data.x),
        Math.round(actor.data.y),
      );
      this.animate(
        actor.sprite,
        actor.data.variant,
        actor.data.facing,
        !paused && actor.data.walking,
      );
      actor.label
        .setVisible(this.actors.length <= 10 || actor.data === nearest)
        .setPosition(actor.sprite.x, actor.sprite.y - 34)
        .setDepth(1000);
    }
    const action =
      Phaser.Input.Keyboard.JustDown(this.keys.E) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
      Phaser.Input.Keyboard.JustDown(this.keys.ENTER) ||
      this.bridge.interact;
    this.bridge.interact = false;
    if (!this.bridge.visitor && !paused && nearest && action) {
      this.clearInput();
      this.bridge.paused = true;
      this.bridge.onTalk(nearest.id);
    }
    this.animate(
      this.player,
      this.bridge.visitor?.variant ?? "bubu",
      this.facing,
      moving,
    );
    this.playerLabel
      .setPosition(this.player.x, this.player.y - 34)
      .setDepth(1000);
    this.marker
      .setVisible(!this.bridge.visitor && !!nearest && !paused)
      .setDepth(1001);
    if (nearest)
      this.marker.setPosition(
        Math.round(nearest.x),
        Math.round(nearest.y - 59),
      );
    if (!paused) {
      this.frameCount++;
      this.measuredSeconds += delta / 1000;
    }
    if (this.debugOutput && time > this.nextDebug) {
      this.nextDebug = time + 500;
      this.debugOutput.textContent = JSON.stringify({
        mapKey: this.bridge.mapKey,
        player: this.crowd.player,
        npcCount: this.actors.length,
        moving,
        near: !!nearest,
        paused,
        facing: this.facing,
        fps: Math.round(this.game.loop.actualFps),
        measuredFps: Math.round(
          this.frameCount / Math.max(0.001, this.measuredSeconds),
        ),
        sampleSeconds: Math.round(this.measuredSeconds),
        bears: this.crowd.bears.map((b) => ({
          x: b.x,
          y: b.y,
          spawnX: b.spawnX,
          spawnY: b.spawnY,
          radius: b.radius,
        })),
      });
    }
  }
}
