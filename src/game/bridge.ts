import type { Direction } from "./world";
import type { WorldNpc } from "./connected";
export type GameStatus = "loading" | "ready" | "error";
export class GameBridge {
  constructor(public readonly npcs?: WorldNpc[]) {}
  held = new Set<Direction>();
  paused = false;
  interact = false;
  resetRequested = false;
  near = false;
  nearId = "";
  onNear: (near: boolean) => void = () => {};
  onTalk: (id: string) => void = () => {};
  onStatus: (status: GameStatus) => void = () => {};
  connect(
    onNear: typeof this.onNear,
    onTalk: typeof this.onTalk,
    onStatus: typeof this.onStatus,
  ) {
    this.onNear = onNear;
    this.onTalk = onTalk;
    this.onStatus = onStatus;
  }
  pause(paused: boolean) {
    this.paused = paused;
    this.clear();
  }
  requestTalk() {
    this.interact = true;
  }
  requestReset() {
    this.resetRequested = true;
  }
  clear() {
    this.held.clear();
    this.interact = false;
  }
  setNear(near: boolean, id = "") {
    if (near !== this.near || id !== this.nearId) {
      this.near = near;
      this.nearId = id;
      this.onNear(near);
    }
  }
}
