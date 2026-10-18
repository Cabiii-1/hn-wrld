import * as Phaser from "phaser";
import { makeBearTextures } from "./bear-art";

// A small, self-contained scene: no private prose enters the Phaser runtime.
export class ReunionScene extends Phaser.Scene {
  private hanna!: Phaser.GameObjects.Sprite;
  private cj!: Phaser.GameObjects.Sprite;
  private heart!: Phaser.GameObjects.Text;
  private elapsed = 0;
  constructor(
    private still: boolean,
    private onReady: () => void,
    private onError: () => void,
  ) {
    super("reunion");
  }
  preload() {
    this.load.image("reunion-place", "/game/backgrounds/slu_baguio.webp");
    this.load.on("loaderror", this.onError);
  }
  create() {
    if (!this.textures.exists("reunion-place")) return;
    this.add.image(160, 90, "reunion-place").setDisplaySize(320, 180);
    this.add.rectangle(160, 90, 320, 180, 0xfff1cf, 0.16);
    makeBearTextures(this, "hanna", "#f8e8c9", "#d88182");
    makeBearTextures(this, "cj", "#b78459", "#778b63");
    this.hanna = this.add
      .sprite(this.still ? 148 : 90, 137, "hanna")
      .setOrigin(0.5, 30 / 32);
    this.cj = this.add
      .sprite(this.still ? 172 : 230, 137, "cj")
      .setOrigin(0.5, 30 / 32)
      .setFlipX(true);
    this.heart = this.add
      .text(160, 87, "♥", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#a34360",
        stroke: "#fff5db",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setVisible(this.still);
    if (!this.still) {
      this.hanna.play("hanna-walk-side");
      this.cj.play("cj-walk-side");
    }
    const resize = () => {
      const zoom = Math.max(
        1,
        Math.floor(Math.min(this.scale.width / 320, this.scale.height / 180)),
      );
      this.cameras.main
        .setZoom(zoom)
        .centerOn(160, 90)
        .setBackgroundColor("#f3ecd2");
      this.cameras.main.roundPixels = true;
    };
    resize();
    this.scale.on("resize", resize);
    this.events.once(Phaser.Scenes.Events.DESTROY, () =>
      this.scale.off("resize", resize),
    );
    this.onReady();
  }
  update(_time: number, delta: number) {
    if (!this.hanna || this.still || document.hidden || !document.hasFocus())
      return;
    this.elapsed += Math.min(delta, 50);
    const t = Math.min(1, this.elapsed / 3000);
    this.hanna.x = Math.round(90 + 58 * t);
    this.cj.x = Math.round(230 - 58 * t);
    if (t === 1) {
      this.hanna.anims.stop();
      this.cj.anims.stop();
      this.hanna.setFrame(8);
      this.cj.setFrame(8);
      this.heart.setVisible(true);
    }
  }
}
