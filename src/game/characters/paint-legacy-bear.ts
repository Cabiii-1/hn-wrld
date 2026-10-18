type PixelCanvas = Pick<
  CanvasRenderingContext2D,
  "fillStyle" | "fillRect" | "save" | "restore" | "translate"
>;
export function paintLegacyBear(
  c: PixelCanvas,
  key: string,
  coat: string,
  accessory: string,
) {
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  for (let frame = 0; frame < 12; frame++) {
    c.save();
    c.translate(frame * 32, 0);
    const direction = Math.floor(frame / 4);
    const walking = frame % 4 >= 2;
    const step = frame % 2;
    const bob = step;
    const outline = "#65483b";
    rect(7, 27, 19, 3, "#80634440");
    rect(9, 19 + bob, 14, 9, outline);
    rect(10, 19 + bob, 12, 7, coat);
    rect(7, 20 + bob, 3, 5, outline);
    rect(23, 20 + bob, 3, 5, outline);
    rect(8, 20 + bob, 2, 4, coat);
    rect(23, 20 + bob, 2, 4, coat);
    rect(10, 26 + (walking ? step : 0), 5, 3, outline);
    rect(18, 26 + (walking ? 1 - step : 0), 5, 3, outline);
    rect(6, 4 + bob, 7, 8, outline);
    rect(20, 4 + bob, 7, 8, outline);
    rect(8, 6 + bob, 3, 4, "#dfa69a");
    rect(22, 6 + bob, 3, 4, "#dfa69a");
    rect(6, 10 + bob, 21, 10, outline);
    rect(9, 7 + bob, 15, 16, outline);
    rect(8, 10 + bob, 17, 9, coat);
    rect(10, 9 + bob, 13, 12, coat);
    if (direction !== 1) {
      const side = direction === 2;
      rect(side ? 18 : 11, 13 + bob, 2, 3, outline);
      rect(21, 13 + bob, 2, 3, outline);
      rect(side ? 20 : 14, 17 + bob, 6, 4, "#fff1d6");
      rect(side ? 23 : 16, 17 + bob, 2, 2, outline);
      rect(9, 17 + bob, 3, 2, "#edaaa0");
      rect(23, 17 + bob, 2, 2, "#edaaa0");
    }
    rect(10, 22 + bob, 13, 3, accessory);
    if (key === "hanna" || key === "npc-rose-bow") {
      rect(23, 8 + bob, 4, 3, accessory);
      rect(25, 6 + bob, 3, 7, accessory);
    } else {
      rect(12, 23 + bob, 3, 5, accessory);
    }
    c.restore();
  }
}
