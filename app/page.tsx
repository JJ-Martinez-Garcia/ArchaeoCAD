"use client";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Point = { x: number; y: number };
type Primitive = {
  id: string;
  type: "polyline" | "circle" | "point" | "text";
  layer: string;
  color?: string;
  points?: Point[];
  center?: Point;
  radius?: number;
  closed?: boolean;
  text?: string;
  height?: number;
  rotation?: number;
};
type Layer = {
  name: string;
  color: string;
  visible: boolean;
  selected: boolean;
  count: number;
  auxiliary?: boolean;
};
type Drawing = {
  name: string;
  format: "DXF" | "SVG" | "DWG" | "DEMO";
  unit: string;
  primitives: Primitive[];
  layers: Layer[];
  warnings: string[];
};
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
type DxfPair = { code: number; value: string };

const ACI_COLORS: Record<number, string> = {
  1: "#dc6d5a",
  2: "#e0ad52",
  3: "#5dc0a6",
  4: "#64b5d2",
  5: "#5879bd",
  6: "#c69ce7",
  7: "#f1efe8",
};

const translations = {
  es: {
    open: "Abrir plano",
    openShort: "Abrir",
    layers: "Capas",
    measure: "Medir",
    export: "Exportar",
    warnings: "Avisos",
    fit: "Encuadrar",
    search: "Buscar capa…",
    selected: "seleccionadas",
    visible: "visibles",
    layerHelp: "El ojo controla lo que ves. La casilla, lo que exportas.",
    all: "Todas",
    none: "Ninguna",
    noWarnings: "El plano no presenta avisos.",
    local: "El archivo se procesa solo en este dispositivo",
    drop: "Suelta aquí tu plano",
    formats: "DXF o SVG · hasta 50 MB",
    exportTitle: "Preparar archivos",
    mode: "Organización",
    perLayer: "Un archivo por capa",
    filtered: "Un plano con la selección",
    output: "Formatos de salida",
    blocks: "Desplegar bloques cuando sea posible",
    auxiliary: "Incluir capas auxiliares",
    download: "Crear paquete ZIP",
    cancel: "Cancelar",
    measureHint: "Toca puntos sobre el plano",
    clear: "Limpiar",
    undo: "Deshacer",
    length: "Longitud",
    perimeter: "Perímetro",
    area: "Área",
    azimuth: "Acimut",
    ready: "Plano listo",
    fileError: "No se ha podido leer este archivo.",
    dwgTitle: "DWG necesita conversión",
    dwgBody: "En móvil, convierte primero el archivo a DXF. Así se conserva la geometría sin interpretar un formato propietario en el navegador.",
    sample: "Plano de muestra",
  },
  en: {
    open: "Open drawing",
    openShort: "Open",
    layers: "Layers",
    measure: "Measure",
    export: "Export",
    warnings: "Warnings",
    fit: "Fit drawing",
    search: "Search layer…",
    selected: "selected",
    visible: "visible",
    layerHelp: "The eye controls the view. The checkbox controls export.",
    all: "All",
    none: "None",
    noWarnings: "No warnings were found in this drawing.",
    local: "The file is processed only on this device",
    drop: "Drop your drawing here",
    formats: "DXF or SVG · up to 50 MB",
    exportTitle: "Prepare files",
    mode: "Organisation",
    perLayer: "One file per layer",
    filtered: "One drawing with selection",
    output: "Output formats",
    blocks: "Explode blocks when possible",
    auxiliary: "Include auxiliary layers",
    download: "Create ZIP package",
    cancel: "Cancel",
    measureHint: "Tap points on the drawing",
    clear: "Clear",
    undo: "Undo",
    length: "Length",
    perimeter: "Perimeter",
    area: "Area",
    azimuth: "Azimuth",
    ready: "Drawing ready",
    fileError: "This file could not be read.",
    dwgTitle: "DWG needs conversion",
    dwgBody: "On mobile, convert the file to DXF first. This preserves geometry without interpreting a proprietary format in the browser.",
    sample: "Sample drawing",
  },
} as const;

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function makeDemo(): Drawing {
  const specs = [
    ["MUROS", "#f1efe8", 86],
    ["UE-2", "#e0ad52", 104],
    ["UE-10", "#5dc0a6", 92],
    ["UE-101", "#dc6d5a", 78],
    ["COTAS", "#64b5d2", 143],
    ["TEXTOS", "#c69ce7", 46],
  ] as const;
  const primitives: Primitive[] = [];
  specs.forEach(([name, color, count], layerIndex) => {
    for (let i = 0; i < count; i += 1) {
      const col = i % 13;
      const row = Math.floor(i / 13);
      const x = 7 + col * 6.5 + seeded(i, layerIndex) * 2.2;
      const y = 7 + row * 6.2 + seeded(i, layerIndex + 9) * 2;
      if (name.startsWith("UE-")) {
        const radius = 1.2 + seeded(i, layerIndex + 3) * 1.8;
        const points = Array.from({ length: 8 }, (_, n) => {
          const angle = (Math.PI * 2 * n) / 8;
          const wobble = 0.75 + seeded(i * 8 + n, layerIndex) * 0.45;
          return { x: x + Math.cos(angle) * radius * wobble, y: y + Math.sin(angle) * radius * wobble };
        });
        primitives.push({ id: `${name}-${i}`, type: "polyline", layer: name, color, points, closed: true });
      } else if (name === "COTAS") {
        primitives.push({ id: `${name}-${i}`, type: "point", layer: name, color, center: { x, y } });
      } else if (name === "TEXTOS" && i < 9) {
        primitives.push({ id: `${name}-${i}`, type: "text", layer: name, color, center: { x, y }, text: i === 0 ? "SECTOR NORTE" : `UE ${100 + i}`, height: 1.7 });
      } else {
        const angle = seeded(i, layerIndex + 2) * Math.PI;
        const length = 3 + seeded(i, layerIndex + 6) * 7;
        primitives.push({
          id: `${name}-${i}`,
          type: "polyline",
          layer: name,
          color,
          points: [{ x, y }, { x: x + Math.cos(angle) * length, y: y + Math.sin(angle) * length }],
        });
      }
    }
  });
  return {
    name: "Sector_Norte_2026.dxf",
    format: "DEMO",
    unit: "metros",
    primitives,
    layers: specs.map(([name, color, count]) => ({ name, color, count, visible: true, selected: true })),
    warnings: ["Vista de demostración. Abre un DXF o SVG para trabajar con tu propio plano."],
  };
}

