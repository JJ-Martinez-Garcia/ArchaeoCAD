import { getBounds, parseSvg } from "./cad-core";
import type { Drawing, Layer, Point, Primitive } from "./cad-core";
import { BinaryImageConverter, ensureVTracer } from "./vtracer/browser";
import { recognizeRasterText } from "./ocr";
import type { OcrText } from "./ocr";

export type RasterOptions = {
  threshold: number;
  simplify: number;
  realWidth: number | null;
  unit: "m" | "cm" | "mm" | "unit";
  detail: 1 | 2 | 3;
  classify: boolean;
  scaleBarLength: number | null;
  ocr: boolean;
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
  roundness: number;
  closed: boolean;
  layer: string;
  dashed: boolean;
  confidence: number;
};

let vtracerSerial = 0;

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
  "08_TEXTOS_EDITABLES": { name: "08_TEXTOS_EDITABLES", color: "#8fd1e5", visible: true, selected: true, lineWeight: 3 },
  "09_MARCO_LEYENDA": { name: "09_MARCO_LEYENDA", color: "#a8a29a", visible: true, selected: true, lineWeight: 5 },
  "00_REFERENCIA_RASTER": { name: "00_REFERENCIA_RASTER", color: "#77736c", visible: true, selected: false, auxiliary: true, lineWeight: 1 },
  "01_LINEAS_VECTOR": { name: "01_LINEAS_VECTOR", color: "#f1efe8", visible: true, selected: true, lineWeight: 5 },
};

// Perfil de referencia extraído de planta_cigarralejo_vectorizada_capas.dxf.
// No es un modelo entrenado: son prioridades suaves para que un escaneado
// parecido al ejemplo no convierta todos los trazos en estructuras.
const referenceLayerPriors: Record<string, number> = {
  "01_ESTRUCTURAS": 0.63,
  "03_ANOTACIONES": 0.21,
  "06_SIMBOLOS": 0.05,
  "07_ESCALA_NORTE": 0.045,
  "08_TEXTOS_EDITABLES": 0.02,
  "05_TRAMAS": 0.018,
  "02_CURVAS_NIVEL": 0.011,
  "04_EJES_SECCIONES": 0.006,
  "09_MARCO_LEYENDA": 0.008,
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

function estimateSkewAngle(gray: Uint8Array, width: number, height: number) {
  const step = Math.max(2, Math.ceil(Math.max(width, height) / 720));
  const maxAngle = 0.07;
  let bestAngle = 0;
  let bestScore = 0;
  for (let angle = -maxAngle; angle <= maxAngle; angle += 0.01) {
    const bins = new Uint16Array(height + width + 8);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (gray[y * width + x] > 112) continue;
        const rotatedY = Math.round((y - height / 2) * cosine - (x - width / 2) * sine + height / 2);
        if (rotatedY >= 0 && rotatedY < bins.length) bins[rotatedY] += 1;
      }
    }
    let score = 0;
    for (let index = 0; index < bins.length; index += 1) score += bins[index] * bins[index];
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  // Avoid rotating nearly level scans: resampling a high-resolution photo can
  // create anti-aliased speckle that makes the WASM tracer needlessly slow.
  return Math.abs(bestAngle) >= 0.03 ? bestAngle : 0;
}

function deskewCanvas(canvas: HTMLCanvasElement, angle: number) {
  if (!angle) return;
  const width = canvas.width;
  const height = canvas.height;
  const rotated = document.createElement("canvas");
  rotated.width = width;
  rotated.height = height;
  const context = rotated.getContext("2d");
  if (!context) return;
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.translate(width / 2, height / 2);
  context.rotate(-angle);
  context.drawImage(canvas, -width / 2, -height / 2);
  const target = canvas.getContext("2d");
  if (!target) return;
  target.clearRect(0, 0, width, height);
  target.drawImage(rotated, 0, 0);
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
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  const perimeter = Math.max(length, 1);
  const roundness = chord <= 2.5 ? Math.min(1, (4 * Math.PI * Math.abs(area / 2)) / (perimeter * perimeter)) : 0;
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
    roundness,
    closed: chord <= 2.5 && length > 8,
    layer: "01_ESTRUCTURAS",
    dashed: false,
    confidence: 0,
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
    const nearBorder = (feature.midX < width * 0.025 || feature.midX > width * 0.975 || feature.midY < height * 0.025 || feature.midY > height * 0.975)
      && feature.length > diagonal * 0.08 && feature.straightness > 0.88;
    const symbolLike = feature.closed && size > diagonal * 0.008 && size < diagonal * 0.11
      && (feature.roundness > 0.48 || (feature.points.length >= 8 && feature.meanTurn > 0.32));
    const textLike = feature.closed && !symbolLike && feature.points.length >= 6 && size < diagonal * 0.026 && feature.meanTurn > 0.22;
    if (inScale || inNorth) {
      feature.layer = "07_ESCALA_NORTE";
    } else if (nearBorder) {
      feature.layer = "09_MARCO_LEYENDA";
    } else if (symbolLike) {
      feature.layer = "06_SIMBOLOS";
    } else if (textLike) {
      feature.layer = "08_TEXTOS_EDITABLES";
    } else if (feature.length > diagonal * 0.13 && feature.straightness > 0.92 && horizontalOrVertical) {
      feature.layer = "04_EJES_SECCIONES";
      feature.dashed = true;
    } else if ((hatchBuckets.get(hatchKey) ?? 0) >= 5 && feature.straightness > 0.9 && feature.meanTurn < 0.35) {
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
    const prior = referenceLayerPriors[feature.layer] ?? 0.01;
    const evidence = [
      inScale || inNorth,
      nearBorder,
      symbolLike,
      textLike,
      feature.closed,
      horizontalOrVertical,
      feature.straightness > 0.9,
      feature.length > diagonal * 0.13,
      (hatchBuckets.get(hatchKey) ?? 0) >= 5,
    ].filter(Boolean).length;
    // Confidence is deliberately exposed as a review signal, not a claim of
    // semantic certainty. Ambiguous traces stay editable in their layer.
    feature.confidence = Math.min(0.96, 0.26 + evidence * 0.085 + Math.min(prior / 0.63, 1) * 0.14);
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
      feature.confidence = Math.min(0.98, feature.confidence + 0.16);
    });
  });
  return features.filter((feature) => feature.confidence < 0.5).length;
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

