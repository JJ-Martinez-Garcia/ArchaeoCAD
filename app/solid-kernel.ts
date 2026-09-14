import type { Point, Primitive } from "./cad-core";
import { triangulate } from "./external-vector-tools";

export type Face3D = { points: [number, number, number][]; kind: "top" | "side" };

/** Lightweight, dependency-free extrusion preview for PWA/offline use. */
export function extrudePrimitive(entity: Primitive, height = 1): Face3D[] {
  if (entity.type !== "polyline" || !entity.points || entity.points.length < 3) return [];
  const points = entity.points;
  const indices = triangulate(points);
  const top: [number, number, number][] = [];
  for (let i = 0; i < indices.length; i += 3) {
    top.push(...indices.slice(i, i + 3).map((index) => [points[index].x, points[index].y, height] as [number, number, number]));
  }
  const faces: Face3D[] = [{ points: top, kind: "top" }];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]; const b = points[i + 1];
    faces.push({ points: [[a.x, a.y, 0], [b.x, b.y, 0], [b.x, b.y, height], [a.x, a.y, height]], kind: "side" });
  }
  return faces;
}

export function projectIsometric(point: [number, number, number], scale = 1) {
  const [x, y, z] = point;
  return { x: (x - y) * 0.82 * scale, y: (x + y) * 0.42 * scale - z * scale };
}
