import { test, expect } from '@playwright/test';

test('head dragging and mouse-only steering work without grid snapping', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.clock.install(); await page.locator('#play').click();
  await page.clock.runFor(100);
  const box = (await page.locator('#field').boundingBox())!;
  await page.mouse.move(box.x + box.width * 12.2 / 24, box.y + box.height * 9 / 18);
  await page.mouse.down(); await expect(page.locator('#field')).toHaveClass('dragging');
  await page.mouse.move(box.x + box.width * 15.37 / 24, box.y + box.height * 10.63 / 18);
  await page.clock.runFor(450);
  await page.screenshot({ path: 'test-results/free-movement.png', fullPage: true });
  await page.mouse.up();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .4);
  await page.clock.runFor(250);
  await expect(page.locator('#overlay')).toHaveClass('hidden');
  expect(errors).toEqual([]);
});

test('tail dragging keeps the camera on its independent eastbound course', async ({ page }) => {
  await page.goto('/');
  await page.clock.install();
  await page.locator('#play').click();
  await page.clock.runFor(100);
  const box = (await page.locator('#field').boundingBox())!;
  // Grab just beside the tail, rather than exactly on its center.
  await page.mouse.move(box.x + box.width * 3 / 24, box.y + box.height * 9.6 / 18);
  await page.mouse.down();
  await expect(page.locator('#field')).toHaveClass('dragging');
  await page.mouse.move(box.x + box.width * 3 / 24, box.y + box.height * 16 / 18);
  await page.clock.runFor(900);
  const coordinates = (await page.locator('#coordinates').textContent())!.split(':').map(Number);
  expect(coordinates[0]).toBeGreaterThanOrEqual(2);
  expect(coordinates[1]).toBe(0);
  await expect(page.locator('#field')).toHaveClass('dragging');
  await page.screenshot({ path: 'test-results/long-drag.png', fullPage: true });
  await page.mouse.up();
  await expect(page.locator('#field')).not.toHaveClass('dragging');
  await page.keyboard.press('p');
  const stopped = await page.locator('#coordinates').textContent();
  await page.clock.runFor(1000);
  await expect(page.locator('#coordinates')).toHaveText(stopped!);
});

test('start, steer, drag, pause on focus loss, and resume', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#overlay-title')).toContainText('Small snake.');
  await page.screenshot({ path: 'test-results/welcome.png', fullPage: true });
  await page.clock.install();
  await page.locator('#play').click();
  await page.clock.runFor(300);
  await expect(page.locator('#overlay')).toHaveClass('hidden');
  const box = (await page.locator('#field').boundingBox())!;
  await page.mouse.move(box.x + box.width * 9 / 24, box.y + box.height * 9 / 18);
  await page.mouse.down();
  await expect(page.locator('#field')).toHaveClass('dragging');
  await page.mouse.move(box.x + box.width * 10 / 24, box.y + box.height * 10 / 18, { steps: 4 });
  await page.clock.runFor(100);
  await page.mouse.up();
  await expect(page.locator('#field')).not.toHaveClass('dragging');
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .65);
  await page.clock.runFor(500);
  await expect(page.locator('#coordinates')).not.toHaveText('0 : 0');
  await page.keyboard.press('p');
  await expect(page.locator('#overlay-title')).toHaveText('Taking a breather.');
  const score = await page.locator('#score').textContent();
  await page.clock.runFor(2000);
  await expect(page.locator('#score')).toHaveText(score!);
  await page.locator('#play').click();
  await page.clock.runFor(500);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#overlay-title')).toHaveText('Taking a breather.');
  await page.locator('#play').click();
  await page.clock.runFor(3500);
  await page.screenshot({ path: 'test-results/playing.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('long tail, growing, free body dragging, and rendering work in a real browser', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const gameModule = '/src/game.ts', renderModule = '/src/render.ts';
    const { Game } = await import(gameModule);
    const { Renderer } = await import(renderModule);
    const game = new Game();
    game.world.blocked = () => false;
    game.paused = false;
    game.body = Array.from({ length: 150 }, (_, i) => ({ x: 0 - i, y: 0 }));
    game.food.set('1,0', { x: 1, y: 0 });
    game.setMouseTarget({ x: 10, y: 0 });
    game.update(.25);
    const length = game.body.length;
    const p = { ...game.body[4] };
    game.moles.set(`${p.x},${p.y}`, { point: p, age: 0, emerged: false });
    game.speed = 0;
    const rescued = game.beginDrag(4);
    game.setDragTarget({ x: p.x + .37, y: 1.63 });
    game.update(.5);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:960px;height:720px;z-index:100';
    document.body.append(canvas);
    new Renderer(canvas).draw(game, null, 0);
    return { length, rescued, hp: game.hp, tailX: game.body.at(-1).x };
  });
  expect(result.length).toBe(151);
  expect(result.rescued).toBe(true);
  expect(result.hp).toBe(10);
  expect(result.tailX).toBeLessThan(-100);
  await page.screenshot({ path: 'test-results/long-tail.png' });
});

test('game over, restart, and best score persist', async ({ page }) => {
  await page.goto('/');
  await page.clock.install();
  await page.locator('#player-name').fill('ACE');
  await page.locator('#player-name').dispatchEvent('change');
  await page.locator('#play').click();
  // With no mouse input, the scrolling course eventually leaves the head behind.
  await page.clock.runFor(18000);
  await expect(page.locator('#hp')).toHaveText('0');
  await expect(page.locator('#overlay-title')).toHaveText('A good little run.');
  await expect(page.locator('#leaderboard li').first()).toContainText('ACE');
  const best = await page.locator('#best').textContent();
  expect(best).not.toBe('00:00');
  await page.locator('#play').click();
  await page.clock.runFor(100);
  await expect(page.locator('#hp')).toHaveText('10');
  await expect(page.locator('#length')).toContainText('10');
  await page.reload();
  await expect(page.locator('#best')).toHaveText(best!);
  await expect(page.locator('#leaderboard li').first()).toContainText('ACE');
});

test('the visible restart button resets an active run immediately', async ({ page }) => {
  await page.goto('/');
  await page.clock.install();
  await page.locator('#play').click();
  await page.clock.runFor(1200);
  await expect(page.locator('#score')).not.toHaveText('00:00');
  await page.locator('#restart').click();
  await expect(page.locator('#hp')).toHaveText('10');
  await expect(page.locator('#length')).toContainText('10');
  await expect(page.locator('#score')).toHaveText('00:00');
  await expect(page.locator('#overlay')).toHaveClass('hidden');
});