function getBounds(primitives: Primitive[]): Bounds {
  const points: Point[] = [];
  primitives.forEach((entity) => {
    if (entity.points) points.push(...entity.points);
    if (entity.center) {
      const r = entity.radius ?? 0.6;
      points.push({ x: entity.center.x - r, y: entity.center.y - r }, { x: entity.center.x + r, y: entity.center.y + r });
    }
  });
  if (!points.length) return { minX: 0, minY: 0, maxX: 100, maxY: 70, width: 100, height: 70 };
  let minX = Math.min(...points.map((point) => point.x));
  let maxX = Math.max(...points.map((point) => point.x));
  let minY = Math.min(...points.map((point) => point.y));
  let maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const margin = Math.max(width, height) * 0.055;
  minX -= margin;
  maxX += margin;
  minY -= margin;
  maxY += margin;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function valueOf(record: DxfPair[], code: number, fallback = "") {
  return record.find((pair) => pair.code === code)?.value ?? fallback;
}

function numberOf(record: DxfPair[], code: number, fallback = 0) {
  const value = Number.parseFloat(valueOf(record, code));
  return Number.isFinite(value) ? value : fallback;
}

function parsePairs(text: string): DxfPair[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const pairs: DxfPair[] = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number.parseInt(lines[index].trim(), 10);
    if (Number.isFinite(code)) pairs.push({ code, value: lines[index + 1].trimEnd() });
  }
  return pairs;
}

function recordsFrom(pairs: DxfPair[]) {
  const records: DxfPair[][] = [];
  let current: DxfPair[] = [];
  pairs.forEach((pair) => {
    if (pair.code === 0 && current.length) {
      records.push(current);
      current = [];
    }
    current.push(pair);
  });
  if (current.length) records.push(current);
  return records;
}

function dxfColor(record: DxfPair[], layerColor: string) {
  const aci = Math.abs(Math.trunc(numberOf(record, 62, 0)));
  return ACI_COLORS[aci] ?? layerColor;
}

