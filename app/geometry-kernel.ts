/** Pure 2D geometry helpers shared by the editor, snap tools and exporters.
 *
 * The kernel deliberately has no DOM dependency so it can run in a Web Worker
 * on mobile and can later be compiled to WebAssembly without changing the UI.
 */
export type Vec2 = { x: number; y: number };
export type EntityKind = "point" | "line" | "polyline" | "polygon" | "rectangle" | "circle" | "arc" | "spline" | "text";
export type CadEntity = {
  id: string;
  kind: EntityKind;
  layer: string;
  points?: Vec2[];
  center?: Vec2;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  closed?: boolean;
  text?: string;
};

export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function translate(entity: CadEntity, delta: Vec2): CadEntity {
  return { ...entity, points: entity.points?.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })), center: entity.center && { x: entity.center.x + delta.x, y: entity.center.y + delta.y } };
}

export function rotate(entity: CadEntity, origin: Vec2, angle: number): CadEntity {
  const c = Math.cos(angle), s = Math.sin(angle);
  const turn = (p: Vec2): Vec2 => ({ x: origin.x + (p.x - origin.x) * c - (p.y - origin.y) * s, y: origin.y + (p.x - origin.x) * s + (p.y - origin.y) * c });
  return { ...entity, points: entity.points?.map(turn), center: entity.center && turn(entity.center), startAngle: entity.startAngle == null ? entity.startAngle : entity.startAngle + angle, endAngle: entity.endAngle == null ? entity.endAngle : entity.endAngle + angle };
}

export function scale(entity: CadEntity, origin: Vec2, factor: number): CadEntity {
  const resize = (p: Vec2): Vec2 => ({ x: origin.x + (p.x - origin.x) * factor, y: origin.y + (p.y - origin.y) * factor });
  return { ...entity, points: entity.points?.map(resize), center: entity.center && resize(entity.center), radius: entity.radius == null ? entity.radius : Math.abs(entity.radius * factor) };
}

export function mirror(entity: CadEntity, a: Vec2, b: Vec2): CadEntity {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy || 1;
  const reflect = (p: Vec2): Vec2 => { const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2; const q = { x: a.x + t * dx, y: a.y + t * dy }; return { x: 2 * q.x - p.x, y: 2 * q.y - p.y }; };
  return { ...entity, points: entity.points?.map(reflect), center: entity.center && reflect(entity.center), startAngle: entity.startAngle == null ? entity.startAngle : Math.atan2(-Math.sin(entity.startAngle), Math.cos(entity.startAngle)), endAngle: entity.endAngle == null ? entity.endAngle : Math.atan2(-Math.sin(entity.endAngle), Math.cos(entity.endAngle)) };
}

export function nearestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
  if (!d2) return a;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d2));
  return lerp(a, b, t);
}

export function offsetPolyline(points: Vec2[], amount: number, closed = false): Vec2[] {
  if (points.length < 2 || !amount) return points.map((p) => ({ ...p }));
  const result: Vec2[] = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length], next = points[(i + 1) % points.length];
    if (!closed && i === 0) { result.push(offsetVertex(points[i], points[i], next, amount)); continue; }
    if (!closed && i === points.length - 1) { result.push(offsetVertex(points[i], prev, points[i], amount)); continue; }
    result.push(offsetVertex(points[i], prev, next, amount));
  }
  return result.slice(0, closed ? count : points.length);
}

function offsetVertex(p: Vec2, a: Vec2, b: Vec2, amount: number): Vec2 {
  const ax = p.x - a.x, ay = p.y - a.y, bx = b.x - p.x, by = b.y - p.y;
  const al = Math.hypot(ax, ay) || 1, bl = Math.hypot(bx, by) || 1;
  const nx = (-ay / al - by / bl) / 2, ny = (ax / al + bx / bl) / 2, nl = Math.hypot(nx, ny) || 1;
  return { x: p.x + (nx / nl) * amount, y: p.y + (ny / nl) * amount };
}

export function snapPoint(point: Vec2, candidates: Vec2[], tolerance: number): Vec2 | null {
  let best: Vec2 | null = null, bestDistance = tolerance;
  for (const candidate of candidates) { const d = distance(point, candidate); if (d <= bestDistance) { best = candidate; bestDistance = d; } }
  return best;
}
