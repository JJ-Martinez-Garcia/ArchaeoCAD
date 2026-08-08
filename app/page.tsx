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
import {
  Drawing,
  Point,
  getBounds,
  makeZip,
  measurement,
  parseDxf,
  parseSvg,
  safeName,
  toDxf,
  toSvg,
} from "./cad-core";
import { RasterOptions, vectorizeRaster } from "./raster-vectorizer";

const APP_VERSION = "v5";

const copy = {
  es: {
    brandTag: "DIBUJO DE CAMPO",
    open: "Abrir plano",
    openShort: "Abrir",
    vectorize: "Vectorizar imagen",
    vectorizeShort: "Imagen",
    layers: "Capas",
    measure: "Medir",
    export: "Exportar",
    warnings: "Avisos",
    fit: "Encuadrar",
    noDrawing: "Ningún plano abierto",
    noDrawingMeta: "DXF, DWG, SVG o imagen raster",
    local: "El archivo se procesa solo en este dispositivo",
    coverEyebrow: "PLANIMETRÍA ARQUEOLÓGICA",
    coverTitle: "Del terreno a un plano por capas.",
    coverBody: "Abre un DXF o SVG, o convierte un escaneado en geometría editable. Mide, revisa y prepara cada capa desde el móvil.",
    coverFormats: "DXF · SVG · PNG · JPG · WEBP",
    privateNote: "Privado por diseño: tus planos no salen del dispositivo.",
    chooseLanguage: "Idioma",
    drawing: "Plano",
    content: "CONTENIDO DEL PLANO",
    quality: "CONTROL DE CALIDAD",
    entities: "entidades",
    selected: "seleccionadas",
    visible: "visibles",
    auxiliaryLabel: "auxiliar",
    search: "Buscar capa…",
    all: "Todas",
    none: "Ninguna",
    layerHelp: "El ojo controla lo que ves. La casilla, lo que exportas.",
    noWarnings: "El plano no presenta avisos.",
    ready: "Plano listo",
    drop: "Suelta aquí tu archivo",
    dropFormats: "DXF, DWG, SVG o imagen · hasta 50 MB",
    fileError: "No se ha podido leer este archivo.",
    fileLarge: "El archivo supera el límite de 50 MB.",
    measureHint: "Toca puntos sobre el plano",
    clear: "Limpiar",
    undo: "Deshacer",
    length: "Longitud",
    perimeter: "Perímetro",
    area: "Área",
    azimuth: "Acimut",
    hide: "Ocultar",
    show: "Mostrar",
    close: "Cerrar",
    mobileTools: "Herramientas móviles",
    exportTitle: "Preparar archivos",
    organisation: "Organización",
    perLayer: "Un archivo por capa",
    filtered: "Un plano con la selección",
    keepTogether: "Conserva juntas las capas elegidas",
    files: "archivos",
    outputs: "Formatos de salida",
    editable: "CAD editable",
    inkscape: "Inkscape y web",
    blocks: "Desplegar bloques cuando sea posible",
    auxiliary: "Incluir capas auxiliares",
    download: "Crear paquete ZIP",
    cancel: "Cancelar",
    prepared: "entidades preparadas",
    generated: "archivos preparados",
    dwgTitle: "DWG necesita conversión",
    dwgBody: "En móvil, convierte primero el archivo a DXF. Así se conserva la geometría sin interpretar un formato propietario en el navegador.",
    rasterTitle: "Vectorizar imagen raster",
    rasterIntro: "Convierte líneas de un escaneado o fotografía en trazos centrales editables. El resultado siempre debe revisarse.",
    sourceImage: "IMAGEN DE ORIGEN",
    detection: "Detección",
    threshold: "Umbral de negro",
    thresholdHelp: "Sube el valor para recuperar trazos claros; bájalo para eliminar sombras.",
    simplify: "Simplificación",
    simplifyHelp: "Más simplificación produce menos puntos y líneas más limpias.",
    detail: "Nivel de detalle",
    detailHigh: "Máximo",
    detailBalanced: "Equilibrado",
    detailFast: "Rápido",
    classify: "Clasificar por tipos de línea",
    classifyHelp: "Separa estructuras, curvas de nivel, ejes, tramas, símbolos y escala en capas.",
    calibration: "Escala real (opcional)",
    realWidth: "Ancho real de la imagen",
    widthPlaceholder: "Ej. 25",
    noCalibration: "Déjalo vacío si la imagen no tiene una escala conocida.",
    detectScale: "Detectar barra gráfica",
    scaleLength: "Longitud representada",
    scaleHelp: "Si existe una barra de escala en la parte inferior, úsala para calibrar automáticamente.",
    unit: "Unidad",
    process: "Generar geometría",
    processing: "Adelgazando y siguiendo trazos…",
    rasterReady: "Imagen vectorizada",
    noLines: "No se han detectado líneas. Prueba a subir el umbral.",
    rasterFeature: "Adelgazado de trazo",
    rasterFeatureBody: "Busca el eje central para evitar las dobles líneas típicas de la vectorización por contornos.",
    footerText: "Este es un software gratuito y de libre distribución creado por José Javier Martínez.",
  },
  en: {
    brandTag: "FIELD DRAWING",
    open: "Open drawing",
    openShort: "Open",
    vectorize: "Vectorize image",
    vectorizeShort: "Image",
    layers: "Layers",
    measure: "Measure",
    export: "Export",
    warnings: "Warnings",
    fit: "Fit drawing",
    noDrawing: "No drawing open",
    noDrawingMeta: "DXF, DWG, SVG or raster image",
    local: "The file is processed only on this device",
    coverEyebrow: "ARCHAEOLOGICAL PLANIMETRY",
    coverTitle: "From the field to a layered drawing.",
    coverBody: "Open a DXF or SVG, or turn a scan into editable geometry. Measure, review and prepare every layer from your phone.",
    coverFormats: "DXF · SVG · PNG · JPG · WEBP",
    privateNote: "Private by design: your drawings never leave the device.",
    chooseLanguage: "Language",
    drawing: "Drawing",
    content: "DRAWING CONTENT",
    quality: "QUALITY CONTROL",
    entities: "entities",
    selected: "selected",
    visible: "visible",
    auxiliaryLabel: "auxiliary",
    search: "Search layer…",
    all: "All",
    none: "None",
    layerHelp: "The eye controls the view. The checkbox controls export.",
    noWarnings: "No warnings were found in this drawing.",
    ready: "Drawing ready",
    drop: "Drop your file here",
    dropFormats: "DXF, DWG, SVG or image · up to 50 MB",
    fileError: "This file could not be read.",
    fileLarge: "The file exceeds the 50 MB limit.",
    measureHint: "Tap points on the drawing",
    clear: "Clear",
    undo: "Undo",
    length: "Length",
    perimeter: "Perimeter",
    area: "Area",
    azimuth: "Azimuth",
    hide: "Hide",
    show: "Show",
    close: "Close",
    mobileTools: "Mobile tools",
    exportTitle: "Prepare files",
    organisation: "Organisation",
    perLayer: "One file per layer",
    filtered: "One drawing with selection",
    keepTogether: "Keeps the selected layers together",
    files: "files",
    outputs: "Output formats",
    editable: "Editable CAD",
    inkscape: "Inkscape and web",
    blocks: "Explode blocks when possible",
    auxiliary: "Include auxiliary layers",
    download: "Create ZIP package",
    cancel: "Cancel",
    prepared: "entities prepared",
    generated: "files prepared",
    dwgTitle: "DWG needs conversion",
    dwgBody: "On mobile, convert the file to DXF first. This preserves geometry without interpreting a proprietary format in the browser.",
    rasterTitle: "Vectorize raster image",
    rasterIntro: "Turn lines from a scan or photograph into editable centre-line paths. The result should always be reviewed.",
    sourceImage: "SOURCE IMAGE",
    detection: "Detection",
    threshold: "Black threshold",
    thresholdHelp: "Raise it to recover faint lines; lower it to remove shadows.",
    simplify: "Simplification",
    simplifyHelp: "More simplification means fewer points and cleaner lines.",
    detail: "Detail level",
    detailHigh: "Maximum",
    detailBalanced: "Balanced",
    detailFast: "Fast",
    classify: "Classify line types",
    classifyHelp: "Separates structures, contours, axes, hatching, symbols and scale into layers.",
    calibration: "Real scale (optional)",
    realWidth: "Real image width",
    widthPlaceholder: "E.g. 25",
    noCalibration: "Leave this blank if the image has no known scale.",
    detectScale: "Detect graphic scale",
    scaleLength: "Represented length",
    scaleHelp: "When a scale bar exists near the bottom, use it for automatic calibration.",
    unit: "Unit",
    process: "Generate geometry",
    processing: "Thinning and tracing lines…",
    rasterReady: "Image vectorized",
    noLines: "No lines were detected. Try raising the threshold.",
    rasterFeature: "Centre-line thinning",
    rasterFeatureBody: "Finds the centre of each stroke to avoid the double lines produced by contour tracing.",
    footerText: "This is free, freely distributable software created by José Javier Martínez.",
  },
} as const;

