import type { Direction } from "./world";
import type { WorldNpc, ContributorVisit } from "./connected";
import type { SceneKey } from "./scenes";
import type { ANIMAL_VARIANTS } from "./characters/catalog";
export type GameStatus = "loading" | "ready" | "error";
export class GameBridge {
  constructor(
    public readonly npcs?: WorldNpc[],
    public readonly mapKey: SceneKey = "sta_ana_house",
    public readonly visitor?: ContributorVisit["visitor"],
    public readonly artPreview?: (typeof ANIMAL_VARIANTS)[number],
  ) {}
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
    if (this.visitor && !this.canTalk(this.nearId)) return;
    this.interact = true;
  }
  canTalk(id: string) {
    return (
      !this.visitor ||
      !!this.npcs?.some((npc) => npc.id === id && npc.readable === true)
    );
  }
  requestReset() {
    this.resetRequested = true;
  }
  clear() {
    this.held.clear();
    this.interact = false;
  }
  setNear(near: boolean, id = "") {
    if (this.visitor && !this.canTalk(id)) {
      near = false;
      id = "";
    }
    if (near !== this.near || id !== this.nearId) {
      this.near = near;
      this.nearId = id;
      this.onNear(near);
    }
  }
}