function parseDxf(text: string, name: string): Drawing {
  const pairs = parsePairs(text);
  if (!pairs.length) throw new Error("DXF vacío o no válido");
  const allRecords = recordsFrom(pairs);
  const layerMap = new Map<string, Layer>();
  allRecords.filter((record) => valueOf(record, 0) === "LAYER").forEach((record) => {
    const layerName = valueOf(record, 2, "0");
    const aci = Math.abs(Math.trunc(numberOf(record, 62, 7)));
    layerMap.set(layerName, {
      name: layerName,
      color: ACI_COLORS[aci] ?? "#d7d2c7",
      visible: numberOf(record, 62, 7) >= 0,
      selected: layerName.toLowerCase() !== "defpoints",
      auxiliary: layerName.toLowerCase() === "defpoints",
      count: 0,
    });
  });
  let inEntities = false;
  const entityPairs: DxfPair[] = [];
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (pair.code === 0 && pair.value === "SECTION" && pairs[index + 1]?.code === 2 && pairs[index + 1]?.value === "ENTITIES") {
      inEntities = true;
      index += 1;
      continue;
    }
    if (inEntities && pair.code === 0 && pair.value === "ENDSEC") break;
    if (inEntities) entityPairs.push(pair);
  }
  const primitives: Primitive[] = [];
  const warnings: string[] = [];
  recordsFrom(entityPairs).forEach((record, index) => {
    const type = valueOf(record, 0).toUpperCase();
    const layerName = valueOf(record, 8, "0");
    if (!layerMap.has(layerName)) layerMap.set(layerName, { name: layerName, color: "#d7d2c7", visible: true, selected: true, count: 0 });
    const layer = layerMap.get(layerName)!;
    layer.count += 1;
    const color = dxfColor(record, layer.color);
    const common = { id: `dxf-${index}`, layer: layerName, color };
    if (type === "LINE") {
      primitives.push({ ...common, type: "polyline", points: [{ x: numberOf(record, 10), y: numberOf(record, 20) }, { x: numberOf(record, 11), y: numberOf(record, 21) }] });
    } else if (type === "LWPOLYLINE") {
      const xs = record.filter((pair) => pair.code === 10).map((pair) => Number.parseFloat(pair.value));
      const ys = record.filter((pair) => pair.code === 20).map((pair) => Number.parseFloat(pair.value));
      const points = xs.map((x, pointIndex) => ({ x, y: ys[pointIndex] ?? 0 }));
      if (points.length) primitives.push({ ...common, type: "polyline", points, closed: (Math.trunc(numberOf(record, 70)) & 1) === 1 });
    } else if (type === "CIRCLE" || type === "ARC") {
      const center = { x: numberOf(record, 10), y: numberOf(record, 20) };
      const radius = Math.abs(numberOf(record, 40, 1));
      if (type === "CIRCLE") primitives.push({ ...common, type: "circle", center, radius });
      else {
        const start = numberOf(record, 50) * Math.PI / 180;
        let end = numberOf(record, 51) * Math.PI / 180;
        if (end <= start) end += Math.PI * 2;
        const points = Array.from({ length: 33 }, (_, pointIndex) => {
          const angle = start + (end - start) * pointIndex / 32;
          return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
        });
        primitives.push({ ...common, type: "polyline", points });
      }
    } else if (type === "POINT" || type === "INSERT") {
      primitives.push({ ...common, type: "point", center: { x: numberOf(record, 10), y: numberOf(record, 20) } });
    } else if (type === "TEXT" || type === "MTEXT") {
      const pieces = record.filter((pair) => pair.code === 1 || pair.code === 3).map((pair) => pair.value);
      primitives.push({ ...common, type: "text", center: { x: numberOf(record, 10), y: numberOf(record, 20) }, text: pieces.join("").replace(/\\P/g, " "), height: numberOf(record, 40, 1), rotation: numberOf(record, 50) });
    } else if (type === "SOLID" || type === "3DFACE") {
      const points = [10, 11, 12, 13].map((code) => ({ x: numberOf(record, code), y: numberOf(record, code + 10) }));
      primitives.push({ ...common, type: "polyline", points, closed: true });
    }
  });
  const unsupported = allRecords.filter((record) => ["SPLINE", "ELLIPSE", "HATCH", "DIMENSION"].includes(valueOf(record, 0))).length;
  if (unsupported) warnings.push(`${unsupported} entidades complejas se muestran simplificadas; se conservarán al exportar desde la aplicación de escritorio.`);
  const insUnitsRecord = allRecords.find((record) => record.some((pair) => pair.code === 9 && pair.value === "$INSUNITS"));
  const unitCode = insUnitsRecord ? numberOf(insUnitsRecord, 70, 0) : 0;
  const unit = ({ 1: "pulgadas", 4: "milímetros", 5: "centímetros", 6: "metros" } as Record<number, string>)[unitCode] ?? "unidades de dibujo";
  return { name, format: "DXF", unit, primitives, layers: [...layerMap.values()].sort((a, b) => naturalSort(a.name, b.name)), warnings };
}

function parsePoints(value: string) {
  const values = value.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const points: Point[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) points.push({ x: values[index], y: values[index + 1] });
  return points;
}

