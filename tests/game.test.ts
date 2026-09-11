import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game';
import { nearestSegment, pullContinuous, SNAKE_RADIUS } from '../src/drag';
import { length, pointSegmentDistance, segmentDistance } from '../src/geometry';
import { key, visible, World, type Point } from '../src/world';

function running() { const g = new Game(1729, () => .4); g.started = true; g.paused = false; g.world.blocked = () => false; g.setMouseTarget({ x: 10, y: 0 }); return g; }
function stationary() { const g = running(); g.speed = 0; g.spawnClock = -1000; return g; }
function advance(g: Game, seconds: number) { for (let i = 0; i < Math.round(seconds * 120); i++) g.update(1 / 120); }
function near(a: number, b: number, tolerance = 1e-6) { assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`); }
function connected(body: Point[]) { for (let i = 1; i < body.length; i++) near(length(body[i - 1], body[i]), 1); }

test('movement is continuous even before the old quarter-second step', () => {
  const game = running(); game.update(.025);
  near(game.body[0].x, .1); near(game.body[0].y, 0);
  game.update(.025); near(game.body[0].x, .2); connected(game.body);
});

test('mouse movement supports diagonal targets at a consistent speed', () => {
  const game = running(); game.setMouseTarget({ x: 6.37, y: 5.23 });
  const old = { ...game.body[0] }; game.update(1 / 120);
  assert.ok(game.body[0].x > 0 && game.body[0].y > 0);
  near(length(old, game.body[0]), 4 / 120); connected(game.body);
});

test('mouse control can turn back through the body without damage', () => {
  const game = running(); game.setMouseTarget({ x: -5, y: 0 });
  advance(game, .4); assert.ok(game.body[0].x < -1); assert.equal(game.hp, 10); connected(game.body);
});

test('a stationary cursor stays anchored to the viewport as it scrolls', () => {
  const game = running(); game.setMouseTarget({ x: .1, y: .2 });
  advance(game, 1); near(game.body[0].x - game.camera.x, .1); near(game.body[0].y, .2);
});

test('body dragging takes priority over the mouse-follow destination', () => {
  const game = running(); game.setMouseTarget({ x: 10, y: 0 });
  game.beginDrag(9); game.setDragTarget({ x: -9, y: 3 }); advance(game, .3);
  assert.ok(game.body[0].x < 0); connected(game.body);
});

test('food collects on fractional middle-body contacts and grows immediately', () => {
  const game = stationary(); game.food.set('snack', { x: -4.37, y: .3 });
  game.update(1 / 120);
  assert.equal(game.food.has('snack'), false); assert.equal(game.body.length, 11); connected(game.body);
});

test('food collects between body points and multiple pickups count only once', () => {
  const game = stationary(); game.food.set('a', { x: -2.5, y: .1 }); game.food.set('b', { x: -6.5, y: -.2 });
  advance(game, .1); assert.equal(game.body.length, 12); assert.equal(game.pendingGrowth, 0); connected(game.body);
});

test('fractional drag targets are preserved and reached without snapping', () => {
  const game = stationary(); assert.equal(game.beginDrag(0), true);
  game.setDragTarget({ x: 2.37, y: 1.63 }); advance(game, .4);
  near(game.body[0].x, 2.37); near(game.body[0].y, 1.63);
  assert.deepEqual(game.dragState!.target, { x: 2.37, y: 1.63 }); connected(game.body);
});

test('long tail pulling moves the head and maintains the continuous chain', () => {
  const game = stationary(); game.beginDrag(9); game.setDragTarget({ x: -9, y: 6.5 });
  advance(game, .6); near(game.body[9].y, 6.5);
  assert.ok(length(game.body[0], { x: 0, y: 0 }) > 1); connected(game.body);
  assert.equal(game.hp, 10);
});

test('continuous pulling supports a very long offscreen body', () => {
  let body = Array.from({ length: 150 }, (_, i) => ({ x: 0 - i, y: 0 }));
  for (let i = 1; i <= 50; i++) body = pullContinuous(body, 8, { x: -8 + i * .035, y: i * .08 });
  assert.equal(body.length, 150); connected(body); assert.ok(body.at(-1)!.x < -100);
});

test('dragging over food collects with the tail', () => {
  const game = stationary(); game.food.set('tail-food', { x: -9, y: 1.37 });
  game.beginDrag(9); game.setDragTarget({ x: -9, y: 2 }); advance(game, .2);
  assert.equal(game.food.has('tail-food'), false); assert.equal(game.body.length, 11); connected(game.body);
});

test('terrain uses circle geometry and swept checks instead of rounded cells', () => {
  const world = new World(); world.blocked = p => p.x === 1 && p.y === 0;
  assert.equal(world.collides({ x: .2, y: 0 }, SNAKE_RADIUS), false);
  assert.equal(world.collides({ x: .4, y: 0 }, SNAKE_RADIUS), true);
  assert.equal(world.sweptCollision({ x: -1, y: 0 }, { x: 3, y: 0 }, SNAKE_RADIUS), true);
  assert.equal(world.sweptCollision({ x: -1, y: 1 }, { x: 3, y: 1 }, SNAKE_RADIUS), false);
});

test('continuous movement stops at terrain and can steer away', () => {
  const game = running(); game.world.blocked = p => p.x === 1 && p.y === 0;
  advance(game, .3); assert.ok(game.body[0].x < .3); assert.equal(game.hp, 9);
  game.setMouseTarget({ x: game.body[0].x, y: -5 }); advance(game, .5);
  assert.ok(game.body[0].y < -.5); connected(game.body);
});

test('fast head pulls cannot tunnel through a rock', () => {
  const game = stationary(); game.world.blocked = p => p.x === 1 && p.y === 0;
  game.beginDrag(0); game.setDragTarget({ x: 4.5, y: 0 }); advance(game, .6);
  assert.ok(game.body[0].x < .3); assert.equal(game.dragState!.valid, false); connected(game.body);
});

test('a tail touching a wall does not freeze head movement', () => {
  const game = stationary();
  game.world.blocked = p => p.x === -9 && p.y === 0;
  game.beginDrag(0); game.setDragTarget({ x: 1.5, y: 2.5 });
  advance(game, .3);
  assert.ok(game.body[0].x > .5 && game.body[0].y > .5);
  assert.equal(game.hp, 9); // The tail is still a real collision, just not an anchor.
  assert.equal(game.dead, false); connected(game.body);
});

test('three-second mole warnings remain harmless until emergence', () => {
  const game = stationary(); game.moles.set('m', { point: { x: .25, y: .2 }, age: 0, emerged: false });
  advance(game, 2.9); assert.equal(game.hp, 10);
  advance(game, .1); assert.equal(game.moles.get('m')!.emerged, true); assert.equal(game.hp, 9);
  advance(game, 1.05); assert.equal(game.hp, 8);
});

test('moles contact the continuous body between its points', () => {
  const game = stationary(); game.moles.set('m', { point: { x: -3.5, y: .25 }, age: 3, emerged: true });
  game.contacts(); assert.equal(game.hp, 9); game.contacts(); assert.equal(game.hp, 9);
});

test('a free sideways tail pull rescues it before a mole emerges', () => {
  const game = stationary(); game.moles.set('m', { point: { x: -9, y: 0 }, age: 2.5, emerged: false });
  game.beginDrag(9); game.setDragTarget({ x: -8.6, y: 4.3 }); advance(game, .55);
  assert.equal(game.hp, 10); connected(game.body);
});

test('offscreen warnings cancel and offscreen emerged moles remain harmless', () => {
  const game = stationary(); game.moles.set('warning', { point: { x: -20, y: 0 }, age: 2.9, emerged: false });
  game.moles.set('solid', { point: { x: -30, y: 0 }, age: 3, emerged: true });
  game.body = Array.from({ length: 40 }, (_, i) => ({ x: 0 - i, y: 0 }));
  game.update(1 / 120); assert.equal(game.moles.has('warning'), false); assert.equal(game.moles.has('solid'), true); assert.equal(game.hp, 10);
});

test('crossing body links causes no self-damage', () => {
  const game = stationary();
  game.body = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: -1 }, { x: 0, y: 1 }];
  game.contacts(); assert.equal(game.hp, 10);
  near(segmentDistance({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }), 0);
  near(pointSegmentDistance({ x: .5, y: .2 }, { x: 0, y: 0 }, { x: 1, y: 0 }), .2);
});

test('camera scrolls right independently and does not change a held destination', () => {
  const game = stationary(); game.beginDrag(0); game.setDragTarget({ x: 1.3, y: 2.7 });
  advance(game, 1); near(game.camera.x, 2); near(game.camera.y, 0);
  assert.deepEqual(game.dragState!.target, { x: 1.3, y: 2.7 });
  const body = structuredClone(game.body); advance(game, .25); assert.deepEqual(game.body, body);
});

test('pausing freezes the camera, movement, and mole timers; death ends dragging', () => {
  const game = running(); game.beginDrag(0); game.paused = true; game.update(3);
  assert.equal(game.elapsed, 0); assert.equal(game.camera.x, 0);
  game.paused = false; game.hp = 1; game.damage(); assert.equal(game.dead, true); assert.equal(game.dragState, null);
  game.update(3); assert.equal(game.elapsed, 0);
});

test('a forgiving grab finds continuous body positions', () => {
  const game = stationary(); game.body[2] = { x: -2.37, y: .2 };
  assert.equal(nearestSegment(game.body, { x: -2.37, y: .85 }, game.view()), 2);
  assert.equal(nearestSegment(game.body, { x: 3, y: 3 }, game.view()), -1);
});

test('moles spawn frequently at fractional visible positions and retain their warning', () => {
  const game = stationary(); game.spawnClock = 0; advance(game, 3);
  assert.equal(game.moles.size, 3);
  for (const m of game.moles.values()) { assert.ok(visible(m.point, game.view())); assert.equal(m.emerged, false); assert.ok(!Number.isInteger(m.point.x)); }
  game.elapsed = 75; assert.equal(game.interval, .5);
});

test('terrain stays deterministic and dense with connected open lanes', () => {
  const a = new World(), b = new World(); let count = 0;
  for (let y = -32; y < 32; y++) for (let x = 32; x < 96; x++) {
    assert.equal(a.blocked({ x, y }), b.blocked({ x, y }));
    if (a.blocked({ x, y })) count++;
    if (x % 8 === 0 || y % 8 === 0) assert.equal(a.blocked({ x, y }), false);
  }
  assert.ok(count >= 300);
});

test('new runs reset health, growth, hazards, camera, and dragging', () => {
  const game = new Game(); assert.equal(game.hp, 10); assert.equal(game.body.length, 10);
  assert.equal(game.pendingGrowth, 0); assert.equal(game.moles.size, 0); assert.equal(game.camera.x, 0); assert.equal(game.dragState, null);
});
