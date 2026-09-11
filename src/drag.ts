import { visible, type Point, type View } from './world';
import { length } from './geometry';

export const SEGMENT_SPACING = 1;
export const SNAKE_RADIUS = .285;

/** Continuous rope: the grabbed point leads and connected points follow at fixed spacing. */
export function pullContinuous(body: Point[], selected: number, target: Point): Point[] {
  const result = body.map(p => ({ ...p }));
  result[selected] = { ...target };
  for (const sign of [-1, 1]) {
    for (let i = selected + sign; i >= 0 && i < body.length; i += sign) {
      const leader = result[i - sign], old = body[i];
      let dx = old.x - leader.x, dy = old.y - leader.y, size = Math.hypot(dx, dy);
      if (size < 1e-9) {
        dx = old.x - body[i - sign].x; dy = old.y - body[i - sign].y; size = Math.hypot(dx, dy) || 1;
      }
      result[i] = { x: leader.x + dx / size * SEGMENT_SPACING, y: leader.y + dy / size * SEGMENT_SPACING };
    }
  }
  return result;
}

export function nearestSegment(points: Point[], pointer: Point, view: View): number {
  let selected = -1, closest = .75;
  for (let i = 0; i < points.length; i++) {
    const d = length(points[i], pointer);
    if (visible(points[i], view) && d <= closest) { selected = i; closest = d; }
  }
  return selected;
}