type RasterJob = { file: File; url: string };

function isRaster(extension?: string) {
  return ["png", "jpg", "jpeg", "webp", "bmp"].includes(extension ?? "");
}

function warningText(value: string, lang: "es" | "en") {
  if (lang === "es") return value;
  const complex = value.match(/^(\d+) entidades complejas/);
  if (complex) return `${complex[1]} complex entities are shown in simplified form; use the desktop application when the original CAD structure must be preserved.`;
  if (value.startsWith("El SVG no declara capas")) return "The SVG does not declare Inkscape layers; its groups were used as working layers.";
  if (value.startsWith("La geometría procede de una imagen")) return "This geometry was inferred from an image and should be reviewed before it is used as final documentation.";
  if (value.startsWith("Las capas se han clasificado automáticamente")) return "Layers were classified automatically using shape, continuity, orientation and density; ambiguous elements should be reviewed.";
  if (value.startsWith("Escala calibrada automáticamente")) return value.replace("Escala calibrada automáticamente con una barra gráfica de", "Scale calibrated automatically with a graphic scale of").replace("metros", "metres").replace("centímetros", "centimetres").replace("milímetros", "millimetres");
  if (value.startsWith("La imagen no se ha calibrado")) return "The image was not calibrated: measurements are shown in pixels/drawing units.";
  return value;
}

