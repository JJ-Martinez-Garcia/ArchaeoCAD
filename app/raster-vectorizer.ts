import type { Drawing, Point, Primitive } from "./cad-core";

export type RasterOptions = {
  threshold: number;
  simplify: number;
  realWidth: number | null;
  unit: "m" | "cm" | "mm" | "unit";
};

const directions = [
  [-1, -1], [0, -1], [1, -1], [1, 0],
  [1, 1], [0, 1], [-1, 1], [-1, 0],
] as const;

function neighbours(data: Uint8Array, width: number, height: number, index: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  const result: number[] = [];
  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const next = ny * width + nx;
      if (data[next]) result.push(next);
    }
  }
  return result;
}

function transitions(values: number[]) {
  let count = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === 0 && values[(index + 1) % values.length] === 1) count += 1;
  }
  return count;
}

function thin(binary: Uint8Array, width: number, height: number) {
  const data = binary.slice();
  for (let iteration = 0; iteration < 48; iteration += 1) {
    let changed = false;
    for (let pass = 0; pass < 2; pass += 1) {
      const remove: number[] = [];
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = y * width + x;
          if (!data[index]) continue;
          const p2 = data[index - width];
          const p3 = data[index - width + 1];
          const p4 = data[index + 1];
          const p5 = data[index + width + 1];
          const p6 = data[index + width];
          const p7 = data[index + width - 1];
          const p8 = data[index - 1];
          const p9 = data[index - width - 1];
          const ring = [p2, p3, p4, p5, p6, p7, p8, p9];
          const count = ring.reduce((sum, value) => sum + value, 0);
          if (count < 2 || count > 6 || transitions(ring) !== 1) continue;
          const firstCondition = pass === 0 ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0 : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0;
          if (firstCondition) remove.push(index);
        }
      }
      if (remove.length) changed = true;
      remove.forEach((index) => { data[index] = 0; });
    }
    if (!changed) break;
  }
  return data;
}

function clean(binary: Uint8Array, width: number, height: number) {
  const output = binary.slice();
  for (let pass = 0; pass < 2; pass += 1) {
    const remove: number[] = [];
    for (let index = 0; index < output.length; index += 1) {
      if (output[index] && neighbours(output, width, height, index).length <= 1) remove.push(index);
    }
    remove.forEach((index) => { output[index] = 0; });
  }
  return output;
}

function edgeKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function tracePaths(data: Uint8Array, width: number, height: number) {
  const visited = new Set<string>();
  const paths: number[][] = [];
  const active: number[] = [];
  for (let index = 0; index < data.length; index += 1) if (data[index]) active.push(index);
  const starts = active.filter((index) => neighbours(data, width, height, index).length !== 2);

  function follow(start: number, first: number) {
    const path = [start, first];
    visited.add(edgeKey(start, first));
    let previous = start;
    let current = first;
    for (let guard = 0; guard < data.length; guard += 1) {
      const nextOptions = neighbours(data, width, height, current).filter((next) => next !== previous && !visited.has(edgeKey(current, next)));
      if (!nextOptions.length || (current !== first && neighbours(data, width, height, current).length !== 2)) break;
      const next = nextOptions[0];
      visited.add(edgeKey(current, next));
      path.push(next);
      previous = current;
      current = next;
      if (current === start) break;
    }
    if (path.length >= 4) paths.push(path);
  }

  starts.forEach((start) => neighbours(data, width, height, start).forEach((next) => {
    if (!visited.has(edgeKey(start, next))) follow(start, next);
  }));
  active.forEach((start) => neighbours(data, width, height, start).forEach((next) => {
    if (!visited.has(edgeKey(start, next))) follow(start, next);
  }));
  return paths;
}

function pointDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let split = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointDistance(points[index], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      split = index;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  const first = simplifyPath(points.slice(0, split + 1), tolerance);
  const second = simplifyPath(points.slice(split), tolerance);
  return [...first.slice(0, -1), ...second];
}

function unitName(unit: RasterOptions["unit"]) {
  if (unit === "m") return "metros";
  if (unit === "cm") return "centímetros";
  if (unit === "mm") return "milímetros";
  return "unidades de dibujo";
}

export async function vectorizeRaster(file: File, options: RasterOptions): Promise<Drawing> {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 900;
  const reduction = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * reduction));
  const height = Math.max(1, Math.round(bitmap.height * reduction));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height).data;
  const binary = new Uint8Array(width * height);
  for (let index = 0; index < binary.length; index += 1) {
    const offset = index * 4;
    const alpha = pixels[offset + 3] / 255;
    const gray = (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) * alpha + 255 * (1 - alpha);
    binary[index] = gray < options.threshold ? 1 : 0;
  }
  const skeleton = thin(clean(binary, width, height), width, height);
  const traced = tracePaths(skeleton, width, height);
  const scale = options.realWidth && options.realWidth > 0 ? options.realWidth / width : 1;
  const primitives: Primitive[] = traced
    .map((path, index) => {
      const points = path.map((pixel) => ({ x: (pixel % width) * scale, y: (height - Math.floor(pixel / width)) * scale }));
      return {
        id: `raster-${index}`,
        type: "polyline" as const,
        layer: "VECTOR_RASTER",
        color: "#f1efe8",
        points: simplifyPath(points, Math.max(0.25, options.simplify) * scale),
      };
    })
    .filter((entity) => (entity.points?.length ?? 0) >= 2);
  if (!primitives.length) throw new Error("No lines detected");
  return {
    name: file.name.replace(/\.[^.]+$/, "") + "_vectorizado.dxf",
    format: "RASTER",
    unit: options.realWidth ? unitName(options.unit) : "unidades de dibujo",
    primitives,
    layers: [{ name: "VECTOR_RASTER", color: "#f1efe8", visible: true, selected: true, count: primitives.length }],
    warnings: [
      options.realWidth
        ? "La geometría procede de una imagen y debe revisarse antes de usarla como documentación definitiva."
        : "La imagen no se ha calibrado: las medidas se expresan en píxeles/unidades de dibujo.",
    ],
  };
}
