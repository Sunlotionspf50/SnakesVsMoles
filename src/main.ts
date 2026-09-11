import './style.css';
import { Game } from './game';
import { Renderer } from './render';
import { nearestSegment } from './drag';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="shell">
    <header><a class="brand" href="./" aria-label="Snakes vs. Moles home"><span class="brand-icon">s<span>•</span></span><span>SNAKES <i>vs.</i> MOLES<small>A LITTLE WILD. A LITTLE DANGEROUS.</small></span></a><span class="build"><span></span> FIELD TEST / 001</span></header>
    <section class="heading"><div><div class="eyebrow">THE EASTBOUND MEADOW</div><h1>Watch your tail.</h1><p>The field keeps moving. Find a gap, grab a snack, and keep up.</p></div><div class="heading-actions"><button id="restart" class="secondary">↻ <span>Restart</span></button><button id="pause" class="secondary" disabled>Ⅱ <span>Pause</span> <kbd>P</kbd></button></div></section>
    <section class="game-layout">
      <div class="field-wrap">
        <div class="field-bar"><span><span class="live-dot"></span> <span id="status">READY TO ROLL</span></span><span id="coordinates">00 : 00</span></div>
        <div class="canvas-wrap"><canvas id="field" aria-label="Top-down snake game. Move the mouse to guide the head. Click and drag any body segment."></canvas>
          <div id="overlay"><div class="overlay-card"><div class="eyebrow" id="overlay-tag">WELCOME TO THE MEADOW</div><h2 id="overlay-title">Small snake.<br>Big adventure.</h2><p id="overlay-copy">Eat, explore, and keep moving. When the ground starts blinking, get your tail out of the way.</p><button id="play" class="primary">Let's roam <span>↗</span></button><small id="overlay-hint">MOUSE CONTROL · SOUNDLESS BY NATURE</small></div></div>
        </div>
        <div class="field-footer"><span><span class="legend snake-dot"></span> YOU <span class="legend food-dot"></span> FOOD <span class="legend mole-dot"></span> MOLE</span><span>INFINITE GROUND. FINITE HEALTH.</span></div>
      </div>
      <aside>
        <section class="panel health-panel"><div class="label">KEEP YOUR HEART IN IT <span>♡</span></div><div class="health-number"><strong id="hp">10</strong><span>/ 10 HP</span></div><div id="health-bars"></div><p>Every collision costs one.<br>Make your next move count.</p></section>
        <section class="panel stats"><div><span class="label">SURVIVED</span><strong id="score">00:00</strong></div><div><span class="label">LENGTH</span><strong id="length">10 <small>segments</small></strong></div><div class="best"><span>PERSONAL BEST</span><span id="best">00:00</span></div></section>
        <section class="guide"><div class="eyebrow">A FIELD GUIDE</div><div class="instruction"><span class="instruction-icon">↗</span><div><strong>Lead the way</strong><p>Move your mouse to choose a heading. The snake keeps a constant pace.</p></div></div><div class="instruction"><span class="instruction-icon">⌁</span><div><strong>Save any segment</strong><p>Click and drag any part. Cross your own body safely; every part collects food.</p></div></div><div class="instruction"><span class="instruction-icon warning">3</span><div><strong>Three seconds. Move.</strong><p>Moles appear every second. Blinking ground gives you three seconds to move.</p></div></div><div class="tip">Keep your head in view as the field scrolls right. Your hidden tail follows its path without drifting.</div></section>
      </aside>
    </section>
    <footer><span>GROW A LITTLE. LAST A LITTLE LONGER.</span><span>Single player <b>·</b> An endless field experiment</span></footer>
  </main>`;

const el = (id: string) => document.getElementById(id)!;
const canvas = el('field') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
let game = new Game();
let best = 0, recorded = false;
try { best = Math.max(0, Number(localStorage.getItem('svm-best')) || 0); } catch { /* Storage is optional. */ }
const format = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
el('best').textContent = format(best);
game.replenishFood();
function release() { game.endDrag(); canvas.classList.remove('dragging'); }
function pause() { if (!game.started || game.dead) return; game.paused = !game.paused; release(); updateUI(); }
function restart() {
  release(); game = new Game(); game.replenishFood(); recorded = false;
  game.started = true; game.paused = false; accumulator = 0; updateUI();
}
function play() {
  if (game.dead) { game = new Game(); game.replenishFood(); recorded = false; }
  game.started = true; game.paused = false; accumulator = 0; updateUI();
}
el('play').addEventListener('click', play);
el('pause').addEventListener('click', pause);
el('restart').addEventListener('click', restart);
window.addEventListener('keydown', e => {
  if ((e.key.toLowerCase() === 'p' || e.key === 'Escape') && !e.repeat) { e.preventDefault(); pause(); }
});
window.addEventListener('blur', () => { if (game.started && !game.dead) { game.paused = true; release(); updateUI(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.started) { game.paused = true; release(); updateUI(); } });
canvas.addEventListener('pointerdown', e => {
  if (game.paused || game.dead || e.button !== 0) return;
  const target = renderer.pointer(e, game);
  const index = nearestSegment(game.renderedBody, target, game.view());
  if (!game.beginDrag(index)) { game.setMouseTarget(target); return; }
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', e => {
  if (game.paused || game.dead) return;
  const target = renderer.pointer(e, game);
  if (game.dragState) game.setDragTarget(target);
  else game.setMouseTarget(target);
});
canvas.addEventListener('pointerup', e => { release(); if (!game.paused && !game.dead) game.setMouseTarget(renderer.pointer(e, game)); });
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', release);
function updateUI() {
  el('hp').textContent = String(game.hp);
  el('health-bars').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < game.hp ? 'full' : ''}"></i>`).join('');
  el('score').textContent = format(game.elapsed);
  el('length').innerHTML = `${game.body.length} <small>segments</small>`;
  el('coordinates').textContent = `${Math.round(game.camera.x)} : ${Math.round(game.camera.y)}`;
  el('status').textContent = game.dead ? 'THE MEADOW WINS' : game.paused ? game.started ? 'TAKING A BREATHER' : 'READY TO ROLL' : 'SCROLLING EAST →';
  (el('pause') as HTMLButtonElement).disabled = !game.started || game.dead;
  (el('restart') as HTMLButtonElement).disabled = false;
  el('pause').innerHTML = game.paused ? '▷ <span>Resume</span> <kbd>P</kbd>' : 'Ⅱ <span>Pause</span> <kbd>P</kbd>';
  el('overlay').classList.toggle('hidden', !game.paused && !game.dead);
  if (game.dead) {
    release();
    if (!recorded) { best = Math.max(best, Math.floor(game.elapsed)); try { localStorage.setItem('svm-best', String(best)); } catch {} recorded = true; }
    el('best').textContent = format(best);
    el('overlay-tag').textContent = 'ONE MORE TRIP THROUGH THE FIELD?';
    el('overlay-title').textContent = 'A good little run.';
    el('overlay-copy').textContent = `You survived ${format(game.elapsed)} and grew to ${game.body.length} segments. The meadow has more in store.`;
    el('play').innerHTML = 'Try again <span>↗</span>';
    el('overlay-hint').textContent = `PERSONAL BEST · ${format(best)}`;
  } else if (game.started && game.paused) {
    el('overlay-tag').textContent = 'NO RUSH. THE MOLES CAN WAIT.';
    el('overlay-title').textContent = 'Taking a breather.';
    el('overlay-copy').textContent = 'Your snake and every mole timer are paused. Pick up right where you left off.';
    el('play').innerHTML = 'Keep roaming <span>↗</span>';
    el('overlay-hint').textContent = 'PRESS P OR CLICK TO RESUME';
  }
}
let last = performance.now(), accumulator = 0, uiClock = 0;
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, .1); last = now;
  accumulator += dt;
  while (accumulator >= 1 / 60) {
    game.update(1 / 60); accumulator -= 1 / 60;
    if (!game.dragState) canvas.classList.remove('dragging');
  }
  renderer.draw(game, game.dragState, game.elapsed);
  uiClock += dt; if (uiClock >= .1) { updateUI(); uiClock = 0; }
  requestAnimationFrame(frame);
}
updateUI(); requestAnimationFrame(frame);