function parseSvg(text: string, name: string): Drawing {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("SVG no válido");
  const root = doc.documentElement;
  const layerMap = new Map<string, Layer>();
  const primitives: Primitive[] = [];
  const elements = [...root.querySelectorAll("line,polyline,polygon,circle,rect,text,path")];
  elements.forEach((element, index) => {
    const group = element.closest("g");
    const layerName = group?.getAttribute("inkscape:label") ?? group?.getAttribute("data-name") ?? group?.getAttribute("id") ?? "Plano";
    const style = element.getAttribute("style") ?? "";
    const color = element.getAttribute("stroke") ?? style.match(/stroke:\s*([^;]+)/)?.[1] ?? "#d7d2c7";
    if (!layerMap.has(layerName)) layerMap.set(layerName, { name: layerName, color, visible: true, selected: true, count: 0 });
    layerMap.get(layerName)!.count += 1;
    const common = { id: `svg-${index}`, layer: layerName, color };
    const tag = element.tagName.toLowerCase();
    if (tag === "line") {
      primitives.push({ ...common, type: "polyline", points: [{ x: Number(element.getAttribute("x1")) || 0, y: -(Number(element.getAttribute("y1")) || 0) }, { x: Number(element.getAttribute("x2")) || 0, y: -(Number(element.getAttribute("y2")) || 0) }] });
    } else if (tag === "polyline" || tag === "polygon") {
      primitives.push({ ...common, type: "polyline", points: parsePoints(element.getAttribute("points") ?? "").map((point) => ({ x: point.x, y: -point.y })), closed: tag === "polygon" });
    } else if (tag === "circle") {
      primitives.push({ ...common, type: "circle", center: { x: Number(element.getAttribute("cx")) || 0, y: -(Number(element.getAttribute("cy")) || 0) }, radius: Math.abs(Number(element.getAttribute("r")) || 1) });
    } else if (tag === "rect") {
      const x = Number(element.getAttribute("x")) || 0;
      const y = Number(element.getAttribute("y")) || 0;
      const width = Number(element.getAttribute("width")) || 0;
      const height = Number(element.getAttribute("height")) || 0;
      primitives.push({ ...common, type: "polyline", points: [{ x, y: -y }, { x: x + width, y: -y }, { x: x + width, y: -(y + height) }, { x, y: -(y + height) }], closed: true });
    } else if (tag === "text") {
      primitives.push({ ...common, type: "text", center: { x: Number(element.getAttribute("x")) || 0, y: -(Number(element.getAttribute("y")) || 0) }, text: element.textContent ?? "", height: Number(element.getAttribute("font-size")) || 12 });
    } else if (tag === "path") {
      const points = parsePoints((element.getAttribute("d") ?? "").replace(/[A-Za-z]/g, " ")).map((point) => ({ x: point.x, y: -point.y }));
      if (points.length > 1) primitives.push({ ...common, type: "polyline", points, closed: /z\s*$/i.test(element.getAttribute("d") ?? "") });
    }
  });
  const warnings = root.querySelector("g[inkscape\\:groupmode='layer']") ? [] : ["El SVG no declara capas de Inkscape; los grupos se han usado como capas de trabajo."];
  return { name, format: "SVG", unit: "píxeles CSS (96 ppp)", primitives, layers: [...layerMap.values()].sort((a, b) => naturalSort(a.name, b.name)), warnings };
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function measurement(points: Point[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += distance(points[index - 1], points[index]);
  let perimeter = length;
  let area = 0;
  if (points.length > 2) {
    perimeter += distance(points[points.length - 1], points[0]);
    for (let index = 0; index < points.length; index += 1) {
      const next = points[(index + 1) % points.length];
      area += points[index].x * next.y - next.x * points[index].y;
    }
    area = Math.abs(area) / 2;
  }
  const lastA = points.at(-2);
  const lastB = points.at(-1);
  const azimuth = lastA && lastB ? (Math.atan2(lastB.x - lastA.x, lastB.y - lastA.y) * 180 / Math.PI + 360) % 360 : 0;
  return { length, perimeter, area, azimuth };
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

function toSvg(primitives: Primitive[], title: string) {
  const bounds = getBounds(primitives);
  const sw = Math.max(bounds.width, bounds.height) / 900;
  const y = (value: number) => bounds.maxY - value + bounds.minY;
  const body = primitives.map((entity) => {
    const color = entity.color?.toLowerCase() === "#ffffff" || entity.color?.toLowerCase() === "#f1efe8" ? "#111111" : entity.color ?? "#111111";
    if (entity.type === "polyline" && entity.points) return `<polyline points="${entity.points.map((point) => `${point.x},${y(point.y)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${sw}"${entity.closed ? ' stroke-linejoin="round"' : ""}/>`;
    if (entity.type === "circle" && entity.center) return `<circle cx="${entity.center.x}" cy="${y(entity.center.y)}" r="${entity.radius ?? 1}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
    if (entity.type === "point" && entity.center) return `<circle cx="${entity.center.x}" cy="${y(entity.center.y)}" r="${sw * 2.2}" fill="${color}"/>`;
    if (entity.type === "text" && entity.center) return `<text x="${entity.center.x}" y="${y(entity.center.y)}" font-family="sans-serif" font-size="${entity.height ?? 1}" fill="${color}">${escapeXml(entity.text ?? "")}</text>`;
    return "";
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}"><title>${escapeXml(title)}</title><rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="white"/>${body}</svg>`;
}

function toDxf(primitives: Primitive[], unit: string) {
  const out: string[] = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", unit === "metros" ? "6" : "0", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  const add = (...values: (string | number)[]) => values.forEach((value) => out.push(String(value)));
  primitives.forEach((entity) => {
    if (entity.type === "polyline" && entity.points?.length) {
      add(0, "LWPOLYLINE", 8, entity.layer, 90, entity.points.length, 70, entity.closed ? 1 : 0);
      entity.points.forEach((point) => add(10, point.x, 20, point.y));
    } else if (entity.type === "circle" && entity.center) add(0, "CIRCLE", 8, entity.layer, 10, entity.center.x, 20, entity.center.y, 40, entity.radius ?? 1);
    else if (entity.type === "point" && entity.center) add(0, "POINT", 8, entity.layer, 10, entity.center.x, 20, entity.center.y);
    else if (entity.type === "text" && entity.center) add(0, "TEXT", 8, entity.layer, 10, entity.center.x, 20, entity.center.y, 40, entity.height ?? 1, 1, entity.text ?? "");
  });
  add(0, "ENDSEC", 0, "EOF");
  return out.join("\r\n") + "\r\n";
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(chunks: Uint8Array[]) {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.length; });
  return output;
}

function little(values: [number, number][]) {
  const length = values.reduce((sum, [, size]) => sum + size, 0);
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  values.forEach(([value, size]) => {
    if (size === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value >>> 0, true);
    offset += size;
  });
  return bytes;
}

function makeZip(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;
  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = concatBytes([
      little([[0x04034b50, 4], [20, 2], [0x0800, 2], [0, 2], [0, 2], [0, 2], [crc, 4], [data.length, 4], [data.length, 4], [name.length, 2], [0, 2]]), name,
    ]);
    localChunks.push(localHeader, data);
    const central = concatBytes([
      little([[0x02014b50, 4], [20, 2], [20, 2], [0x0800, 2], [0, 2], [0, 2], [0, 2], [crc, 4], [data.length, 4], [data.length, 4], [name.length, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]]), name,
    ]);
    centralChunks.push(central);
    offset += localHeader.length + data.length;
  });
  const central = concatBytes(centralChunks);
  const end = little([[0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2], [central.length, 4], [offset, 4], [0, 2]]);
  return concatBytes([...localChunks, central, end]);
}

function safeName(value: string) {
  return value.replace(/[<>:"/\\|?*]/g, "_").trim() || "capa";
}

export default function ArqueoCadMobile() {
  const [drawing, setDrawing] = useState<Drawing>(() => makeDemo());
  const [lang, setLang] = useState<"es" | "en">("es");
  const [activePanel, setActivePanel] = useState<"layers" | "warnings" | null>("layers");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"layers" | "filtered">("layers");
  const [exportFormats, setExportFormats] = useState({ dxf: true, svg: true });
  const [draggingFile, setDraggingFile] = useState(false);
  const [toast, setToast] = useState("");
  const [dwgOpen, setDwgOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const t = translations[lang];

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const bounds = useMemo(() => getBounds(drawing.primitives), [drawing.primitives]);
  const visibleNames = useMemo(() => new Set(drawing.layers.filter((layer) => layer.visible).map((layer) => layer.name)), [drawing.layers]);
  const visiblePrimitives = useMemo(() => drawing.primitives.filter((entity) => visibleNames.has(entity.layer)), [drawing.primitives, visibleNames]);
  const selectedCount = drawing.layers.filter((layer) => layer.selected).length;
  const visibleCount = drawing.layers.filter((layer) => layer.visible).length;
  const filteredLayers = drawing.layers.filter((layer) => layer.name.toLowerCase().includes(search.toLowerCase()));
  const metrics = measurement(measurePoints);
  const viewWidth = bounds.width / zoom;
  const viewHeight = bounds.height / zoom;
  const viewX = bounds.minX + (bounds.width - viewWidth) / 2 + pan.x;
  const viewY = bounds.minY + (bounds.height - viewHeight) / 2 + pan.y;
  const sy = (value: number) => bounds.maxY - value + bounds.minY;
  const strokeWidth = Math.max(bounds.width, bounds.height) / 720 / zoom;

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  async function readFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "dwg") {
      setDwgOpen(true);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setToast(lang === "es" ? "El archivo supera el límite de 50 MB." : "The file exceeds the 50 MB limit.");
      return;
    }
    try {
      const text = await file.text();
      const next = extension === "dxf" ? parseDxf(text, file.name) : extension === "svg" ? parseSvg(text, file.name) : null;
      if (!next) throw new Error("Formato no admitido");
      setDrawing(next);
      setMeasurePoints([]);
      resetView();
      setActivePanel("layers");
      setToast(`${t.ready}: ${next.layers.length} ${t.layers.toLowerCase()}`);
    } catch {
      setToast(t.fileError);
    }
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
    event.target.value = "";
  }

  function updateLayer(name: string, field: "visible" | "selected") {
    setDrawing((current) => ({ ...current, layers: current.layers.map((layer) => layer.name === name ? { ...layer, [field]: !layer[field] } : layer) }));
  }

  function selectAll(selected: boolean) {
    setDrawing((current) => ({ ...current, layers: current.layers.map((layer) => ({ ...layer, selected: layer.auxiliary ? false : selected })) }));
  }

  function eventPoint(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM()?.inverse();
    if (!matrix) return null;
    const mapped = point.matrixTransform(matrix);
    return { x: mapped.x, y: bounds.maxY - mapped.y + bounds.minY };
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      setPan({ x: drag.panX - dx * viewWidth / rect.width, y: drag.panY - dy * viewHeight / rect.height });
    }
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (drag && !drag.moved && measureMode) {
      const point = eventPoint(event);
      if (point) setMeasurePoints((current) => [...current, point]);
    }
    dragRef.current = null;
  }

  function onWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    setZoom((current) => Math.min(10, Math.max(0.65, current * (event.deltaY > 0 ? 0.9 : 1.1))));
  }

  function createExport() {
    const chosenLayers = drawing.layers.filter((layer) => layer.selected && (!layer.auxiliary));
    if (!chosenLayers.length || (!exportFormats.dxf && !exportFormats.svg)) return;
    const stem = safeName(drawing.name.replace(/\.[^.]+$/, ""));
    const files: { name: string; content: string }[] = [];
    const groups = exportMode === "layers" ? chosenLayers.map((layer) => ({ suffix: safeName(layer.name), names: [layer.name] })) : [{ suffix: "seleccion", names: chosenLayers.map((layer) => layer.name) }];
    groups.forEach((group) => {
      const set = new Set(group.names);
      const primitives = drawing.primitives.filter((entity) => set.has(entity.layer));
      if (exportFormats.svg) files.push({ name: `${stem}_${group.suffix}.svg`, content: toSvg(primitives, `${stem} · ${group.suffix}`) });
      if (exportFormats.dxf) files.push({ name: `${stem}_${group.suffix}.dxf`, content: toDxf(primitives, drawing.unit) });
    });
    const zip = makeZip(files);
    const blob = new Blob([zip as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${stem}_capas.zip`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportOpen(false);
    setToast(lang === "es" ? `${files.length} archivos preparados` : `${files.length} files prepared`);
  }

  return (
    <main className="app-shell" onDragOver={(event) => { event.preventDefault(); setDraggingFile(true); }} onDragLeave={() => setDraggingFile(false)} onDrop={(event) => { event.preventDefault(); setDraggingFile(false); const file = event.dataTransfer.files[0]; if (file) void readFile(file); }}>
      <input ref={inputRef} className="sr-only" type="file" accept=".dxf,.dwg,.svg" onChange={onInput} />

      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><span>A</span></div>
          <div><strong>ArqueoCAD</strong><small>FIELD DRAWING</small></div>
        </div>
        <div className="file-summary" title={drawing.name}>
          <span className="format-badge">{drawing.format === "DEMO" ? "DXF" : drawing.format}</span>
          <div><strong>{drawing.name}</strong><small>{drawing.primitives.length.toLocaleString(lang)} entidades · {drawing.layers.length} capas · {drawing.unit}</small></div>
        </div>
        <div className="top-actions">
          <span className="privacy-note"><span className="status-dot" />{t.local}</span>
          <button className="language-button" onClick={() => setLang((current) => current === "es" ? "en" : "es")} aria-label="Cambiar idioma">{lang.toUpperCase()}</button>
          <button className="primary-button compact" onClick={() => inputRef.current?.click()}><span aria-hidden="true">＋</span>{t.open}</button>
        </div>
      </header>

      <section className="workspace">
        <nav className="tool-rail" aria-label="Herramientas principales">
          <button onClick={() => inputRef.current?.click()}><span className="tool-glyph">＋</span><small>{t.openShort}</small></button>
          <button className={activePanel === "layers" ? "active" : ""} onClick={() => setActivePanel(activePanel === "layers" ? null : "layers")}><span className="tool-glyph layers-glyph">▤</span><small>{t.layers}</small></button>
          <button className={measureMode ? "active" : ""} onClick={() => { setMeasureMode((current) => !current); setActivePanel(null); }}><span className="tool-glyph">⌁</span><small>{t.measure}</small></button>
          <button className={activePanel === "warnings" ? "active" : ""} onClick={() => setActivePanel(activePanel === "warnings" ? null : "warnings")}><span className="tool-glyph warning-glyph">!</span><small>{t.warnings}</small>{drawing.warnings.length > 0 && <span className="notification-count">{drawing.warnings.length}</span>}</button>
          <div className="rail-spacer" />
          <button onClick={resetView}><span className="tool-glyph">⌗</span><small>{t.fit}</small></button>
        </nav>

        <section className="canvas-area" aria-label="Visor del plano">
          <div className="canvas-toolbar">
            <div className="crumb"><span>{t.sample}</span><b>/</b><strong>{drawing.name.replace(/\.[^.]+$/, "")}</strong></div>
            <div className="view-controls">
              <button onClick={() => setZoom((value) => Math.max(0.65, value / 1.2))} aria-label="Alejar">−</button>
              <output>{Math.round(zoom * 100)}%</output>
              <button onClick={() => setZoom((value) => Math.min(10, value * 1.2))} aria-label="Acercar">＋</button>
              <button onClick={resetView} aria-label={t.fit}>⌗</button>
            </div>
          </div>
          <div className={`drawing-board ${measureMode ? "measuring" : ""}`}>
            <div className="grid-overlay" />
            <svg
              ref={svgRef}
              className="cad-canvas"
              viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => { dragRef.current = null; }}
              onWheel={onWheel}
              role="img"
              aria-label={`${drawing.name}, ${drawing.layers.length} ${t.layers.toLowerCase()}`}
            >
              {visiblePrimitives.map((entity) => {
                const color = entity.color ?? drawing.layers.find((layer) => layer.name === entity.layer)?.color ?? "#ece8dd";
                if (entity.type === "polyline" && entity.points?.length) return <polyline key={entity.id} points={entity.points.map((point) => `${point.x},${sy(point.y)}`).join(" ")} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />;
                if (entity.type === "circle" && entity.center) return <circle key={entity.id} cx={entity.center.x} cy={sy(entity.center.y)} r={entity.radius ?? 1} fill="none" stroke={color} strokeWidth={strokeWidth} opacity="0.9" />;
                if (entity.type === "point" && entity.center) return <circle key={entity.id} cx={entity.center.x} cy={sy(entity.center.y)} r={strokeWidth * 2.3} fill={color} />;
                if (entity.type === "text" && entity.center) return <text key={entity.id} x={entity.center.x} y={sy(entity.center.y)} fill={color} fontSize={entity.height ?? 1} fontFamily="ui-monospace, monospace" transform={`rotate(${-(entity.rotation ?? 0)} ${entity.center.x} ${sy(entity.center.y)})`}>{entity.text}</text>;
                return null;
              })}
              {measurePoints.length > 0 && <polyline points={measurePoints.map((point) => `${point.x},${sy(point.y)}`).join(" ")} fill="none" stroke="#ffcc66" strokeWidth={strokeWidth * 2} strokeDasharray={`${strokeWidth * 5} ${strokeWidth * 3}`} />}
              {measurePoints.map((point, index) => <g key={`measure-${index}`}><circle cx={point.x} cy={sy(point.y)} r={strokeWidth * 5} fill="#121a1c" stroke="#ffcc66" strokeWidth={strokeWidth * 1.5} /><text x={point.x} y={sy(point.y) + strokeWidth * 1.8} textAnchor="middle" fill="#ffcc66" fontSize={strokeWidth * 6} fontFamily="sans-serif">{index + 1}</text></g>)}
            </svg>
            <div className="north-arrow" aria-label="Norte"><span>N</span><i>↑</i></div>
            <div className="scale-bar"><i style={{ width: `${Math.min(110, 55 * zoom)}px` }} /><span>{Math.max(1, Math.round(bounds.width / (10 * zoom)))} {drawing.unit === "metros" ? "m" : "u"}</span></div>
            {measureMode && <div className="measure-hint"><span>⌁</span>{t.measureHint}</div>}
          </div>
          <footer className="statusbar">
            <span><i className="status-dot" />{t.ready}</span>
            <span>X {viewX.toFixed(2)} · Y {(bounds.maxY - viewY).toFixed(2)}</span>
            <span>1:{Math.max(1, Math.round(100 / zoom))}</span>
          </footer>
        </section>

        <aside className={`side-panel ${activePanel ? "open" : ""}`}>
          {activePanel === "layers" && <>
            <div className="panel-heading"><div><span className="eyebrow">CONTENIDO DEL PLANO</span><h2>{t.layers}</h2></div><button className="close-panel" onClick={() => setActivePanel(null)} aria-label="Cerrar">×</button></div>
            <div className="layer-stats"><span><b>{selectedCount}</b> {t.selected}</span><i /><span><b>{visibleCount}</b> {t.visible}</span></div>
            <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} /></label>
            <div className="select-actions"><button onClick={() => selectAll(true)}>{t.all}</button><button onClick={() => selectAll(false)}>{t.none}</button></div>
            <div className="layer-list">
              {filteredLayers.map((layer) => <div className="layer-row" key={layer.name}>
                <button className={`eye-button ${layer.visible ? "visible" : ""}`} onClick={() => updateLayer(layer.name, "visible")} aria-label={`${layer.visible ? "Ocultar" : "Mostrar"} ${layer.name}`}><span /></button>
                <label><input type="checkbox" checked={layer.selected} onChange={() => updateLayer(layer.name, "selected")} /><span className="custom-check">✓</span></label>
                <span className="layer-swatch" style={{ background: layer.color }} />
                <div className="layer-name"><strong>{layer.name}</strong><small>{layer.count} entidades{layer.auxiliary ? " · auxiliar" : ""}</small></div>
              </div>)}
            </div>
            <p className="panel-help"><span>i</span>{t.layerHelp}</p>
            <div className="panel-footer"><button className="primary-button export-button" onClick={() => setExportOpen(true)} disabled={!selectedCount}><span>⇩</span>{t.export}<small>{selectedCount}</small></button></div>
          </>}
          {activePanel === "warnings" && <>
            <div className="panel-heading"><div><span className="eyebrow">CONTROL DE CALIDAD</span><h2>{t.warnings}</h2></div><button className="close-panel" onClick={() => setActivePanel(null)} aria-label="Cerrar">×</button></div>
            <div className="warning-list">{drawing.warnings.length ? drawing.warnings.map((warning, index) => <article key={index}><span>!</span><p>{warning}</p></article>) : <div className="empty-state"><span>✓</span><p>{t.noWarnings}</p></div>}</div>
          </>}
        </aside>
      </section>

      <nav className="mobile-nav" aria-label="Herramientas móviles">
        <button onClick={() => inputRef.current?.click()}><span>＋</span>{t.openShort}</button>
        <button className={activePanel === "layers" ? "active" : ""} onClick={() => setActivePanel(activePanel === "layers" ? null : "layers")}><span>▤</span>{t.layers}</button>
        <button className={measureMode ? "measure-fab active" : "measure-fab"} onClick={() => { setMeasureMode((value) => !value); setActivePanel(null); }}><span>⌁</span>{t.measure}</button>
        <button onClick={resetView}><span>⌗</span>{t.fit}</button>
        <button onClick={() => setExportOpen(true)}><span>⇩</span>{t.export}</button>
      </nav>

      {measureMode && measurePoints.length > 0 && <section className="measurement-card">
        <div><span>{t.length}</span><strong>{metrics.length.toFixed(2)} {drawing.unit === "metros" ? "m" : "u"}</strong></div>
        {measurePoints.length > 2 && <><div><span>{t.area}</span><strong>{metrics.area.toFixed(2)} {drawing.unit === "metros" ? "m²" : "u²"}</strong></div><div><span>{t.perimeter}</span><strong>{metrics.perimeter.toFixed(2)} {drawing.unit === "metros" ? "m" : "u"}</strong></div></>}
        {measurePoints.length > 1 && <div><span>{t.azimuth}</span><strong>{metrics.azimuth.toFixed(1)}°</strong></div>}
        <button onClick={() => setMeasurePoints((points) => points.slice(0, -1))}>{t.undo}</button><button onClick={() => setMeasurePoints([])}>{t.clear}</button>
      </section>}

      {exportOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setExportOpen(false); }}>
        <section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
          <div className="modal-heading"><div><span className="eyebrow">{drawing.name}</span><h2 id="export-title">{t.exportTitle}</h2></div><button onClick={() => setExportOpen(false)}>×</button></div>
          <div className="export-summary"><span className="file-stack">▧</span><div><strong>{selectedCount} {t.layers.toLowerCase()}</strong><small>{drawing.primitives.filter((entity) => drawing.layers.find((layer) => layer.name === entity.layer)?.selected).length} entidades preparadas</small></div></div>
          <fieldset><legend>{t.mode}</legend><label className={exportMode === "layers" ? "choice selected" : "choice"}><input type="radio" name="mode" checked={exportMode === "layers"} onChange={() => setExportMode("layers")} /><span className="radio-dot" /><div><strong>{t.perLayer}</strong><small>{selectedCount} × {Number(exportFormats.dxf) + Number(exportFormats.svg)} archivos</small></div></label><label className={exportMode === "filtered" ? "choice selected" : "choice"}><input type="radio" name="mode" checked={exportMode === "filtered"} onChange={() => setExportMode("filtered")} /><span className="radio-dot" /><div><strong>{t.filtered}</strong><small>Conserva juntas las capas elegidas</small></div></label></fieldset>
          <fieldset><legend>{t.output}</legend><div className="format-grid"><label className={exportFormats.dxf ? "format-choice selected" : "format-choice"}><input type="checkbox" checked={exportFormats.dxf} onChange={() => setExportFormats((value) => ({ ...value, dxf: !value.dxf }))} /><span>DXF</span><small>CAD editable</small></label><label className={exportFormats.svg ? "format-choice selected" : "format-choice"}><input type="checkbox" checked={exportFormats.svg} onChange={() => setExportFormats((value) => ({ ...value, svg: !value.svg }))} /><span>SVG</span><small>Inkscape y web</small></label></div></fieldset>
          <label className="option-line"><input type="checkbox" defaultChecked /><span className="custom-check">✓</span>{t.blocks}</label>
          <label className="option-line"><input type="checkbox" /><span className="custom-check">✓</span>{t.auxiliary}</label>
          <div className="modal-actions"><button className="secondary-button" onClick={() => setExportOpen(false)}>{t.cancel}</button><button className="primary-button" onClick={createExport} disabled={!selectedCount || (!exportFormats.dxf && !exportFormats.svg)}><span>⇩</span>{t.download}</button></div>
        </section>
      </div>}

      {dwgOpen && <div className="modal-backdrop"><section className="export-modal small-modal" role="dialog" aria-modal="true"><div className="dwg-symbol">DWG</div><h2>{t.dwgTitle}</h2><p>{t.dwgBody}</p><a className="primary-button" href="https://www.opendesign.com/guestfiles/oda_file_converter" target="_blank" rel="noreferrer">ODA File Converter</a><button className="secondary-button" onClick={() => setDwgOpen(false)}>{t.cancel}</button></section></div>}

      {draggingFile && <div className="drop-overlay"><div><span>＋</span><h2>{t.drop}</h2><p>{t.formats}</p></div></div>}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
