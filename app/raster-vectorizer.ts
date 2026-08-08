import type { Drawing, Layer, Point, Primitive } from "./cad-core";

export type RasterOptions = {
  threshold: number;
  simplify: number;
  realWidth: number | null;
  unit: "m" | "cm" | "mm" | "unit";
  detail: 1 | 2 | 3;
  classify: boolean;
  scaleBarLength: number | null;
};

type Neighbour = { index: number; direction: number };
type PathFeature = {
  pixels: number[];
  points: Point[];
  length: number;
  width: number;
  height: number;
  midX: number;
  midY: number;
  angle: number;
  straightness: number;
  meanTurn: number;
  closed: boolean;
  layer: string;
  dashed: boolean;
};

const directions = [
  [-1, -1], [0, -1], [1, -1], [1, 0],
  [1, 1], [0, 1], [-1, 1], [-1, 0],
] as const;

const layerPresets: Record<string, Omit<Layer, "count">> = {
  "01_ESTRUCTURAS": { name: "01_ESTRUCTURAS", color: "#dc6d5a", visible: true, selected: true, lineWeight: 9 },
  "02_CURVAS_NIVEL": { name: "02_CURVAS_NIVEL", color: "#55bca4", visible: true, selected: true, lineWeight: 5 },
  "03_ANOTACIONES": { name: "03_ANOTACIONES", color: "#64b5d2", visible: true, selected: true, lineWeight: 5 },
  "04_EJES_SECCIONES": { name: "04_EJES_SECCIONES", color: "#c69ce7", visible: true, selected: true, lineType: "dashed", lineWeight: 5 },
  "05_TRAMAS": { name: "05_TRAMAS", color: "#c98b52", visible: true, selected: true, lineWeight: 5 },
  "06_SIMBOLOS": { name: "06_SIMBOLOS", color: "#e0ad52", visible: true, selected: true, lineWeight: 5 },
  "07_ESCALA_NORTE": { name: "07_ESCALA_NORTE", color: "#f0c56e", visible: true, selected: true, lineWeight: 9 },
  "01_LINEAS_VECTOR": { name: "01_LINEAS_VECTOR", color: "#f1efe8", visible: true, selected: true, lineWeight: 5 },
};

function neighbourEntries(data: Uint8Array, width: number, height: number, index: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  const result: Neighbour[] = [];
  for (let direction = 0; direction < directions.length; direction += 1) {
    const [dx, dy] = directions[direction];
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const next = ny * width + nx;
    if (!data[next]) continue;
    // A diagonal is redundant when an orthogonal route already connects the
    // same pixels. Removing it prevents false junctions on staircase lines.
    if (dx !== 0 && dy !== 0 && (data[y * width + nx] || data[ny * width + x])) continue;
    result.push({ index: next, direction });
  }
  return result;
}

function normaliseGray(pixels: Uint8ClampedArray) {
  const gray = new Uint8Array(pixels.length / 4);
  const histogram = new Uint32Array(256);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    const alpha = pixels[offset + 3] / 255;
    const value = Math.round((pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) * alpha + 255 * (1 - alpha));
    gray[index] = value;
    histogram[value] += 1;
  }
  const percentile = (fraction: number) => {
    const target = gray.length * fraction;
    let total = 0;
    for (let value = 0; value < 256; value += 1) {
      total += histogram[value];
      if (total >= target) return value;
    }
    return 255;
  };
  const low = percentile(0.03);
  const high = Math.max(low + 20, percentile(0.985));
  const range = high - low;
  for (let index = 0; index < gray.length; index += 1) gray[index] = Math.max(0, Math.min(255, Math.round((gray[index] - low) * 255 / range)));
  return gray;
}

function adaptiveBinary(gray: Uint8Array, width: number, height: number, globalThreshold: number) {
  const stride = width + 1;
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum;
    }
  }
  const radius = Math.max(10, Math.round(Math.min(width, height) / 65));
  const binary = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * stride + x1 + 1] - integral[y0 * stride + x1 + 1] - integral[(y1 + 1) * stride + x0] + integral[y0 * stride + x0];
      const localMean = sum / area;
      const threshold = Math.max(globalThreshold, localMean - 17);
      binary[y * width + x] = gray[y * width + x] < threshold ? 1 : 0;
    }
  }
  // Remove only isolated pixels. End points are valuable drawing detail and
  // must never be eroded as the previous cleaner did.
  const cleaned = binary.slice();
  for (let index = 0; index < binary.length; index += 1) {
    if (binary[index] && neighbourEntries(binary, width, height, index).length === 0) cleaned[index] = 0;
  }
  return cleaned;
}

