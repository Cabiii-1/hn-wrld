import * as Phaser from "phaser";
import { makeBearTextures } from "./bear-art";

// A small, self-contained scene: no private prose enters the Phaser runtime.
export class ReunionScene extends Phaser.Scene {
  private bubu!: Phaser.GameObjects.Sprite;
  private dudu!: Phaser.GameObjects.Sprite;
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
    makeBearTextures(this, "bubu", "#f8e8c9", "#d88182");
    makeBearTextures(this, "dudu", "#b78459", "#778b63");
    this.bubu = this.add
      .sprite(this.still ? 148 : 90, 137, "bubu")
      .setOrigin(0.5, 30 / 32);
    this.dudu = this.add
      .sprite(this.still ? 172 : 230, 137, "dudu")
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
      this.bubu.play("bubu-walk-side");
      this.dudu.play("dudu-walk-side");
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
    if (!this.bubu || this.still || document.hidden || !document.hasFocus())
      return;
    this.elapsed += Math.min(delta, 50);
    const t = Math.min(1, this.elapsed / 3000);
    this.bubu.x = Math.round(90 + 58 * t);
    this.dudu.x = Math.round(230 - 58 * t);
    if (t === 1) {
      this.bubu.anims.stop();
      this.dudu.anims.stop();
      this.bubu.setFrame(8);
      this.dudu.setFrame(8);
      this.heart.setVisible(true);
    }
  }
}