export default function ArqueoCadMobile() {
  const [lang, setLang] = useState<"es" | "en">("es");
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [activePanel, setActivePanel] = useState<"layers" | "warnings" | null>(null);
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
  const [rasterJob, setRasterJob] = useState<RasterJob | null>(null);
  const [threshold, setThreshold] = useState(165);
  const [simplify, setSimplify] = useState(0.6);
  const [detail, setDetail] = useState<RasterOptions["detail"]>(3);
  const [classifyLines, setClassifyLines] = useState(true);
  const [detectScale, setDetectScale] = useState(true);
  const [scaleBarLength, setScaleBarLength] = useState("8");
  const [realWidth, setRealWidth] = useState("");
  const [rasterUnit, setRasterUnit] = useState<RasterOptions["unit"]>("m");
  const [vectorizing, setVectorizing] = useState(false);
  const planInputRef = useRef<HTMLInputElement>(null);
  const rasterInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const t = copy[lang];

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const primitives = drawing?.primitives ?? [];
  const layers = drawing?.layers ?? [];
  const bounds = useMemo(() => getBounds(primitives), [primitives]);
  const visibleNames = useMemo(() => new Set(layers.filter((layer) => layer.visible).map((layer) => layer.name)), [layers]);
  const visiblePrimitives = useMemo(() => primitives.filter((entity) => visibleNames.has(entity.layer)), [primitives, visibleNames]);
  const selectedCount = layers.filter((layer) => layer.selected).length;
  const visibleCount = layers.filter((layer) => layer.visible).length;
  const filteredLayers = layers.filter((layer) => layer.name.toLowerCase().includes(search.toLowerCase()));
  const metrics = measurement(measurePoints);
  const viewWidth = bounds.width / zoom;
  const viewHeight = bounds.height / zoom;
  const viewX = bounds.minX + (bounds.width - viewWidth) / 2 + pan.x;
  const viewY = bounds.minY + (bounds.height - viewHeight) / 2 + pan.y;
  const sy = (value: number) => bounds.maxY - value + bounds.minY;
  const strokeWidth = Math.max(bounds.width, bounds.height) / 1200 / zoom;

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function loadDrawing(next: Drawing) {
    setDrawing(next);
    setMeasurePoints([]);
    setMeasureMode(false);
    resetView();
    setActivePanel("layers");
    setToast(`${t.ready}: ${next.layers.length} ${t.layers.toLowerCase()}`);
  }

  function openRaster(file: File) {
    if (rasterJob) URL.revokeObjectURL(rasterJob.url);
    setRasterJob({ file, url: URL.createObjectURL(file) });
    setThreshold(165);
    setSimplify(0.6);
    setDetail(3);
    setClassifyLines(true);
    setDetectScale(true);
    setScaleBarLength("8");
    setRealWidth("");
  }

  function closeRaster() {
    if (rasterJob) URL.revokeObjectURL(rasterJob.url);
    setRasterJob(null);
  }

  async function readFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (file.size > 50 * 1024 * 1024) {
      setToast(t.fileLarge);
      return;
    }
    if (isRaster(extension)) {
      openRaster(file);
      return;
    }
    if (extension === "dwg") {
      setDwgOpen(true);
      return;
    }
    try {
      const text = await file.text();
      const next = extension === "dxf" ? parseDxf(text, file.name) : extension === "svg" ? parseSvg(text, file.name) : null;
      if (!next) throw new Error("unsupported");
      loadDrawing(next);
    } catch {
      setToast(t.fileError);
    }
  }

  function onPlanInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
    event.target.value = "";
  }

  function onRasterInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) openRaster(file);
    event.target.value = "";
  }

  async function runVectorizer() {
    if (!rasterJob) return;
    setVectorizing(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const next = await vectorizeRaster(rasterJob.file, {
        threshold,
        simplify,
        realWidth: Number(realWidth) > 0 ? Number(realWidth) : null,
        unit: rasterUnit,
        detail,
        classify: classifyLines,
        scaleBarLength: detectScale && Number(scaleBarLength) > 0 ? Number(scaleBarLength) : null,
      });
      closeRaster();
      loadDrawing(next);
      setToast(`${t.rasterReady}: ${next.primitives.length} ${t.entities}`);
    } catch {
      setToast(t.noLines);
    } finally {
      setVectorizing(false);
    }
  }

  function updateLayer(name: string, field: "visible" | "selected") {
    setDrawing((current) => current ? ({ ...current, layers: current.layers.map((layer) => layer.name === name ? { ...layer, [field]: !layer[field] } : layer) }) : current);
  }

  function selectAll(selected: boolean) {
    setDrawing((current) => current ? ({ ...current, layers: current.layers.map((layer) => ({ ...layer, selected: layer.auxiliary ? false : selected })) }) : current);
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
    if (!drawing) return;
    const chosenLayers = drawing.layers.filter((layer) => layer.selected && !layer.auxiliary);
    if (!chosenLayers.length || (!exportFormats.dxf && !exportFormats.svg)) return;
    const stem = safeName(drawing.name.replace(/\.[^.]+$/, ""));
    const files: { name: string; content: string }[] = [];
    const groups = exportMode === "layers"
      ? chosenLayers.map((layer) => ({ suffix: safeName(layer.name), names: [layer.name] }))
      : [{ suffix: lang === "es" ? "seleccion" : "selection", names: chosenLayers.map((layer) => layer.name) }];
    groups.forEach((group) => {
      const names = new Set(group.names);
      const groupPrimitives = drawing.primitives.filter((entity) => names.has(entity.layer));
      if (exportFormats.svg) files.push({ name: `${stem}_${group.suffix}.svg`, content: toSvg(groupPrimitives, `${stem} · ${group.suffix}`) });
      if (exportFormats.dxf) files.push({ name: `${stem}_${group.suffix}.dxf`, content: toDxf(groupPrimitives, drawing.unit) });
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
    setToast(`${files.length} ${t.generated}`);
  }

  return (
    <main className="app-shell" onDragOver={(event) => { event.preventDefault(); setDraggingFile(true); }} onDragLeave={() => setDraggingFile(false)} onDrop={(event) => { event.preventDefault(); setDraggingFile(false); const file = event.dataTransfer.files[0]; if (file) void readFile(file); }}>
      <input ref={planInputRef} className="sr-only" type="file" accept=".dxf,.dwg,.svg" onChange={onPlanInput} />
      <input ref={rasterInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" onChange={onRasterInput} />

      <header className="topbar">
        <div className="brand-block"><div className="brand-mark" aria-hidden="true"><span>A</span></div><div><strong>ArqueoCAD</strong><small>{t.brandTag} · {APP_VERSION}</small></div></div>
        <div className="file-summary" title={drawing?.name ?? t.noDrawing}>
          <span className="format-badge">{drawing ? (drawing.format === "RASTER" ? "IMG" : drawing.format) : "—"}</span>
          <div><strong>{drawing?.name ?? t.noDrawing}</strong><small>{drawing ? `${drawing.primitives.length.toLocaleString(lang)} ${t.entities} · ${drawing.layers.length} ${t.layers.toLowerCase()} · ${drawing.unit}` : t.noDrawingMeta}</small></div>
        </div>
        <div className="top-actions">
          <span className="privacy-note"><span className="status-dot" />{t.local}</span>
          <div className="language-switch" role="group" aria-label={t.chooseLanguage}><button className={lang === "es" ? "active" : ""} onClick={() => setLang("es")} aria-pressed={lang === "es"}>ES</button><button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</button></div>
          <button className="primary-button compact" onClick={() => planInputRef.current?.click()}><span aria-hidden="true">＋</span>{t.open}</button>
        </div>
      </header>

      <section className={`workspace ${drawing ? "" : "empty-workspace"}`}>
        <nav className="tool-rail" aria-label={t.mobileTools}>
          <button onClick={() => planInputRef.current?.click()}><span className="tool-glyph">＋</span><small>{t.openShort}</small></button>
          <button onClick={() => rasterInputRef.current?.click()}><span className="tool-glyph">▧</span><small>{t.vectorizeShort}</small></button>
          <button disabled={!drawing} className={activePanel === "layers" ? "active" : ""} onClick={() => setActivePanel(activePanel === "layers" ? null : "layers")}><span className="tool-glyph layers-glyph">▤</span><small>{t.layers}</small></button>
          <button disabled={!drawing} className={measureMode ? "active" : ""} onClick={() => { setMeasureMode((current) => !current); setActivePanel(null); }}><span className="tool-glyph">⌁</span><small>{t.measure}</small></button>
          <button disabled={!drawing} className={activePanel === "warnings" ? "active" : ""} onClick={() => setActivePanel(activePanel === "warnings" ? null : "warnings")}><span className="tool-glyph warning-glyph">!</span><small>{t.warnings}</small>{Boolean(drawing?.warnings.length) && <span className="notification-count">{drawing?.warnings.length}</span>}</button>
          <div className="rail-spacer" />
          <button disabled={!drawing} onClick={resetView}><span className="tool-glyph">⌗</span><small>{t.fit}</small></button>
        </nav>

        {!drawing ? <section className="cover-area">
          <img className="cover-image" src="/og.png" alt="ArqueoCAD Mobile, planimetría de excavación" />
          <div className="cover-scrim" />
          <div className="cover-copy"><span className="eyebrow">{t.coverEyebrow}</span><h1>{t.coverTitle}</h1><p>{t.coverBody}</p><div className="cover-actions"><button className="primary-button" onClick={() => planInputRef.current?.click()}>＋ {t.open}</button><button className="cover-secondary" onClick={() => rasterInputRef.current?.click()}>▧ {t.vectorize}</button></div><small className="cover-formats">{t.coverFormats}</small><div className="cover-private"><span className="status-dot" />{t.privateNote}</div></div>
        </section> : <>
          <section className="canvas-area" aria-label={t.drawing}>
            <div className="canvas-toolbar"><div className="crumb"><span>{t.drawing}</span><b>/</b><strong>{drawing.name.replace(/\.[^.]+$/, "")}</strong></div><div className="view-controls"><button onClick={() => setZoom((value) => Math.max(0.65, value / 1.2))} aria-label="Zoom out">−</button><output>{Math.round(zoom * 100)}%</output><button onClick={() => setZoom((value) => Math.min(10, value * 1.2))} aria-label="Zoom in">＋</button><button onClick={resetView} aria-label={t.fit}>⌗</button></div></div>
            <div className={`drawing-board ${measureMode ? "measuring" : ""}`}><div className="grid-overlay" /><svg ref={svgRef} className="cad-canvas" viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid meet" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null; }} onWheel={onWheel} role="img" aria-label={`${drawing.name}, ${drawing.layers.length} ${t.layers.toLowerCase()}`}>
              {visiblePrimitives.map((entity) => {
                const color = entity.color ?? drawing.layers.find((layer) => layer.name === entity.layer)?.color ?? "#ece8dd";
                const dash = entity.lineType === "dashed" ? `${strokeWidth * 8} ${strokeWidth * 5}` : undefined;
                if (entity.type === "polyline" && entity.points?.length) return <polyline key={entity.id} points={entity.points.map((point) => `${point.x},${sy(point.y)}`).join(" ")} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />;
                if (entity.type === "circle" && entity.center) return <circle key={entity.id} cx={entity.center.x} cy={sy(entity.center.y)} r={entity.radius ?? 1} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={dash} opacity="0.9" />;
                if (entity.type === "point" && entity.center) return <circle key={entity.id} cx={entity.center.x} cy={sy(entity.center.y)} r={strokeWidth * 2.3} fill={color} />;
                if (entity.type === "text" && entity.center) return <text key={entity.id} x={entity.center.x} y={sy(entity.center.y)} fill={color} fontSize={entity.height ?? 1} fontFamily="ui-monospace, monospace" transform={`rotate(${-(entity.rotation ?? 0)} ${entity.center.x} ${sy(entity.center.y)})`}>{entity.text}</text>;
                return null;
              })}
              {measurePoints.length > 0 && <polyline points={measurePoints.map((point) => `${point.x},${sy(point.y)}`).join(" ")} fill="none" stroke="#ffcc66" strokeWidth={strokeWidth * 2} strokeDasharray={`${strokeWidth * 5} ${strokeWidth * 3}`} />}
              {measurePoints.map((point, index) => <g key={`measure-${index}`}><circle cx={point.x} cy={sy(point.y)} r={strokeWidth * 5} fill="#121a1c" stroke="#ffcc66" strokeWidth={strokeWidth * 1.5} /><text x={point.x} y={sy(point.y) + strokeWidth * 1.8} textAnchor="middle" fill="#ffcc66" fontSize={strokeWidth * 6}>{index + 1}</text></g>)}
            </svg><div className="north-arrow" aria-label="North"><span>N</span><i>↑</i></div><div className="scale-bar"><i style={{ width: `${Math.min(110, 55 * zoom)}px` }} /><span>{Math.max(1, Math.round(bounds.width / (10 * zoom)))} {drawing.unit === "metros" ? "m" : "u"}</span></div>{measureMode && <div className="measure-hint"><span>⌁</span>{t.measureHint}</div>}</div>
            <footer className="statusbar"><span><i className="status-dot" />{t.ready}</span><span>X {viewX.toFixed(2)} · Y {(bounds.maxY - viewY).toFixed(2)}</span><span>1:{Math.max(1, Math.round(100 / zoom))}</span></footer>
          </section>

          <aside className={`side-panel ${activePanel ? "open" : ""}`}>
            {activePanel === "layers" && <><div className="panel-heading"><div><span className="eyebrow">{t.content}</span><h2>{t.layers}</h2></div><button className="close-panel" onClick={() => setActivePanel(null)} aria-label={t.close}>×</button></div><div className="layer-stats"><span><b>{selectedCount}</b> {t.selected}</span><i /><span><b>{visibleCount}</b> {t.visible}</span></div><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} /></label><div className="select-actions"><button onClick={() => selectAll(true)}>{t.all}</button><button onClick={() => selectAll(false)}>{t.none}</button></div><div className="layer-list">{filteredLayers.map((layer) => <div className="layer-row" key={layer.name}><button className={`eye-button ${layer.visible ? "visible" : ""}`} onClick={() => updateLayer(layer.name, "visible")} aria-label={`${layer.visible ? t.hide : t.show} ${layer.name}`}><span /></button><label><input type="checkbox" checked={layer.selected} onChange={() => updateLayer(layer.name, "selected")} /><span className="custom-check">✓</span></label><span className="layer-swatch" style={{ background: layer.color }} /><div className="layer-name"><strong>{layer.name}</strong><small>{layer.count} {t.entities}{layer.auxiliary ? ` · ${t.auxiliaryLabel}` : ""}</small></div></div>)}</div><p className="panel-help"><span>i</span>{t.layerHelp}</p><div className="panel-footer"><button className="primary-button export-button" onClick={() => setExportOpen(true)} disabled={!selectedCount}><span>⇩</span>{t.export}<small>{selectedCount}</small></button></div></>}
            {activePanel === "warnings" && <><div className="panel-heading"><div><span className="eyebrow">{t.quality}</span><h2>{t.warnings}</h2></div><button className="close-panel" onClick={() => setActivePanel(null)} aria-label={t.close}>×</button></div><div className="warning-list">{drawing.warnings.length ? drawing.warnings.map((warning, index) => <article key={index}><span>!</span><p>{warningText(warning, lang)}</p></article>) : <div className="empty-state"><span>✓</span><p>{t.noWarnings}</p></div>}</div></>}
          </aside>
        </>}
      </section>

      <footer className="license-footer"><span>{t.footerText}</span><a href="https://josejaviermartinez.com/" target="_blank" rel="noreferrer">josejaviermartinez.com</a></footer>

      <nav className="mobile-nav" aria-label={t.mobileTools}><button onClick={() => planInputRef.current?.click()}><span>＋</span>{t.openShort}</button><button onClick={() => rasterInputRef.current?.click()}><span>▧</span>{t.vectorizeShort}</button><button disabled={!drawing} className={activePanel === "layers" ? "active" : ""} onClick={() => setActivePanel(activePanel === "layers" ? null : "layers")}><span>▤</span>{t.layers}</button><button disabled={!drawing} className={measureMode ? "measure-fab active" : "measure-fab"} onClick={() => { setMeasureMode((value) => !value); setActivePanel(null); }}><span>⌁</span>{t.measure}</button><button disabled={!drawing} onClick={() => setActivePanel(activePanel === "warnings" ? null : "warnings")}><span>!</span>{t.warnings}</button><button disabled={!drawing} onClick={() => setExportOpen(true)}><span>⇩</span>{t.export}</button></nav>

      {drawing && measureMode && measurePoints.length > 0 && <section className="measurement-card"><div><span>{t.length}</span><strong>{metrics.length.toFixed(2)} {drawing.unit === "metros" ? "m" : "u"}</strong></div>{measurePoints.length > 2 && <><div><span>{t.area}</span><strong>{metrics.area.toFixed(2)} {drawing.unit === "metros" ? "m²" : "u²"}</strong></div><div><span>{t.perimeter}</span><strong>{metrics.perimeter.toFixed(2)} {drawing.unit === "metros" ? "m" : "u"}</strong></div></>}{measurePoints.length > 1 && <div><span>{t.azimuth}</span><strong>{metrics.azimuth.toFixed(1)}°</strong></div>}<button onClick={() => setMeasurePoints((points) => points.slice(0, -1))}>{t.undo}</button><button onClick={() => setMeasurePoints([])}>{t.clear}</button></section>}

      {exportOpen && drawing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setExportOpen(false); }}><section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title"><div className="modal-heading"><div><span className="eyebrow">{drawing.name}</span><h2 id="export-title">{t.exportTitle}</h2></div><button onClick={() => setExportOpen(false)} aria-label={t.close}>×</button></div><div className="export-summary"><span className="file-stack">▧</span><div><strong>{selectedCount} {t.layers.toLowerCase()}</strong><small>{drawing.primitives.filter((entity) => drawing.layers.find((layer) => layer.name === entity.layer)?.selected).length} {t.prepared}</small></div></div><fieldset><legend>{t.organisation}</legend><label className={exportMode === "layers" ? "choice selected" : "choice"}><input type="radio" name="mode" checked={exportMode === "layers"} onChange={() => setExportMode("layers")} /><span className="radio-dot" /><div><strong>{t.perLayer}</strong><small>{selectedCount} × {Number(exportFormats.dxf) + Number(exportFormats.svg)} {t.files}</small></div></label><label className={exportMode === "filtered" ? "choice selected" : "choice"}><input type="radio" name="mode" checked={exportMode === "filtered"} onChange={() => setExportMode("filtered")} /><span className="radio-dot" /><div><strong>{t.filtered}</strong><small>{t.keepTogether}</small></div></label></fieldset><fieldset><legend>{t.outputs}</legend><div className="format-grid"><label className={exportFormats.dxf ? "format-choice selected" : "format-choice"}><input type="checkbox" checked={exportFormats.dxf} onChange={() => setExportFormats((value) => ({ ...value, dxf: !value.dxf }))} /><span>DXF</span><small>{t.editable}</small></label><label className={exportFormats.svg ? "format-choice selected" : "format-choice"}><input type="checkbox" checked={exportFormats.svg} onChange={() => setExportFormats((value) => ({ ...value, svg: !value.svg }))} /><span>SVG</span><small>{t.inkscape}</small></label></div></fieldset><label className="option-line"><input type="checkbox" defaultChecked /><span className="custom-check">✓</span>{t.blocks}</label><label className="option-line"><input type="checkbox" /><span className="custom-check">✓</span>{t.auxiliary}</label><div className="modal-actions"><button className="secondary-button" onClick={() => setExportOpen(false)}>{t.cancel}</button><button className="primary-button" onClick={createExport} disabled={!selectedCount || (!exportFormats.dxf && !exportFormats.svg)}><span>⇩</span>{t.download}</button></div></section></div>}

      {rasterJob && <div className="modal-backdrop"><section className="raster-modal" role="dialog" aria-modal="true" aria-labelledby="raster-title"><div className="modal-heading"><div><span className="eyebrow">{rasterJob.file.name}</span><h2 id="raster-title">{t.rasterTitle}</h2></div><button onClick={closeRaster} aria-label={t.close}>×</button></div><p className="raster-intro">{t.rasterIntro}</p><div className="raster-layout"><div><span className="field-label">{t.sourceImage}</span><div className="raster-preview"><img src={rasterJob.url} alt={rasterJob.file.name} style={{ filter: `grayscale(1) contrast(${1 + threshold / 90})` }} /><span>{t.rasterFeature}</span></div><div className="raster-feature"><b>⌁</b><p><strong>{t.rasterFeature}</strong>{t.rasterFeatureBody}</p></div></div><div className="raster-controls"><fieldset><legend>{t.detection}</legend><label className="range-field"><span><b>{t.threshold}</b><output>{threshold}</output></span><input type="range" min="70" max="230" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /><small>{t.thresholdHelp}</small></label><label className="range-field"><span><b>{t.simplify}</b><output>{simplify.toFixed(1)}</output></span><input type="range" min="0.2" max="3" step="0.2" value={simplify} onChange={(event) => setSimplify(Number(event.target.value))} /><small>{t.simplifyHelp}</small></label><label className="select-field"><span>{t.detail}</span><select value={detail} onChange={(event) => setDetail(Number(event.target.value) as RasterOptions["detail"])}><option value="3">{t.detailHigh}</option><option value="2">{t.detailBalanced}</option><option value="1">{t.detailFast}</option></select></label><label className="option-line raster-option"><input type="checkbox" checked={classifyLines} onChange={() => setClassifyLines((value) => !value)} /><span className="custom-check">✓</span><span><b>{t.classify}</b><small>{t.classifyHelp}</small></span></label></fieldset><fieldset><legend>{t.calibration}</legend><div className="calibration-grid"><label><span>{t.realWidth}</span><input type="number" min="0" step="any" value={realWidth} onChange={(event) => setRealWidth(event.target.value)} placeholder={t.widthPlaceholder} /></label><label><span>{t.unit}</span><select value={rasterUnit} onChange={(event) => setRasterUnit(event.target.value as RasterOptions["unit"])}><option value="m">m</option><option value="cm">cm</option><option value="mm">mm</option><option value="unit">u</option></select></label></div><small>{t.noCalibration}</small><label className="option-line raster-option"><input type="checkbox" checked={detectScale} onChange={() => setDetectScale((value) => !value)} /><span className="custom-check">✓</span><span><b>{t.detectScale}</b><small>{t.scaleHelp}</small></span></label>{detectScale && <div className="calibration-grid"><label><span>{t.scaleLength}</span><input type="number" min="0" step="any" value={scaleBarLength} onChange={(event) => setScaleBarLength(event.target.value)} /></label><label><span>{t.unit}</span><output className="unit-output">{rasterUnit === "unit" ? "u" : rasterUnit}</output></label></div>}</fieldset></div></div><div className="modal-actions"><button className="secondary-button" onClick={closeRaster} disabled={vectorizing}>{t.cancel}</button><button className="primary-button" onClick={() => void runVectorizer()} disabled={vectorizing}>{vectorizing ? <><span className="spinner" />{t.processing}</> : <>⌁ {t.process}</>}</button></div></section></div>}

      {dwgOpen && <div className="modal-backdrop"><section className="export-modal small-modal" role="dialog" aria-modal="true"><div className="dwg-symbol">DWG</div><h2>{t.dwgTitle}</h2><p>{t.dwgBody}</p><a className="primary-button" href="https://www.opendesign.com/guestfiles/oda_file_converter" target="_blank" rel="noreferrer">ODA File Converter</a><button className="secondary-button" onClick={() => setDwgOpen(false)}>{t.cancel}</button></section></div>}
      {draggingFile && <div className="drop-overlay"><div><span>＋</span><h2>{t.drop}</h2><p>{t.dropFormats}</p></div></div>}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
