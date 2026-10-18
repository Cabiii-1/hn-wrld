import type { WorldNpc } from "./connected";
import { SCENES, safePlacement, type SceneKey } from "./scenes";
import {
  canStand,
  moveFeet,
  nextRandom,
  normalizedInput,
  type Point,
  type Direction,
} from "./world";
export type BearState = WorldNpc & {
  spawnX: number;
  spawnY: number;
  target: Point;
  seed: number;
  next: number;
  facing: Direction;
  walking: boolean;
};
// One grid per simulation, reused across frames. Neighbour queries inspect only
// nearby cells instead of allocating/filtering the entire cast for each bear.
class FeetGrid {
  private cells = new Map<string, Set<Point>>();
  private key(p: Point) {
    return `${Math.floor(p.x / 32)},${Math.floor(p.y / 32)}`;
  }
  add(p: Point) {
    const key = this.key(p);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = new Set();
      this.cells.set(key, cell);
    }
    cell.add(p);
  }
  remove(p: Point) {
    const key = this.key(p),
      cell = this.cells.get(key);
    cell?.delete(p);
    if (!cell?.size) this.cells.delete(key);
  }
  near(p: Point) {
    const result: Point[] = [];
    const cx = Math.floor(p.x / 32),
      cy = Math.floor(p.y / 32);
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (const q of this.cells.get(`${x},${y}`) ?? [])
          if (q !== p) result.push(q);
    return result;
  }
}
export function facingDirection(d: Point): Direction {
  return Math.abs(d.x) > Math.abs(d.y)
    ? d.x > 0
      ? "right"
      : "left"
    : d.y > 0
      ? "down"
      : "up";
}
export class Crowd {
  readonly bears: BearState[];
  readonly player: Point;
  private grid = new FeetGrid();
  elapsed = 0;
  constructor(
    readonly map: SceneKey,
    npcs: WorldNpc[],
  ) {
    this.bears = npcs
      .filter((n) => safePlacement(map, n.x, n.y, n.radius))
      .map((n, i) => {
        const bear: BearState = {
          ...n,
          spawnX: n.x,
          spawnY: n.y,
          target: { x: n.x, y: n.y },
          seed: 42 + i * 7919,
          next: 500 + i * 137,
          facing: "down",
          walking: false,
        };
        // Resolve duplicate starts deterministically within their assigned bounds.
        if (
          this.grid
            .near(bear)
            .some((p) => Math.hypot(p.x - bear.x, p.y - bear.y) < 19)
        ) {
          outer: for (let dy = -n.radius; dy <= n.radius; dy += 4)
            for (let dx = -n.radius; dx <= n.radius; dx += 4) {
              const p = { x: n.x + dx, y: n.y + dy };
              if (
                canStand(p.x, p.y, map) &&
                this.grid
                  .near(p)
                  .every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 19)
              ) {
                bear.x = p.x;
                bear.y = p.y;
                break outer;
              }
            }
        }
        this.grid.add(bear);
        return bear;
      });
    const start = SCENES[map].player;
    let spawn: Point = { ...start },
      best = Infinity;
    if (
      this.grid
        .near(spawn)
        .some((p) => Math.hypot(p.x - spawn.x, p.y - spawn.y) < 24)
    ) {
      for (let y = 245; y < 425; y += 8)
        for (let x = 32; x < 804; x += 8) {
          const p = { x, y },
            d = Math.hypot(x - start.x, y - start.y);
          if (
            d < best &&
            canStand(x, y, map) &&
            this.grid.near(p).every((q) => Math.hypot(q.x - x, q.y - y) >= 24)
          ) {
            spawn = p;
            best = d;
          }
        }
    }
    this.player = spawn;
    this.grid.add(this.player);
  }
  resetPlayer() {
    this.grid.remove(this.player);
    Object.assign(this.player, SCENES[this.map].player);
    this.grid.add(this.player);
  }
  step(input: Point, deltaSeconds: number) {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.04));
    this.elapsed += dt * 1000;
    this.grid.remove(this.player);
    Object.assign(
      this.player,
      moveFeet(
        this.player,
        input.x * 95 * dt,
        input.y * 95 * dt,
        this.grid.near(this.player),
        this.map,
      ),
    );
    this.grid.add(this.player);
    for (const bear of this.bears) {
      bear.walking = false;
      if (!bear.radius) continue;
      if (this.elapsed > bear.next) {
        bear.seed = nextRandom(bear.seed);
        const x =
          bear.spawnX + (bear.seed % (bear.radius * 2 + 1)) - bear.radius;
        bear.seed = nextRandom(bear.seed);
        const y =
          bear.spawnY + (bear.seed % (bear.radius * 2 + 1)) - bear.radius;
        bear.target = { x, y };
        bear.next = this.elapsed + 2400 + (bear.seed % 1800);
      }
      if (Math.hypot(bear.target.x - bear.x, bear.target.y - bear.y) <= 2)
        continue;
      const d = normalizedInput(bear.target.x - bear.x, bear.target.y - bear.y);
      this.grid.remove(bear);
      const p = moveFeet(
        bear,
        d.x * 20 * dt,
        d.y * 20 * dt,
        this.grid.near(bear),
        this.map,
      );
      p.x = Math.max(
        bear.spawnX - bear.radius,
        Math.min(bear.spawnX + bear.radius, p.x),
      );
      p.y = Math.max(
        bear.spawnY - bear.radius,
        Math.min(bear.spawnY + bear.radius, p.y),
      );
      bear.walking = p.x !== bear.x || p.y !== bear.y;
      bear.facing = facingDirection(d);
      bear.x = p.x;
      bear.y = p.y;
      this.grid.add(bear);
    }
  }
  nearest(eligible?: (bear: BearState) => boolean) {
    let result: BearState | undefined,
      distance = 78;
    for (const bear of this.bears) {
      if (eligible && !eligible(bear)) continue;
      const d = Math.hypot(bear.x - this.player.x, bear.y - this.player.y);
      if (d < distance) {
        result = bear;
        distance = d;
      }
    }
    return result;
  }
}
