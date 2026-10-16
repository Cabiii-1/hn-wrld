import type { Direction } from "./world";
export type GameStatus = "loading" | "ready" | "error";
export class GameBridge {
  held = new Set<Direction>();
  paused = false;
  interact = false;
  resetRequested = false;
  near = false;
  onNear: (near: boolean) => void = () => {};
  onTalk: () => void = () => {};
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
  setNear(near: boolean) {
    if (near !== this.near) {
      this.near = near;
      this.onNear(near);
    }
  }
}
