import type { Primitive } from "./cad-core";

export type ArchaeologySymbol = { id: string; name: string; description: string; points: { x: number; y: number }[]; closed?: boolean };

export const archaeologySymbols: ArchaeologySymbol[] = [
  { id: "stone-wall", name: "Muro / Stone wall", description: "Tramo arqueológico con remate irregular", points: [{ x: 0, y: 0 }, { x: 2, y: 0.15 }, { x: 4, y: -0.05 }, { x: 6, y: 0.1 }] },
  { id: "section-mark", name: "Sección / Section", description: "Marcador de sección", points: [{ x: 0, y: 0 }, { x: 0, y: 3 }] },
  { id: "north-arrow", name: "Norte / North", description: "Flecha de orientación", points: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: -0.8, y: 2.7 }, { x: 0, y: 4 }, { x: 0.8, y: 2.7 }] },
  { id: "cut-line", name: "Línea de corte / Cut line", description: "Línea discontinua de corte", points: [{ x: 0, y: 0 }, { x: 5, y: 0 }] },
];

export function symbolEntity(symbol: ArchaeologySymbol, layer: string, color?: string, id = `symbol-${symbol.id}-${Date.now()}`): Primitive {
  return { id, type: "polyline", layer, color, points: symbol.points, closed: symbol.closed, lineType: symbol.id === "cut-line" ? "dashed" : "continuous", lineWeight: 0.18 };
}