function raf() {
  return typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
}

function ocrPrimitives(texts: OcrText[], width: number, height: number, scale: number): Primitive[] {
  return texts.map((text, index) => ({
    id: `ocr-${index}`,
    type: "text",
    layer: "08_TEXTOS_EDITABLES",
    color: layerPresets["08_TEXTOS_EDITABLES"].color,
    center: { x: ((text.box.x0 + text.box.x1) / 2) * scale, y: (height - (text.box.y0 + text.box.y1) / 2) * scale },
    text: text.text,
    height: Math.max(1, (text.box.y1 - text.box.y0) * scale * 0.82),
    rotation: 0,
    confidence: Math.min(0.99, Math.max(0, text.confidence / 100)),
    lineWeight: layerPresets["08_TEXTOS_EDITABLES"].lineWeight,
  }));
}

type RasterSource = CanvasImageSource & { close?: () => void };

/**
 * Safari/iOS WebKit and several Android WebViews do not expose
 * createImageBitmap(File). Falling back to an HTMLImageElement keeps the
 * vectorizer usable in those browsers instead of surfacing a generic error.
 */
async function decodeRaster(file: File): Promise<{ source: RasterSource; width: number; height: number; revoke?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Continue with the object-URL decoder below.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image decode failed"));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, revoke: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function vectorizeWithVTracer(binary: Uint8Array, width: number, height: number, file: File, options: RasterOptions, detectedScalePixels: number | null, ocrTexts: OcrText[]): Promise<Drawing | null> {
  const serial = vtracerSerial += 1;
  const canvas = document.createElement("canvas");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  canvas.id = `arqueocad-vtracer-canvas-${serial}`;
  svg.id = `arqueocad-vtracer-svg-${serial}`;
  canvas.width = width;
  canvas.height = height;
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  canvas.style.display = "none";
  svg.style.display = "none";
  document.body.append(canvas, svg);
  let converter: BinaryImageConverter | null = null;
  try {
    await ensureVTracer();
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    const image = context.createImageData(width, height);
    for (let index = 0; index < binary.length; index += 1) {
      const value = binary[index] ? 0 : 255;
      const offset = index * 4;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    converter = BinaryImageConverter.new_with_string(JSON.stringify({
      canvas_id: canvas.id,
      svg_id: svg.id,
      mode: options.detail === 3 ? "spline" : "polygon",
      corner_threshold: 60,
      length_threshold: Math.max(1, options.simplify * 2),
      max_iterations: options.detail === 3 ? 14 : 9,
      splice_threshold: 45,
      filter_speckle: options.detail === 3 ? 2 : options.detail === 2 ? 4 : 7,
      path_precision: 3,
    }));
    converter.init();
    await new Promise<void>((resolve, reject) => {
      const deadline = performance.now() + 20000;
      const step = () => {
        try {
          if (converter?.tick()) resolve();
          else if (performance.now() >= deadline) reject(new Error("VTracer timeout"));
          else raf()(step);
        } catch (error) {
          reject(error);
        }
      };
      raf()(step);
    });
    const parsed = parseSvg(new XMLSerializer().serializeToString(svg), file.name);
    if (!parsed.primitives.length) return null;
    const bounds = getBounds(parsed.primitives);
    const featureByPrimitive = new Map<number, PathFeature>();
    parsed.primitives.forEach((primitive, index) => {
      if (primitive.type !== "polyline" || !primitive.points?.length) return;
      const pixels = primitive.points.map((point) => Math.round(-point.y) * width + Math.round(point.x));
      featureByPrimitive.set(index, pathFeature(pixels, width));
    });
    const features = [...featureByPrimitive.values()];
    const ambiguous = options.classify && features.length ? classify(features, Math.max(bounds.width, 1), Math.max(bounds.height, 1)) : 0;
    const scaleBarScale = options.scaleBarLength && detectedScalePixels ? options.scaleBarLength / detectedScalePixels : null;
    const scale = options.realWidth && options.realWidth > 0 ? options.realWidth / Math.max(bounds.width, 1) : scaleBarScale ?? 1;
    const primitives = parsed.primitives.map((primitive, index) => {
      if (primitive.type !== "polyline" || !primitive.points?.length) return primitive;
      const feature = featureByPrimitive.get(index);
      const layer = options.classify && feature ? feature.layer : "01_LINEAS_VECTOR";
      return { ...primitive, layer, color: layerPresets[layer].color, lineWeight: layerPresets[layer].lineWeight, confidence: options.classify ? feature?.confidence ?? 0.5 : 1, points: primitive.points.map((point) => ({ x: point.x * scale, y: (height + point.y) * scale })) };
    });
    primitives.push(...ocrPrimitives(ocrTexts, width, height, scale));
    const counts = new Map<string, number>();
    primitives.forEach((primitive) => counts.set(primitive.layer, (counts.get(primitive.layer) ?? 0) + 1));
    const layers = [...counts.entries()].map(([name, count]) => ({ ...(layerPresets[name] ?? layerPresets["01_LINEAS_VECTOR"]), name, count }));
    const calibrated = Boolean((options.realWidth && options.realWidth > 0) || scaleBarScale);
    return {
      name: file.name.replace(/\.[^.]+$/, "") + "_vectorizado.dxf",
      format: "RASTER",
      unit: calibrated ? unitName(options.unit) : "unidades de dibujo",
      primitives,
      layers,
      warnings: [
        "Vectorización VTracer (WebAssembly) con trazado suavizado; revisa el resultado antes de usarlo como documentación definitiva.",
        ...(options.ocr ? [ocrTexts.length ? `OCR: ${ocrTexts.length} textos añadidos a 08_TEXTOS_EDITABLES.` : "OCR no ha encontrado textos con confianza suficiente; revisa el escaneado."] : []),
        ...(ambiguous ? [`${ambiguous} trazos tienen baja confianza de clasificación y conviene revisarlos.`] : []),
      ],
    };
  } catch {
    return null;
  } finally {
    converter?.free();
    canvas.remove();
    svg.remove();
  }
}

export async function vectorizeRaster(file: File, options: RasterOptions): Promise<Drawing> {
  const decoded = await decodeRaster(file);
  const bitmap = decoded.source;
  // Keep the default workload bounded on phones while retaining a selectable
  // maximum-detail mode for desktop review.
  const detailLimit = options.detail === 3 ? 1300 : options.detail === 2 ? 1000 : 700;
  const reduction = Math.min(1, detailLimit / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * reduction));
  const height = Math.max(1, Math.round(decoded.height * reduction));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  decoded.revoke?.();
  const initialGray = normaliseGray(context.getImageData(0, 0, width, height).data);
  deskewCanvas(canvas, estimateSkewAngle(initialGray, width, height));
  const gray = normaliseGray(context.getImageData(0, 0, width, height).data);
  const binary = adaptiveBinary(gray, width, height, options.threshold);
  const detectedScalePixels = options.scaleBarLength ? detectScaleBar(binary, width, height) : null;
  const ocrTexts = options.ocr ? await recognizeRasterText(canvas) : [];
  const vtracerDrawing = await vectorizeWithVTracer(binary, width, height, file, options, detectedScalePixels, ocrTexts);
  if (vtracerDrawing) return vtracerDrawing;
  const skeleton = thin(binary, width, height);
  const traced = tracePaths(skeleton, width, height);
  const minimumPixels = options.detail === 3 ? 2 : options.detail === 2 ? 3 : 4;
  const features = traced.filter((path) => path.length >= minimumPixels).map((path) => pathFeature(path, width));
  const ambiguous = options.classify ? classify(features, width, height) : 0;
  if (!options.classify) features.forEach((feature) => { feature.layer = "01_LINEAS_VECTOR"; });

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
      confidence: options.classify ? feature.confidence : 1,
    };
  }).filter((entity) => (entity.points?.length ?? 0) >= 2);
  primitives.push(...ocrPrimitives(ocrTexts, width, height, scale));
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
  if (options.ocr) warnings.push(ocrTexts.length ? `OCR: ${ocrTexts.length} textos añadidos a 08_TEXTOS_EDITABLES.` : "OCR no ha encontrado textos con confianza suficiente; revisa el escaneado.");
  if (ambiguous) warnings.push(`${ambiguous} trazos tienen baja confianza de clasificación y conviene revisarlos.`);
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
