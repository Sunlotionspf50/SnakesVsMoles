import { Game, type DragState } from './game';
import { type Point } from './world';
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  constructor(public canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }
  pointer(event: PointerEvent, game: Game): Point {
    const r = this.canvas.getBoundingClientRect(), camera = game.camera;
    return { x: (event.clientX - r.left) / r.width * 24 - 12 + camera.x,
      y: (event.clientY - r.top) / r.height * 18 - 9 + camera.y };
  }
  draw(game: Game, drag: DragState | null, time: number) {
    const c = this.ctx, rect = this.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    c.setTransform(w / 24, 0, 0, h / 18, 0, 0);
    c.fillStyle = '#192f26'; c.fillRect(0, 0, 24, 18);
    const camera = game.camera;
    c.translate(12 - camera.x, 9 - camera.y);
    const left = Math.floor(camera.x - 13), top = Math.floor(camera.y - 10);
    for (let y = top; y < top + 21; y++) for (let x = left; x < left + 27; x++) {
      if (((x * 13 + y * 7) % 19 + 19) % 19 === 0) {
        c.strokeStyle = '#49604455'; c.lineWidth = .025;
        c.beginPath(); c.moveTo(x - .2, y + .15); c.lineTo(x - .24, y); c.moveTo(x - .2, y + .15); c.lineTo(x - .12, y + .02); c.stroke();
      }
      if (game.world.blocked({ x, y })) {
        c.fillStyle = '#101e19'; this.round(x - .43, y - .28, .86, .78, .17);
        c.fillStyle = '#64736b'; this.round(x - .43, y - .43, .86, .73, .17);
        c.fillStyle = '#849088'; this.round(x - .32, y - .35, .58, .16, .07);
        c.strokeStyle = '#46544d'; c.lineWidth = .04; c.beginPath(); c.moveTo(x + .1, y - .1); c.lineTo(x - .08, y + .08); c.lineTo(x, y + .25); c.stroke();
      }
    }
    for (const p of game.food.values()) {
      if (Math.abs(p.x - camera.x) > 13 || Math.abs(p.y - camera.y) > 10) continue;
      c.fillStyle = '#efb66b18'; this.circle(p.x, p.y, .52 + Math.sin(time * 3) * .05);
      c.fillStyle = '#b15c47'; this.circle(p.x, p.y + .08, .25);
      c.fillStyle = '#f3ae78'; this.circle(p.x - .04, p.y - .015, .23);
      c.fillStyle = '#fff0bd'; this.circle(p.x - .1, p.y - .09, .055);
      c.strokeStyle = '#b7d780'; c.lineWidth = .075; c.beginPath(); c.moveTo(p.x, p.y - .2); c.quadraticCurveTo(p.x + .05, p.y - .4, p.x + .23, p.y - .3); c.stroke();
    }
    for (const mole of game.moles.values()) {
      const { x, y } = mole.point;
      if (Math.abs(x - camera.x) > 13 || Math.abs(y - camera.y) > 10) continue;
      c.save();
      if (!mole.emerged) {
        c.globalAlpha = .5 + Math.sin(mole.age * 12) * .22;
        c.fillStyle = '#eebd6733'; this.circle(x, y, .47);
        c.strokeStyle = '#f3c476'; c.lineWidth = .055; c.setLineDash([.07, .065]); this.circle(x, y, .43, true); c.setLineDash([]);
        c.fillStyle = '#b8a183'; this.circle(x, y + .06, .22);
        c.globalAlpha = 1; c.fillStyle = '#ffe2a6'; c.font = 'bold .3px monospace'; c.textAlign = 'center';
        c.fillText(String(Math.max(1, Math.ceil(3 - mole.age))), x, y + .12);
      } else {
        c.fillStyle = '#101d17'; c.beginPath(); c.ellipse(x, y + .15, .46, .28, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#7b5946'; this.circle(x, y, .33);
        c.fillStyle = '#98745a'; this.circle(x - .04, y - .07, .26);
        c.fillStyle = '#c19b7a'; this.circle(x - .28, y + .21, .1); this.circle(x + .28, y + .21, .1);
        c.fillStyle = '#211f1c'; this.circle(x - .12, y - .07, .045); this.circle(x + .12, y - .07, .045);
        c.fillStyle = '#e4a99a'; this.circle(x, y + .08, .075);
      }
      c.restore();
    }
    const points = game.renderedBody;
    c.save();
    if (game.immunity > 0) c.globalAlpha = Math.sin(game.immunity * 30) > 0 ? .4 : 1;
    c.lineJoin = 'round'; c.lineCap = 'round';
    const path = (offset: number) => {
      c.beginPath(); c.moveTo(points[0].x, points[0].y + offset);
      for (let i = 1; i < points.length - 1; i++) {
        const p = points[i], next = points[i + 1];
        c.quadraticCurveTo(p.x, p.y + offset, (p.x + next.x) / 2, (p.y + next.y) / 2 + offset);
      }
      c.lineTo(points.at(-1)!.x, points.at(-1)!.y + offset); c.stroke();
    };
    c.strokeStyle = '#0c1c15'; c.lineWidth = .67; path(.12);
    c.strokeStyle = '#8ebd65'; c.lineWidth = .57; path(0);
    for (let i = points.length - 1; i >= 1; i--) {
      const p = points[i];
      if (Math.abs(p.x - camera.x) > 13 || Math.abs(p.y - camera.y) > 10) continue;
      c.fillStyle = i % 2 ? '#a2ca76' : '#b0d483'; this.circle(p.x, p.y - .045, .09);
    }
    const head = points[0], dir = game.direction;
    c.save(); c.translate(head.x, head.y); c.rotate(Math.atan2(dir.y, dir.x));
    c.fillStyle = '#c4e897'; this.round(-.35, -.33, .77, .66, .25);
    c.fillStyle = '#203e2b'; this.circle(.15, -.2, .065); this.circle(.15, .2, .065);
    c.fillStyle = '#eef6d6'; this.circle(.17, -.22, .021); this.circle(.17, .18, .021);
    c.restore(); c.restore();
    if (drag) {
      c.strokeStyle = drag.valid ? '#e2f4ae' : '#f2a28d'; c.lineWidth = .05;
      c.setLineDash([.1, .06]); this.circle(drag.target.x, drag.target.y, .35, true); c.setLineDash([]);
      const p = points[drag.index]; if (p) {
        c.globalAlpha = .45; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(drag.target.x, drag.target.y); c.stroke(); c.globalAlpha = 1;
        c.strokeStyle = '#eff7d0'; this.circle(p.x, p.y, .4, true);
      }
    }
  }
  private circle(x: number, y: number, r: number, stroke = false) {
    this.ctx.beginPath(); this.ctx.arc(x, y, r, 0, Math.PI * 2); stroke ? this.ctx.stroke() : this.ctx.fill();
  }
  private round(x: number, y: number, w: number, h: number, r: number) {
    this.ctx.beginPath(); this.ctx.roundRect(x, y, w, h, r); this.ctx.fill();
  }
}
