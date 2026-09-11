export interface Point { x: number; y: number }
export interface View { x: number; y: number; width: number; height: number }
export const key = (p: Point) => `${p.x},${p.y}`;
export const equal = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const directions: Point[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export function visible(p: Point, view: View): boolean {
  return p.x - 0.5 >= view.x - view.width / 2 && p.x + 0.5 <= view.x + view.width / 2 &&
    p.y - 0.5 >= view.y - view.height / 2 && p.y + 0.5 <= view.y + view.height / 2;
}
function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
export class World {
  private chunks = new Map<string, Set<string>>();
  constructor(public seed = 1729) {}
  collides(p: Point, radius: number): boolean {
    for (let y = Math.floor(p.y - radius - .43); y <= Math.ceil(p.y + radius + .43); y++)
      for (let x = Math.floor(p.x - radius - .43); x <= Math.ceil(p.x + radius + .43); x++) {
        if (!this.blocked({ x, y })) continue;
        const dx = Math.max(0, Math.abs(p.x - x) - .43), dy = Math.max(0, Math.abs(p.y - y) - .43);
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    return false;
  }
  sweptCollision(a: Point, b: Point, radius: number): boolean {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / .1));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.collides({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, radius)) return true;
    }
    return false;
  }
  blocked(p: Point): boolean {
    const cx = Math.floor(p.x / 32), cy = Math.floor(p.y / 32);
    const id = `${cx},${cy}`;
    if (!this.chunks.has(id)) this.generate(cx, cy);
    return this.chunks.get(id)!.has(key(p));
  }
  private generate(cx: number, cy: number) {
    const rocks = new Set<string>();
    // Isolated islands inside 8-cell blocks leave a connected network of open lanes.
    for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
      const x = cx * 32 + bx * 8 + 3, y = cy * 32 + by * 8 + 3;
      const h = hash(x, y, this.seed);
      const length = 3 + (h >>> 4) % 3;
      for (let i = 0; i < length; i++) {
        const p = { x: x + (h % 2 ? i : 0), y: y + (h % 2 ? 0 : i) };
        if (p.x >= -11 && p.x <= 3 && Math.abs(p.y) <= 1) continue;
        rocks.add(key(p));
        // Short L-shaped islands make the field denser while preserving open lanes.
        if (i < 3) {
          const elbow = { x: x + (h % 2 ? 0 : i), y: y + (h % 2 ? i : 0) };
          if (!(elbow.x >= -11 && elbow.x <= 3 && Math.abs(elbow.y) <= 1)) rocks.add(key(elbow));
        }
      }
    }
    this.chunks.set(`${cx},${cy}`, rocks);
  }
}