function thin(binary: Uint8Array, width: number, height: number) {
  const data = binary.slice();
  for (let iteration = 0; iteration < 64; iteration += 1) {
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
          const count = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (count < 2 || count > 6) continue;
          const transitions = Number(!p2 && !!p3) + Number(!p3 && !!p4) + Number(!p4 && !!p5) + Number(!p5 && !!p6)
            + Number(!p6 && !!p7) + Number(!p7 && !!p8) + Number(!p8 && !!p9) + Number(!p9 && !!p2);
          if (transitions !== 1) continue;
          const removable = pass === 0
            ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0
            : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0;
          if (removable) remove.push(index);
        }
      }
      if (remove.length) changed = true;
      remove.forEach((index) => { data[index] = 0; });
    }
    if (!changed) break;
  }
  return data;
}

function tracePaths(data: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(data.length);
  const paths: number[][] = [];
  const mark = (a: number, direction: number, b: number) => {
    visited[a] |= 1 << direction;
    visited[b] |= 1 << ((direction + 4) % 8);
  };
  const seen = (index: number, direction: number) => Boolean(visited[index] & (1 << direction));

  function follow(start: number, first: Neighbour) {
    const path = [start, first.index];
    mark(start, first.direction, first.index);
    let previous = start;
    let current = first.index;
    for (let guard = 0; guard < data.length; guard += 1) {
      const currentNeighbours = neighbourEntries(data, width, height, current);
      const options = currentNeighbours.filter((next) => next.index !== previous && !seen(current, next.direction));
      if (!options.length || (current !== first.index && currentNeighbours.length !== 2)) break;
      const next = options[0];
      mark(current, next.direction, next.index);
      path.push(next.index);
      previous = current;
      current = next.index;
      if (current === start) break;
    }
    if (path.length >= 2) paths.push(path);
  }

  // Start at ends and junctions, then collect any remaining closed loops.
  for (let index = 0; index < data.length; index += 1) {
    if (!data[index]) continue;
    const entries = neighbourEntries(data, width, height, index);
    if (entries.length === 2) continue;
    entries.forEach((next) => { if (!seen(index, next.direction)) follow(index, next); });
  }
  for (let index = 0; index < data.length; index += 1) {
    if (!data[index]) continue;
    neighbourEntries(data, width, height, index).forEach((next) => { if (!seen(index, next.direction)) follow(index, next); });
  }
  return paths;
}

function pointDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const position = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + position * dx), point.y - (start.y + position * dy));
}

