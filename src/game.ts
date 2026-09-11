import { pullContinuous, SNAKE_RADIUS, SEGMENT_SPACING } from './drag';
import { length, pointSegmentDistance } from './geometry';
import { key, visible, World, type Point, type View } from './world';
export interface Mole { point: Point; age: number; emerged: boolean }
export interface DragState { index: number; target: Point; valid: boolean }
export class Game {
  body: Point[] = Array.from({ length: 10 }, (_, i) => ({ x: 0 - i, y: 0 }));
  direction: Point = { x: 1, y: 0 };
  private mouseOffset: Point | null = null;
  world: World;
  food = new Map<string, Point>();
  moles = new Map<string, Mole>();
  hp = 10;
  elapsed = 0;
  immunity = 0;
  speed = 4;
  spawnClock = 0;
  paused = true;
  started = false;
  dead = false;
  hitCount = 0;
  pendingGrowth = 0;
  dragState: DragState | null = null;
  private cameraPosition: Point = { x: 0, y: 0 };
  constructor(seed = 1729, private random = Math.random) { this.world = new World(seed); }
  get interval() { return Math.max(.5, 1 - Math.floor(this.elapsed / 15) * .1); }
  get camera(): Point { return { ...this.cameraPosition }; }
  get renderedBody(): Point[] { return this.body; }
  view(): View { return { ...this.camera, width: 24, height: 18 }; }
  setMouseTarget(target: Point) {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    this.mouseOffset = { x: target.x - this.cameraPosition.x, y: target.y - this.cameraPosition.y };
  }
  damage() {
    if (this.immunity > 1e-9 || this.dead) return;
    this.hp = Math.max(0, this.hp - 1); this.immunity = 1; this.hitCount++;
    if (!this.hp) { this.dead = true; this.endDrag(); }
  }
  update(dt: number) {
    if (this.paused || this.dead || !Number.isFinite(dt) || dt <= 0) return;
    // Small physical steps prevent fast pulls from crossing thin obstacles.
    const steps = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < steps && !this.dead; i++) this.tick(dt / steps);
  }
  private tick(dt: number) {
    this.elapsed += dt;
    this.cameraPosition.x += 2 * dt;
    this.immunity = Math.max(0, this.immunity - dt);
    this.collectFood();
    // The cursor remains at the same screen position as the field scrolls beneath it.
    // A body grab takes priority so the head does not fight a tail pull.
    if (!this.dragState && this.mouseOffset && this.speed > 0) {
      const head = this.body[0];
      const destination = { x: this.cameraPosition.x + this.mouseOffset.x, y: this.cameraPosition.y + this.mouseOffset.y };
      const d = length(head, destination);
      if (d > 1e-6) {
        this.direction = { x: (destination.x - head.x) / d, y: (destination.y - head.y) / d };
        const travel = Math.min(d, this.speed * dt);
        const target = { x: head.x + this.direction.x * travel, y: head.y + this.direction.y * travel };
        if (!this.moveAnchor(0, target)) this.damage();
      }
    }
    if (this.dragState) {
      const state = this.dragState;
      if (!visible(this.body[state.index], this.view())) this.endDrag();
      else state.valid = this.drag(state.index, state.target, dt);
    }
    const view = this.view();
    for (const [id, mole] of this.moles) {
      if (!mole.emerged) {
        if (!visible(mole.point, view)) { this.moles.delete(id); continue; }
        mole.age += dt;
        if (mole.age >= 3 - 1e-9) mole.emerged = true;
      }
    }
    this.spawnClock += dt;
    if (this.spawnClock >= this.interval - 1e-9) { this.spawnClock = Math.max(0, this.spawnClock - this.interval); this.spawnMole(view); }
    this.collectFood();
    this.grow();
    this.replenishFood(view);
    this.contacts(view);
  }
  private collectFood() {
    for (const [id, food] of this.food) {
      for (let i = 0; i < this.body.length; i++) {
        if (pointSegmentDistance(food, this.body[i], this.body[Math.max(0, i - 1)]) <= SNAKE_RADIUS + .24) {
          this.food.delete(id); this.pendingGrowth++; break;
        }
      }
    }
  }
  private grow() {
    if (!this.pendingGrowth) return;
    const tail = this.body.at(-1)!, before = this.body.at(-2)!;
    const angle = Math.atan2(tail.y - before.y, tail.x - before.x);
    for (const offset of [0, .4, -.4, .8, -.8, 1.2, -1.2, Math.PI / 2, -Math.PI / 2]) {
      const next = { x: tail.x + Math.cos(angle + offset) * SEGMENT_SPACING, y: tail.y + Math.sin(angle + offset) * SEGMENT_SPACING };
      if (this.world.sweptCollision(tail, next, SNAKE_RADIUS)) continue;
      if (this.body.slice(0, -2).some(p => length(p, next) < SNAKE_RADIUS * 2)) continue;
      this.body.push(next); this.pendingGrowth--; return;
    }
  }
  private moveAnchor(index: number, target: Point): boolean {
    const view = this.view();
    if (index === 0) {
      target = { x: Math.min(view.x + view.width / 2 - .5, target.x),
        y: Math.max(-view.height / 2 + .5, Math.min(view.height / 2 - .5, target.y)) };
    }
    const result = pullContinuous(this.body, index, target);
    const head = result[0];
    if (head.y < -8.5 || head.y > 8.5 || head.x > view.x + 11.5) return false;
    // Only the head blocks movement. A trailing segment can scrape a wall and
    // take damage, but it must not act like an anchor that freezes the snake.
    if (this.world.sweptCollision(this.body[0], head, SNAKE_RADIUS)) return false;
    this.body = result;
    return true;
  }
  contacts(view = this.view()) {
    if (!visible(this.body[0], view)) this.damage();
    for (const p of this.body) if (visible(p, view) && this.world.collides(p, SNAKE_RADIUS)) this.damage();
    for (const mole of this.moles.values()) {
      if (!mole.emerged || !visible(mole.point, view)) continue;
      for (let i = 0; i < this.body.length; i++) {
        const a = this.body[i], b = this.body[Math.max(0, i - 1)];
        if ((visible(a, view) || visible(b, view)) && pointSegmentDistance(mole.point, a, b) < .33 + SNAKE_RADIUS) this.damage();
      }
    }
  }
  beginDrag(index: number): boolean {
    if (this.paused || this.dead || index < 0 || !this.body[index] || !visible(this.body[index], this.view())) return false;
    this.dragState = { index, target: { ...this.body[index] }, valid: true }; return true;
  }
  setDragTarget(target: Point) {
    if (this.dragState && Number.isFinite(target.x) && Number.isFinite(target.y)) this.dragState.target = { ...target };
  }
  endDrag() { this.dragState = null; }
  drag(index: number, target: Point, dt = 1 / 120): boolean {
    if (this.paused || this.dead || !this.body[index] || !visible(target, this.view())) return false;
    const origin = this.body[index], d = length(origin, target), fraction = d ? Math.min(1, 12 * dt / d) : 0;
    if (!d) return true;
    const next = { x: origin.x + (target.x - origin.x) * fraction, y: origin.y + (target.y - origin.y) * fraction };
    let moved = this.moveAnchor(index, next);
    // Slide along terrain instead of snapping to a grid route.
    if (!moved && next.x !== origin.x && next.y !== origin.y) {
      moved = this.moveAnchor(index, { x: next.x, y: origin.y }) || this.moveAnchor(index, { x: origin.x, y: next.y });
    }
    if (moved) { this.collectFood(); this.grow(); this.contacts(); }
    return moved;
  }
  private candidates(view: View, allowSnake: boolean): Point[] {
    const result: Point[] = [];
    for (let y = Math.ceil(view.y - view.height / 2 + 1); y <= Math.floor(view.y + view.height / 2 - 1); y++)
      for (let x = Math.ceil(view.x - view.width / 2 + 1); x <= Math.floor(view.x + view.width / 2 - 1); x++) {
        const p = { x: x + (this.random() - .5) * .5, y: y + (this.random() - .5) * .5 };
        if (!visible(p, view) || this.world.collides(p, .5)) continue;
        if ([...this.food.values()].some(f => length(f, p) < 1) || [...this.moles.values()].some(m => length(m.point, p) < 1)) continue;
        if (!allowSnake && this.body.some((b, i) => pointSegmentDistance(p, b, this.body[Math.max(0, i - 1)]) < .9)) continue;
        result.push(p);
      }
    return result;
  }
  spawnMole(view = this.view()) {
    const options = this.candidates(view, true);
    if (!options.length) return;
    const point = options[Math.floor(this.random() * options.length)];
    this.moles.set(key(point), { point, age: 0, emerged: false });
  }
  replenishFood(view = this.view()) {
    const count = [...this.food.values()].filter(p => visible(p, view)).length;
    if (count >= 3) return;
    const options = this.candidates(view, false);
    for (let n = count; n < 3 && options.length; n++) {
      const [p] = options.splice(Math.floor(this.random() * options.length), 1); this.food.set(key(p), p);
    }
  }
}
