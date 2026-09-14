import paper from "paper";
import { getStroke, type StrokeOptions } from "perfect-freehand";
import earcut from "earcut";
import { point, polygon } from "@flatten-js/core";
import { unify } from "@flatten-js/boolean-op";
import opentype from "opentype.js";
import type { Point } from "./cad-core";

/** Paper.js curve fitting, kept behind a tiny adapter so the CAD model stays plain JSON. */
export function smoothWithPaper(points: Point[], tolerance = 0.6): Point[] {
  if (points.length < 4) return points;
  const path = new paper.Path({ insert: false, segments: points.map((p) => new paper.Point(p.x, p.y)) });
  path.simplify(tolerance);
  const result = path.segments.map((segment) => ({ x: segment.point.x, y: segment.point.y }));
  path.remove();
  return result.length >= 2 ? result : points;
}

/** Pressure-sensitive outline for field sketches; points are returned as a closed polygon. */
export function freehandOutline(points: Point[], options?: StrokeOptions): Point[] {
  if (points.length < 2) return points;
  return getStroke(points.map((p) => [p.x, p.y, 0.5] as [number, number, number]), options).map(([x, y]) => ({ x, y }));
}

/** Robust polygon union/normalisation using flatten-js; returns the largest resulting face. */
export function unionPolygons(polygons: Point[][]): Point[][] {
  if (polygons.length < 2) return polygons;
  const shapes = polygons.map((ring) => polygon(ring.map((p) => point(p.x, p.y))));
  const merged = shapes.slice(1).reduce((acc, shape) => unify(acc, shape), shapes[0]);
  return merged.faces.map((face) => face.e.segments.map((segment) => ({ x: segment.start.x, y: segment.start.y })));
}

/** Earcut triangulation for the 3D preview and future mesh export. */
export function triangulate(points: Point[]): number[] {
  const flat = points.flatMap((p) => [p.x, p.y]);
  return earcut(flat);
}

/** Convert a loaded OpenType font and text to SVG path data for outline export. */
export function textOutline(fontData: ArrayBuffer, text: string, size: number) {
  const font = opentype.parse(fontData);
  return font.getPath(text, 0, size, size).toPathData({ flipY: true });
}