function simplifyPath(points: Point[], tolerance: number) {
  if (points.length <= 2 || tolerance <= 0) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let furthest = 0;
    let split = -1;
    for (let index = start + 1; index < end; index += 1) {
      const distance = pointDistance(points[index], points[start], points[end]);
      if (distance > furthest) {
        furthest = distance;
        split = index;
      }
    }
    if (split > start && furthest > tolerance) {
      keep[split] = 1;
      stack.push([start, split], [split, end]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

function pathFeature(pixels: number[], width: number): PathFeature {
  const points = pixels.map((pixel) => ({ x: pixel % width, y: Math.floor(pixel / width) }));
  let length = 0;
  let turnTotal = 0;
  for (let index = 1; index < points.length; index += 1) length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  for (let index = 2; index < points.length; index += 1) {
    const a = Math.atan2(points[index - 1].y - points[index - 2].y, points[index - 1].x - points[index - 2].x);
    const b = Math.atan2(points[index].y - points[index - 1].y, points[index].x - points[index - 1].x);
    let delta = Math.abs(b - a);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    turnTotal += delta;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const start = points[0];
  const end = points[points.length - 1];
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  return {
    pixels,
    points,
    length,
    width: maxX - minX,
    height: maxY - minY,
    midX: (minX + maxX) / 2,
    midY: (minY + maxY) / 2,
    angle: (Math.atan2(end.y - start.y, end.x - start.x) + Math.PI) % Math.PI,
    straightness: length ? chord / length : 0,
    meanTurn: points.length > 2 ? turnTotal / (points.length - 2) : 0,
    closed: chord <= 2.5 && length > 8,
    layer: "01_ESTRUCTURAS",
    dashed: false,
  };
}

function angleDistance(a: number, b: number) {
  const distance = Math.abs(a - b) % Math.PI;
  return Math.min(distance, Math.PI - distance);
}

function classify(features: PathFeature[], width: number, height: number) {
  const diagonal = Math.hypot(width, height);
  const hatchBuckets = new Map<string, number>();
  features.forEach((feature) => {
    if (feature.straightness < 0.92 || feature.length < diagonal * 0.009 || feature.length > diagonal * 0.11) return;
    const angleBin = Math.round(feature.angle / (Math.PI / 12));
    const xBin = Math.floor(feature.midX / (width / 7));
    const yBin = Math.floor(feature.midY / (height / 5));
    const key = `${angleBin}:${xBin}:${yBin}`;
    hatchBuckets.set(key, (hatchBuckets.get(key) ?? 0) + 1);
  });

  features.forEach((feature) => {
    const size = Math.hypot(feature.width, feature.height);
    const horizontalOrVertical = Math.min(angleDistance(feature.angle, 0), angleDistance(feature.angle, Math.PI / 2)) < Math.PI / 20;
    const hatchKey = `${Math.round(feature.angle / (Math.PI / 12))}:${Math.floor(feature.midX / (width / 7))}:${Math.floor(feature.midY / (height / 5))}`;
    const inScale = feature.midY > height * 0.76 && feature.midY < height * 0.91 && feature.midX > width * 0.12 && feature.midX < width * 0.53;
    const inNorth = feature.midY < height * 0.34 && feature.midX > width * 0.62;
    if (inScale || inNorth) {
      feature.layer = "07_ESCALA_NORTE";
    } else if (feature.length > diagonal * 0.13 && feature.straightness > 0.92 && horizontalOrVertical) {
      feature.layer = "04_EJES_SECCIONES";
      feature.dashed = true;
    } else if ((hatchBuckets.get(hatchKey) ?? 0) >= 7 && feature.straightness > 0.92) {
      feature.layer = "05_TRAMAS";
    } else if (feature.length > diagonal * 0.15 && feature.straightness < 0.78 && feature.meanTurn < 0.55) {
      feature.layer = "02_CURVAS_NIVEL";
    } else if (feature.closed && size > diagonal * 0.012 && size < diagonal * 0.075 && feature.width > 2 && feature.height > 2) {
      feature.layer = "06_SIMBOLOS";
    } else if (size < diagonal * 0.022 || feature.length < diagonal * 0.018) {
      feature.layer = "03_ANOTACIONES";
    } else {
      feature.layer = "01_ESTRUCTURAS";
    }
  });

  // Short collinear horizontal/vertical strokes form dashed axes. Group them
  // by angle and perpendicular offset, then promote groups with a long span.
  const groups = new Map<string, PathFeature[]>();
  features.forEach((feature) => {
    if (feature.straightness < 0.95 || feature.length < diagonal * 0.006 || feature.length > diagonal * 0.075) return;
    const horizontalOrVertical = Math.min(angleDistance(feature.angle, 0), angleDistance(feature.angle, Math.PI / 2)) < Math.PI / 28;
    if (!horizontalOrVertical) return;
    const offset = -Math.sin(feature.angle) * feature.midX + Math.cos(feature.angle) * feature.midY;
    const key = `${Math.round(feature.angle / (Math.PI / 36))}:${Math.round(offset / 7)}`;
    const group = groups.get(key) ?? [];
    group.push(feature);
    groups.set(key, group);
  });
  groups.forEach((group) => {
    if (group.length < 3) return;
    const angle = group[0].angle;
    const projections = group.map((feature) => Math.cos(angle) * feature.midX + Math.sin(angle) * feature.midY);
    if (Math.max(...projections) - Math.min(...projections) < diagonal * 0.09) return;
    group.forEach((feature) => {
      feature.layer = "04_EJES_SECCIONES";
      feature.dashed = true;
    });
  });
}

function detectScaleBar(binary: Uint8Array, width: number, height: number) {
  let best = 0;
  const startY = Math.floor(height * 0.72);
  const endY = Math.floor(height * 0.91);
  const startX = Math.floor(width * 0.1);
  const endX = Math.floor(width * 0.62);
  for (let y = startY; y < endY; y += 1) {
    let run = 0;
    for (let x = startX; x < endX; x += 1) {
      if (binary[y * width + x]) run += 1;
      else {
        if (run > best && run > width * 0.1 && run < width * 0.35) best = run;
        run = 0;
      }
    }
  }
  return best || null;
}

function unitName(unit: RasterOptions["unit"]) {
  if (unit === "m") return "metros";
  if (unit === "cm") return "centímetros";
  if (unit === "mm") return "milímetros";
  return "unidades de dibujo";
}

export async function vectorizeRaster(file: File, options: RasterOptions): Promise<Drawing> {
  const bitmap = await createImageBitmap(file);
  const detailLimit = options.detail === 3 ? 1700 : options.detail === 2 ? 1400 : 1050;
  const reduction = Math.min(1, detailLimit / Math.max(bitmap.width, bitmap.height));
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
  const gray = normaliseGray(context.getImageData(0, 0, width, height).data);
  const binary = adaptiveBinary(gray, width, height, options.threshold);
  const detectedScalePixels = options.scaleBarLength ? detectScaleBar(binary, width, height) : null;
  const skeleton = thin(binary, width, height);
  const traced = tracePaths(skeleton, width, height);
  const minimumPixels = options.detail === 3 ? 2 : options.detail === 2 ? 3 : 4;
  const features = traced.filter((path) => path.length >= minimumPixels).map((path) => pathFeature(path, width));
  if (options.classify) classify(features, width, height);
  else features.forEach((feature) => { feature.layer = "01_LINEAS_VECTOR"; });

  let scale = 1;
  let calibrated = false;
  let automaticScale = false;
  if (options.realWidth && options.realWidth > 0) {
    scale = options.realWidth / width;
    calibrated = true;
  } else if (options.scaleBarLength && detectedScalePixels) {
    scale = options.scaleBarLength / detectedScalePixels;
    calibrated = true;
    automaticScale = true;
  }

  const primitives: Primitive[] = features.map((feature, index) => {
    const preset = layerPresets[feature.layer];
    const points = feature.points.map((point) => ({ x: point.x * scale, y: (height - point.y) * scale }));
    return {
      id: `raster-${index}`,
      type: "polyline",
      layer: feature.layer,
      color: preset.color,
      points: simplifyPath(points, Math.max(0.08, options.simplify) * scale),
      closed: feature.closed,
      lineType: feature.dashed ? "dashed" : "continuous",
      lineWeight: preset.lineWeight,
    };
  }).filter((entity) => (entity.points?.length ?? 0) >= 2);
  if (!primitives.length) throw new Error("No lines detected");

  const counts = new Map<string, number>();
  primitives.forEach((primitive) => counts.set(primitive.layer, (counts.get(primitive.layer) ?? 0) + 1));
  const layers = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ ...layerPresets[name], count }));
  const warnings = [
    options.classify
      ? "Las capas se han clasificado automáticamente por forma, continuidad, orientación y densidad; conviene revisar los elementos ambiguos."
      : "La geometría procede de una imagen y debe revisarse antes de usarla como documentación definitiva.",
  ];
  if (automaticScale) warnings.push(`Escala calibrada automáticamente con una barra gráfica de ${options.scaleBarLength} ${unitName(options.unit)}.`);
  else if (!calibrated) warnings.push("La imagen no se ha calibrado: las medidas se expresan en píxeles/unidades de dibujo.");
  return {
    name: file.name.replace(/\.[^.]+$/, "") + "_vectorizado.dxf",
    format: "RASTER",
    unit: calibrated ? unitName(options.unit) : "unidades de dibujo",
    primitives,
    layers,
    warnings,
  };
}
