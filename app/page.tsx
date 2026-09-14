"use client";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Drawing,
  Primitive,
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
import { mirror as mirrorEntity, offsetPolyline, rotate as rotateEntity, scale as scaleEntity, translate as translateEntity } from "./geometry-kernel";
import { archaeologySymbols, symbolEntity } from "./symbol-library";
import { extrudePrimitive, projectIsometric } from "./solid-kernel";
import { convertDwgToDxf, dwgBridge, inspectDwg } from "./dwg-bridge";
import { freehandOutline, unionPolygons, textOutline } from "./external-vector-tools";

const APP_VERSION = "v58";

type VectorCategory = "draw" | "modify" | "geometry" | "precision" | "organize";
type VectorTool = "select" | "point" | "line" | "polyline" | "polygon" | "rectangle" | "circle" | "arc" | "move" | "copy" | "rotate" | "scale" | "mirror" | "offset" | "vertices" | "trim" | "extend" | "split" | "join" | "explode" | "snap" | "ortho" | "grid" | "coordinates" | "layers" | "properties" | "order";

const vectorToolsCopy = {
  es: {
    title: "Edición vectorial",
    draw: "Dibujo",
    modify: "Modificar",
    geometry: "Editar geometría",
    precision: "Precisión",
    organize: "Organización",
    select: "Seleccionar",
    point: "Punto",
    line: "Línea",
    polyline: "Polilínea",
    polygon: "Polígono",
    rectangle: "Rectángulo",
    circle: "Círculo",
    arc: "Arco",
    move: "Mover",
    copy: "Copiar",
    rotate: "Rotar",
    scale: "Escalar",
    mirror: "Espejo",
    offset: "Offset",
    vertices: "Vértices",
    trim: "Recortar",
    extend: "Extender",
    split: "Partir",
    join: "Unir",
    explode: "Explotar",
    snap: "Snap",
    ortho: "Orto",
    grid: "Rejilla",
    coordinates: "Coordenadas",
    properties: "Propiedades",
    order: "Orden de dibujo",
    hint: "Selecciona una entidad y elige una herramienta",
    selected: "seleccionadas",
    ready: "Herramienta activa",
  },
  en: {
    title: "Vector editing",
    draw: "Draw",
    modify: "Modify",
    geometry: "Edit geometry",
    precision: "Precision",
    organize: "Organisation",
    select: "Select",
    point: "Point",
    line: "Line",
    polyline: "Polyline",
    polygon: "Polygon",
    rectangle: "Rectangle",
    circle: "Circle",
    arc: "Arc",
    move: "Move",
    copy: "Copy",
    rotate: "Rotate",
    scale: "Scale",
    mirror: "Mirror",
    offset: "Offset",
    vertices: "Vertices",
    trim: "Trim",
    extend: "Extend",
    split: "Split",
    join: "Join",
    explode: "Explode",
    snap: "Snap",
    ortho: "Ortho",
    grid: "Grid",
    coordinates: "Coordinates",
    properties: "Properties",
    order: "Draw order",
    hint: "Select an entity and choose a tool",
    selected: "selected",
    ready: "Active tool",
  },
} as const;

const vectorLocaleOverrides: Partial<Record<Lang, Partial<typeof vectorToolsCopy.es>>> = {
  fr: { title: "Édition vectorielle", draw: "Dessin", modify: "Modifier", geometry: "Géométrie", precision: "Précision", organize: "Organisation", select: "Sélectionner", point: "Point", line: "Ligne", polyline: "Polyligne", polygon: "Polygone", rectangle: "Rectangle", circle: "Cercle", arc: "Arc", move: "Déplacer", copy: "Copier", rotate: "Pivoter", scale: "Échelle", mirror: "Miroir", vertices: "Sommets", trim: "Rogner", extend: "Prolonger", split: "Scinder", join: "Joindre", explode: "Décomposer", properties: "Propriétés", order: "Ordre de dessin", hint: "Sélectionnez une entité et choisissez un outil", selected: "sélectionnées", ready: "Outil actif" },
  de: { title: "Vektorbearbeitung", draw: "Zeichnen", modify: "Ändern", geometry: "Geometrie bearbeiten", precision: "Präzision", organize: "Organisation", select: "Auswählen", point: "Punkt", line: "Linie", polyline: "Polylinie", polygon: "Polygon", rectangle: "Rechteck", circle: "Kreis", arc: "Bogen", move: "Verschieben", copy: "Kopieren", rotate: "Drehen", scale: "Skalieren", mirror: "Spiegeln", vertices: "Eckpunkte", trim: "Trimmen", extend: "Verlängern", split: "Teilen", join: "Verbinden", explode: "Auflösen", properties: "Eigenschaften", order: "Zeichenreihenfolge", hint: "Entität auswählen und Werkzeug wählen", selected: "ausgewählt", ready: "Aktives Werkzeug" },
  it: { title: "Modifica vettoriale", draw: "Disegno", modify: "Modifica", geometry: "Modifica geometria", precision: "Precisione", organize: "Organizzazione", select: "Seleziona", point: "Punto", line: "Linea", polyline: "Polilinea", polygon: "Poligono", rectangle: "Rettangolo", circle: "Cerchio", arc: "Arco", move: "Sposta", copy: "Copia", rotate: "Ruota", scale: "Scala", mirror: "Specchia", vertices: "Vertici", trim: "Taglia", extend: "Estendi", split: "Dividi", join: "Unisci", explode: "Esplodi", properties: "Proprietà", order: "Ordine di disegno", hint: "Seleziona un'entità e scegli uno strumento", selected: "selezionate", ready: "Strumento attivo" },
  pt: { title: "Edição vetorial", draw: "Desenho", modify: "Modificar", geometry: "Editar geometria", precision: "Precisão", organize: "Organização", select: "Selecionar", point: "Ponto", line: "Linha", polyline: "Polilinha", polygon: "Polígono", rectangle: "Retângulo", circle: "Círculo", arc: "Arco", move: "Mover", copy: "Copiar", rotate: "Rodar", scale: "Escalar", mirror: "Espelhar", vertices: "Vértices", trim: "Aparar", extend: "Estender", split: "Dividir", join: "Unir", explode: "Explodir", properties: "Propriedades", order: "Ordem de desenho", hint: "Selecione uma entidade e escolha uma ferramenta", selected: "selecionadas", ready: "Ferramenta ativa" },
  ar: { title: "تحرير المتجهات", draw: "رسم", modify: "تعديل", geometry: "تحرير الهندسة", precision: "دقة", organize: "تنظيم", select: "تحديد", point: "نقطة", line: "خط", polyline: "خط متعدد", polygon: "مضلع", rectangle: "مستطيل", circle: "دائرة", arc: "قوس", move: "نقل", copy: "نسخ", rotate: "تدوير", scale: "تحجيم", mirror: "انعكاس", vertices: "رؤوس", trim: "قص", extend: "تمديد", split: "تقسيم", join: "ضم", explode: "تفكيك", properties: "خصائص", order: "ترتيب الرسم", hint: "حدد عنصراً واختر أداة", selected: "محددة", ready: "الأداة النشطة" },
  zh: { title: "矢量编辑", draw: "绘图", modify: "修改", geometry: "编辑几何图形", precision: "精度", organize: "组织", select: "选择", point: "点", line: "线", polyline: "折线", polygon: "多边形", rectangle: "矩形", circle: "圆", arc: "弧", move: "移动", copy: "复制", rotate: "旋转", scale: "缩放", mirror: "镜像", vertices: "顶点", trim: "修剪", extend: "延伸", split: "分割", join: "合并", explode: "分解", properties: "属性", order: "绘图顺序", hint: "选择对象并选择工具", selected: "已选择", ready: "当前工具" },
  hi: { title: "वेक्टर संपादन", draw: "ड्रॉ", modify: "संशोधित करें", geometry: "ज्यामिति संपादित करें", precision: "सटीकता", organize: "संगठन", select: "चुनें", point: "बिंदु", line: "रेखा", polyline: "पॉलीलाइन", polygon: "बहुभुज", rectangle: "आयत", circle: "वृत्त", arc: "चाप", move: "स्थानांतरित करें", copy: "कॉपी", rotate: "घुमाएँ", scale: "स्केल", mirror: "मिरर", vertices: "शीर्ष", trim: "ट्रिम", extend: "बढ़ाएँ", split: "विभाजित करें", join: "जोड़ें", explode: "विस्फोटित करें", properties: "गुण", order: "ड्रॉ क्रम", hint: "इकाई चुनें और उपकरण चुनें", selected: "चयनित", ready: "सक्रिय उपकरण" },
  ru: { title: "Векторное редактирование", draw: "Рисование", modify: "Изменить", geometry: "Правка геометрии", precision: "Точность", organize: "Организация", select: "Выбрать", point: "Точка", line: "Линия", polyline: "Полилиния", polygon: "Многоугольник", rectangle: "Прямоугольник", circle: "Круг", arc: "Дуга", move: "Переместить", copy: "Копировать", rotate: "Повернуть", scale: "Масштаб", mirror: "Зеркало", vertices: "Вершины", trim: "Обрезать", extend: "Продлить", split: "Разделить", join: "Объединить", explode: "Разбить", properties: "Свойства", order: "Порядок отрисовки", hint: "Выберите объект и инструмент", selected: "выбрано", ready: "Активный инструмент" },
  ja: { title: "ベクトル編集", draw: "描画", modify: "変更", geometry: "ジオメトリ編集", precision: "精度", organize: "整理", select: "選択", point: "点", line: "線", polyline: "ポリライン", polygon: "ポリゴン", rectangle: "長方形", circle: "円", arc: "円弧", move: "移動", copy: "コピー", rotate: "回転", scale: "拡大縮小", mirror: "ミラー", vertices: "頂点", trim: "トリム", extend: "延長", split: "分割", join: "結合", explode: "分解", properties: "プロパティ", order: "描画順序", hint: "エンティティとツールを選択", selected: "選択済み", ready: "アクティブなツール" },
};

const vectorTermOverrides: Partial<Record<Lang, Partial<typeof vectorToolsCopy.es>>> = {
  fr: { offset: "Décalage", snap: "Accrochage", ortho: "Ortho", grid: "Grille", coordinates: "Coordonnées", layers: "Calques" },
  de: { offset: "Versatz", snap: "Fangmodus", ortho: "Ortho", grid: "Raster", coordinates: "Koordinaten", layers: "Ebenen" },
  it: { offset: "Offset", snap: "Aggancio", ortho: "Orto", grid: "Griglia", coordinates: "Coordinate", layers: "Livelli" },
  pt: { offset: "Deslocamento", snap: "Snap", ortho: "Orto", grid: "Grelha", coordinates: "Coordenadas", layers: "Camadas" },
  ar: { offset: "إزاحة", snap: "التقاط", ortho: "متعامد", grid: "شبكة", coordinates: "إحداثيات", layers: "طبقات" },
  zh: { offset: "偏移", snap: "捕捉", ortho: "正交", grid: "网格", coordinates: "坐标", layers: "图层" },
  hi: { offset: "ऑफसेट", snap: "स्नैप", ortho: "ऑर्थो", grid: "ग्रिड", coordinates: "निर्देशांक", layers: "लेयर" },
  ru: { offset: "Смещение", snap: "Привязка", ortho: "Орто", grid: "Сетка", coordinates: "Координаты", layers: "Слои" },
  ja: { offset: "オフセット", snap: "スナップ", ortho: "直交", grid: "グリッド", coordinates: "座標", layers: "レイヤー" },
};

const vectorCategoryTools: Record<VectorCategory, VectorTool[]> = {
  draw: ["select", "point", "line", "polyline", "polygon", "rectangle", "circle", "arc"],
  modify: ["move", "copy", "rotate", "scale", "mirror", "offset"],
  geometry: ["vertices", "trim", "extend", "split", "join", "explode"],
  precision: ["snap", "ortho", "grid", "coordinates"],
  organize: ["layers", "properties", "order"],
};

const vectorToolIcons: Record<VectorTool, string> = {
  select: "⌁", point: "·", line: "╱", polyline: "⌁", polygon: "⬠", rectangle: "□", circle: "○", arc: "⌒",
  move: "✥", copy: "＋", rotate: "↻", scale: "↗", mirror: "⇋", offset: "▱", vertices: "◇", trim: "⌫", extend: "↔", split: "┆", join: "∪", explode: "✣",
  snap: "⊙", ortho: "⊥", grid: "▦", coordinates: "⌖", layers: "▤", properties: "☷", order: "⇅",
};

type Lang = "es" | "en" | "ar" | "fr" | "de" | "it" | "pt" | "zh" | "hi" | "ru" | "ja";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type DeviceFileHandle = { createWritable: () => Promise<{ write: (value: string) => Promise<void>; close: () => Promise<void> }> };
type DeviceDirectoryHandle = { getFileHandle: (name: string, options?: { create?: boolean }) => Promise<DeviceFileHandle> };

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "readwrite" }) => Promise<DeviceDirectoryHandle>;
  }
}

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
    rasterIntro: "Convierte líneas de un escaneado o fotografía en trazos centrales editables y reconoce textos con OCR. El resultado siempre debe revisarse.",
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
    classifyHelp: "Separa estructuras, curvas de nivel, ejes, tramas, símbolos, textos y marco; el OCR añade palabras y cotas editables.",
    ocr: "Reconocer textos (OCR)",
    ocrHelp: "Detecta palabras, letras y cotas y las añade como texto editable en su propia capa.",
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
    rasterFeatureBody: "VTracer WebAssembly suaviza y simplifica los trazos localmente; revisa el resultado antes de exportar.",
    install: "Instalar",
    installTitle: "Instala ArqueoCAD",
    installBody: "Úsala como una app independiente, con acceso desde la pantalla de inicio y funcionamiento sin conexión para los archivos ya cargados.",
    installIos: "Abre esta página en Safari —no dentro de ChatGPT—, pulsa Compartir y después «Añadir a pantalla de inicio».",
    installManual: "Abre esta página en Chrome —no dentro de ChatGPT— y elige «Instalar aplicación» en el menú del navegador.",
    installNow: "Instalar ahora",
    installLater: "Ahora no",
    understood: "Entendido",
    help: "Ayuda",
    helpTitle: "Manual de ArqueoCAD Mobile",
    helpIntro: "Una guía rápida para abrir, revisar, medir y convertir tus planos arqueológicos desde el móvil.",
    helpOpenTitle: "1 · Abrir un plano",
    helpOpenBody: "Pulsa Abrir en la barra lateral y selecciona un archivo DXF, DWG o SVG. El plano se procesa en este dispositivo; no se sube a ningún servidor.",
    helpRasterTitle: "2 · Vectorizar una imagen",
    helpRasterBody: "Pulsa Imagen para cargar PNG, JPG, WEBP o BMP. Ajusta el umbral y el detalle, mantén la clasificación automática y usa la barra gráfica para calibrar el dibujo.",
    helpLayersTitle: "3 · Revisar capas",
    helpLayersBody: "En Capas puedes ocultar elementos con el ojo, decidir qué se exporta con la casilla y buscar una capa por nombre. Las capas se clasifican automáticamente por geometría.",
    helpMeasureTitle: "4 · Medir",
    helpMeasureBody: "Activa Medir y toca varios puntos sobre el plano. Verás longitud, perímetro, área y acimut. Usa Deshacer o Limpiar para empezar de nuevo.",
    helpExportTitle: "5 · Exportar",
    helpExportBody: "En Exportar elige un archivo por capa o un plano con la selección. Puedes crear un ZIP con DXF editable y SVG para Inkscape o la web.",
    helpInstallTitle: "6 · Instalar como app",
    helpInstallBody: "En Android usa Chrome → Instalar aplicación. En iPhone abre la página en Safari → Compartir → Añadir a pantalla de inicio. No la instales desde el navegador interno de ChatGPT.",
    helpTipsTitle: "Consejos de calidad",
    helpTipsBody: "La vectorización es semiautomática: revisa trazos, textos y capas antes de usar el resultado como documentación definitiva. Para conservar bloques y estructuras CAD originales, trabaja con el DXF de origen.",
    helpCreditsTitle: "Créditos, código fuente y licencias",
    helpCreditsBody: "ArqueoCAD Mobile parte del proyecto original de José Javier Martínez publicado en GitHub y se distribuye bajo GPL-3.0. La interfaz usa React, Vinext y Vite (MIT). Para futuras mejoras de vectorización se han revisado AutoTrace (GPL-2.0/LGPL-2.1), VTracer (MIT) y Trazor (MIT). Consulta siempre la licencia completa antes de incorporar código.",
    footerText: "Este es un software gratuito y de libre distribución creado por José Javier Martínez para el ",
    about: "Acerca de",
    aboutTitle: "Acerca de ArqueoCAD",
    aboutBodyPrefix: "Esta aplicación forma parte del",
    aboutBodySuffix: "de José Javier Martínez García",
    reviewTitle: "Revisión sugerida",
    reviewHelp: "Estas entidades tienen menor confianza. Puedes cambiar su capa aquí y exportar la corrección.",
    reviewTarget: "Mover a capa",
    confidenceLabel: "confianza",
    projects: "Proyectos creados",
    noProjects: "Todavía no hay proyectos guardados en este dispositivo.",
    deleteProject: "Borrar proyecto",
    openProject: "Abrir proyecto",
    projectUnavailable: "Este proyecto antiguo solo tiene el registro; vuelve a cargar el archivo original.",
    saveProject: "Guardar proyecto",
    saveProjectFolder: "Guardar en carpeta",
    savedProject: "Proyecto guardado en el dispositivo",
    saveCancelled: "Guardado cancelado",
    switchProject: "Cambiar proyecto",
    hideTools: "Ocultar herramientas",
    showTools: "Mostrar herramientas",
    zoomOut: "Alejar",
    zoomIn: "Acercar",
    north: "Norte",
    draftHint: "puntos · doble clic para terminar la polilínea",
    home: "ArchaeoCAD — portada",
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
    rasterIntro: "Turn lines from a scan or photograph into editable centre-line paths and recognise text with OCR. The result should always be reviewed.",
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
    classifyHelp: "Separates structures, contours, axes, hatching, symbols, text and frame; OCR adds editable labels and dimensions.",
    ocr: "Recognize text (OCR)",
    ocrHelp: "Detects words, labels and dimensions and adds them as editable text in their own layer.",
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
    rasterFeatureBody: "VTracer WebAssembly smooths and simplifies strokes locally; review the result before exporting.",
    install: "Install",
    installTitle: "Install ArqueoCAD",
    installBody: "Use it as a standalone app, open it from your home screen and keep access to previously loaded files while offline.",
    installIos: "Open this page in Safari—not inside ChatGPT—then tap Share and “Add to Home Screen”.",
    installManual: "Open this page in Chrome—not inside ChatGPT—and choose “Install app” from the browser menu.",
    installNow: "Install now",
    installLater: "Not now",
    understood: "Got it",
    help: "Help",
    helpTitle: "ArqueoCAD Mobile guide",
    helpIntro: "A quick guide to opening, reviewing, measuring and converting archaeological drawings on your phone.",
    helpOpenTitle: "1 · Open a drawing",
    helpOpenBody: "Tap Open in the side rail and select a DXF, DWG or SVG file. The drawing is processed on this device and is never uploaded to a server.",
    helpRasterTitle: "2 · Vectorize an image",
    helpRasterBody: "Tap Image to load PNG, JPG, WEBP or BMP. Adjust threshold and detail, keep automatic classification enabled and use the graphic scale to calibrate the drawing.",
    helpLayersTitle: "3 · Review layers",
    helpLayersBody: "In Layers, hide elements with the eye, choose what is exported with the checkbox and search by layer name. Layers are classified automatically from their geometry.",
    helpMeasureTitle: "4 · Measure",
    helpMeasureBody: "Turn on Measure and tap several points on the drawing. You will see length, perimeter, area and azimuth. Use Undo or Clear to start again.",
    helpExportTitle: "5 · Export",
    helpExportBody: "In Export, choose one file per layer or a drawing with the current selection. You can create a ZIP containing editable DXF and SVG for Inkscape or the web.",
    helpInstallTitle: "6 · Install as an app",
    helpInstallBody: "On Android use Chrome → Install app. On iPhone open the page in Safari → Share → Add to Home Screen. Do not install it from ChatGPT's in-app browser.",
    helpTipsTitle: "Quality tips",
    helpTipsBody: "Vectorization is semi-automatic: review strokes, text and layers before using the result as final documentation. To preserve original CAD blocks and structures, work from the source DXF.",
    helpCreditsTitle: "Credits, source code and licences",
    helpCreditsBody: "ArqueoCAD Mobile builds on José Javier Martínez’s original project published on GitHub and is distributed under GPL-3.0. The interface uses React, Vinext and Vite (MIT). For future vectorization improvements we reviewed AutoTrace (GPL-2.0/LGPL-2.1), VTracer (MIT) and Trazor (MIT). Always read the complete licence before incorporating code.",
    footerText: "This is free, freely distributable software created by José Javier Martínez for the ",
    about: "About",
    aboutTitle: "About ArqueoCAD",
    aboutBodyPrefix: "This application is part of",
    aboutBodySuffix: "by José Javier Martínez García",
    reviewTitle: "Suggested review",
    reviewHelp: "These entities have lower confidence. Change their layer here and export the correction.",
    reviewTarget: "Move to layer",
    confidenceLabel: "confidence",
    projects: "Created projects",
    noProjects: "No projects have been saved on this device yet.",
    deleteProject: "Delete project",
    openProject: "Open project",
    projectUnavailable: "This older project only has its listing; load the original file again.",
    saveProject: "Save project",
    saveProjectFolder: "Save to folder",
    savedProject: "Project saved on this device",
    saveCancelled: "Save cancelled",
    switchProject: "Switch project",
    hideTools: "Hide tools",
    showTools: "Show tools",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    north: "North",
    draftHint: "points · double-click to finish the polyline",
    home: "ArchaeoCAD — cover",
  },
  ar: {
    brandTag: "الرسم الميداني",
    open: "فتح مخطط",
    openShort: "فتح",
    vectorize: "تحويل صورة إلى متجهات",
    vectorizeShort: "صورة",
    layers: "الطبقات",
    measure: "قياس",
    export: "تصدير",
    warnings: "تنبيهات",
    fit: "ملاءمة العرض",
    noDrawing: "لم يتم فتح مخطط",
    noDrawingMeta: "DXF أو DWG أو SVG أو صورة نقطية",
    local: "تتم معالجة الملف على هذا الجهاز فقط",
    coverEyebrow: "المخططات الأثرية",
    coverTitle: "من الميدان إلى مخطط منظم في طبقات.",
    coverBody: "افتح ملف DXF أو SVG، أو حوّل صورة ممسوحة ضوئياً إلى هندسة قابلة للتحرير. قِس كل طبقة وراجعها وجهّزها من هاتفك.",
    coverFormats: "DXF · SVG · PNG · JPG · WEBP",
    privateNote: "خصوصية مدمجة: لا تغادر مخططاتك هذا الجهاز.",
    chooseLanguage: "اللغة",
    drawing: "المخطط",
    content: "محتوى المخطط",
    quality: "مراقبة الجودة",
    entities: "عناصر",
    selected: "محددة",
    visible: "ظاهرة",
    auxiliaryLabel: "مساعدة",
    search: "البحث عن طبقة…",
    all: "الكل",
    none: "لا شيء",
    layerHelp: "رمز العين يتحكم في العرض، ومربع الاختيار يحدد ما يتم تصديره.",
    noWarnings: "لا توجد تنبيهات في هذا المخطط.",
    ready: "المخطط جاهز",
    drop: "أفلت الملف هنا",
    dropFormats: "DXF أو DWG أو SVG أو صورة · حتى 50 ميغابايت",
    fileError: "تعذرت قراءة هذا الملف.",
    fileLarge: "يتجاوز الملف الحد الأقصى البالغ 50 ميغابايت.",
    measureHint: "المس نقاطاً على المخطط",
    clear: "مسح",
    undo: "تراجع",
    length: "الطول",
    perimeter: "المحيط",
    area: "المساحة",
    azimuth: "السمت",
    hide: "إخفاء",
    show: "إظهار",
    close: "إغلاق",
    mobileTools: "أدوات الهاتف",
    exportTitle: "إعداد الملفات",
    organisation: "التنظيم",
    perLayer: "ملف لكل طبقة",
    filtered: "مخطط واحد للعناصر المحددة",
    keepTogether: "يجمع الطبقات المختارة في ملف واحد",
    files: "ملفات",
    outputs: "صيغ الإخراج",
    editable: "CAD قابل للتحرير",
    inkscape: "Inkscape والويب",
    blocks: "تفكيك الكتل عندما يكون ذلك ممكناً",
    auxiliary: "تضمين الطبقات المساعدة",
    download: "إنشاء حزمة ZIP",
    cancel: "إلغاء",
    prepared: "عناصر جاهزة",
    generated: "ملفات جاهزة",
    dwgTitle: "يحتاج DWG إلى تحويل",
    dwgBody: "على الهاتف، حوّل الملف أولاً إلى DXF للحفاظ على الهندسة دون تفسير صيغة مملوكة داخل المتصفح.",
    rasterTitle: "تحويل صورة نقطية إلى متجهات",
    rasterIntro: "حوّل خطوط صورة ممسوحة ضوئياً أو فوتوغرافية إلى مسارات مركزية قابلة للتحرير. يجب دائماً مراجعة النتيجة.",
    sourceImage: "الصورة الأصلية",
    detection: "الاكتشاف",
    threshold: "عتبة اللون الأسود",
    thresholdHelp: "ارفع القيمة لاستعادة الخطوط الباهتة، واخفضها لإزالة الظلال.",
    simplify: "التبسيط",
    simplifyHelp: "زيادة التبسيط تقلل عدد النقاط وتنتج خطوطاً أنظف.",
    detail: "مستوى التفاصيل",
    detailHigh: "أقصى",
    detailBalanced: "متوازن",
    detailFast: "سريع",
    classify: "تصنيف أنواع الخطوط",
    classifyHelp: "يفصل المنشآت وخطوط الكنتور والمحاور والتهشير والرموز والمقياس، ويضيف OCR النصوص القابلة للتحرير.",
    ocr: "التعرف على النصوص (OCR)",
    ocrHelp: "يكتشف الكلمات والرموز والأبعاد ويضيفها كنص قابل للتحرير في طبقة مستقلة.",
    calibration: "المقياس الحقيقي (اختياري)",
    realWidth: "العرض الحقيقي للصورة",
    widthPlaceholder: "مثال: 25",
    noCalibration: "اتركه فارغاً إذا لم يكن للصورة مقياس معروف.",
    detectScale: "اكتشاف شريط المقياس",
    scaleLength: "الطول المُمثّل",
    scaleHelp: "إذا وُجد شريط مقياس أسفل الصورة، فاستخدمه للمعايرة التلقائية.",
    unit: "الوحدة",
    process: "إنشاء الهندسة",
    processing: "ترقيق الخطوط وتتبعها…",
    rasterReady: "تم تحويل الصورة إلى متجهات",
    noLines: "لم يتم اكتشاف خطوط. جرّب رفع قيمة العتبة.",
    rasterFeature: "ترقيق الخط المركزي",
    rasterFeatureBody: "يحدد مركز كل خط لتجنب الخطوط المزدوجة الناتجة عن تتبع الحدود.",
    install: "تثبيت",
    installTitle: "ثبّت ArqueoCAD",
    installBody: "استخدمه كتطبيق مستقل وافتحه من الشاشة الرئيسية، مع إمكانية الوصول دون اتصال إلى الملفات التي سبق تحميلها.",
    installIos: "افتح هذه الصفحة في Safari، وليس داخل ChatGPT، ثم اضغط على مشاركة و«إضافة إلى الشاشة الرئيسية».",
    installManual: "افتح هذه الصفحة في Chrome، وليس داخل ChatGPT، ثم اختر «تثبيت التطبيق» من قائمة المتصفح.",
    installNow: "تثبيت الآن",
    installLater: "ليس الآن",
    understood: "حسناً",
    help: "المساعدة",
    helpTitle: "دليل ArqueoCAD Mobile",
    helpIntro: "دليل سريع لفتح المخططات الأثرية ومراجعتها وقياسها وتحويلها من الهاتف.",
    helpOpenTitle: "١ · فتح مخطط",
    helpOpenBody: "اضغط على فتح في الشريط الجانبي واختر ملف DXF أو DWG أو SVG. تتم معالجة المخطط على هذا الجهاز ولا يتم رفعه إلى أي خادم.",
    helpRasterTitle: "٢ · تحويل صورة إلى متجهات",
    helpRasterBody: "اضغط على صورة لتحميل PNG أو JPG أو WEBP أو BMP. اضبط العتبة والتفاصيل، واترك التصنيف التلقائي مفعلاً، واستخدم شريط المقياس لمعايرة المخطط.",
    helpLayersTitle: "٣ · مراجعة الطبقات",
    helpLayersBody: "في الطبقات يمكنك إخفاء العناصر برمز العين، وتحديد ما يتم تصديره بمربع الاختيار، والبحث باسم الطبقة. تُصنف الطبقات تلقائياً من هندستها.",
    helpMeasureTitle: "٤ · القياس",
    helpMeasureBody: "فعّل القياس واضغط على عدة نقاط في المخطط. ستظهر لك المسافة والمحيط والمساحة والسمت. استخدم تراجع أو مسح للبدء من جديد.",
    helpExportTitle: "٥ · التصدير",
    helpExportBody: "في التصدير اختر ملفاً لكل طبقة أو مخططاً بالعناصر المحددة. يمكنك إنشاء ZIP يحتوي على DXF قابل للتحرير وSVG لـ Inkscape أو الويب.",
    helpInstallTitle: "٦ · التثبيت كتطبيق",
    helpInstallBody: "على Android استخدم Chrome ← تثبيت التطبيق. على iPhone افتح الصفحة في Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية. لا تثبته من متصفح ChatGPT الداخلي.",
    helpTipsTitle: "نصائح للجودة",
    helpTipsBody: "تحويل الصور إلى متجهات شبه تلقائي: راجع الخطوط والنصوص والطبقات قبل استخدام النتيجة كتوثيق نهائي. للحفاظ على كتل وبنية CAD الأصلية استخدم ملف DXF المصدر.",
    helpCreditsTitle: "الاعتمادات وشفرة المصدر والتراخيص",
    helpCreditsBody: "يعتمد ArqueoCAD Mobile على مشروع خوسيه خافيير مارتينيث الأصلي المنشور على GitHub، ويوزّع بموجب GPL-3.0. تستخدم الواجهة React وVinext وVite بترخيص MIT. ولتحسين تحويل الصور راجعنا AutoTrace وVTracer وTrazor؛ اقرأ الترخيص الكامل قبل دمج أي شفرة.",
    footerText: "هذا برنامج مجاني وحرّ التوزيع أنشأه خوسيه خافيير مارتينيث.",
    about: "حول",
    aboutTitle: "حول ArqueoCAD",
    aboutBodyPrefix: "هذا التطبيق جزء من",
    aboutBodySuffix: "لـ خوسيه خافيير مارتينيث غارسيا",
    hideTools: "إخفاء الأدوات",
    showTools: "إظهار الأدوات",
    zoomOut: "تصغير",
    zoomIn: "تكبير",
    north: "الشمال",
    draftHint: "نقاط · انقر نقراً مزدوجاً لإنهاء الخط المتعدد",
    home: "ArchaeoCAD — الغلاف",
    reviewTitle: "مراجعة مقترحة",
    reviewHelp: "هذه العناصر ذات ثقة أقل. يمكنك تغيير طبقتها هنا ثم تصدير التصحيح.",
    reviewTarget: "نقل إلى الطبقة",
    confidenceLabel: "الثقة",
  },
} as const;

const languageOptions: Array<{ code: Lang; label: string }> = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "ru", label: "Русский" },
  { code: "ja", label: "日本語" },
];

type Copy = typeof copy.es;

const languageOverrides: Partial<Record<Exclude<Lang, "es" | "en" | "ar">, Partial<Copy>>> = {
  fr: { brandTag: "DESSIN DE TERRAIN", open: "Ouvrir le plan", openShort: "Ouvrir", vectorize: "Vectoriser l’image", layers: "Calques", measure: "Mesurer", export: "Exporter", warnings: "Alertes", fit: "Ajuster le plan", noDrawing: "Aucun plan ouvert", chooseLanguage: "Langue", drawing: "Plan", content: "CONTENU DU PLAN", quality: "CONTRÔLE QUALITÉ", search: "Rechercher un calque…", all: "Toutes", none: "Aucune", close: "Fermer", cancel: "Annuler", download: "Créer le ZIP", rasterTitle: "Vectoriser une image raster", classify: "Classer les types de lignes", process: "Générer la géométrie", install: "Installer", installTitle: "Installer ArqueoCAD", help: "Aide", helpTitle: "Manuel ArqueoCAD Mobile", footerText: "Logiciel gratuit et librement distribuable créé par José Javier Martínez.", about: "À propos", aboutTitle: "À propos d’ArqueoCAD", aboutBodyPrefix: "Cette application fait partie du", aboutBodySuffix: "de José Javier Martínez García" },
  de: { brandTag: "FELDZEICHNUNG", open: "Plan öffnen", openShort: "Öffnen", vectorize: "Bild vektorisieren", layers: "Ebenen", measure: "Messen", export: "Exportieren", warnings: "Hinweise", fit: "Plan einpassen", noDrawing: "Kein Plan geöffnet", chooseLanguage: "Sprache", drawing: "Plan", content: "PLANINHALT", quality: "QUALITÄTSKONTROLLE", search: "Ebene suchen…", all: "Alle", none: "Keine", close: "Schließen", cancel: "Abbrechen", download: "ZIP erstellen", rasterTitle: "Rasterbild vektorisieren", classify: "Linientypen klassifizieren", process: "Geometrie erzeugen", install: "Installieren", installTitle: "ArqueoCAD installieren", help: "Hilfe", helpTitle: "ArqueoCAD Mobile-Handbuch", footerText: "Kostenlose, frei verbreitbare Software von José Javier Martínez.", about: "Über", aboutTitle: "Über ArqueoCAD", aboutBodyPrefix: "Diese Anwendung ist Teil des", aboutBodySuffix: "von José Javier Martínez García" },
  it: { brandTag: "DISEGNO DI CAMPO", open: "Apri pianta", openShort: "Apri", vectorize: "Vettorializza immagine", layers: "Livelli", measure: "Misura", export: "Esporta", warnings: "Avvisi", fit: "Adatta pianta", noDrawing: "Nessuna pianta aperta", chooseLanguage: "Lingua", drawing: "Pianta", content: "CONTENUTO DELLA PIANTA", quality: "CONTROLLO QUALITÀ", search: "Cerca livello…", all: "Tutte", none: "Nessuna", close: "Chiudi", cancel: "Annulla", download: "Crea pacchetto ZIP", rasterTitle: "Vettorializza immagine raster", classify: "Classifica tipi di linea", process: "Genera geometria", install: "Installa", installTitle: "Installa ArqueoCAD", help: "Aiuto", helpTitle: "Manuale ArqueoCAD Mobile", footerText: "Software gratuito e liberamente distribuibile creato da José Javier Martínez.", about: "Informazioni", aboutTitle: "Informazioni su ArqueoCAD", aboutBodyPrefix: "Questa applicazione fa parte del", aboutBodySuffix: "di José Javier Martínez García" },
  pt: { brandTag: "DESENHO DE CAMPO", open: "Abrir planta", openShort: "Abrir", vectorize: "Vetorializar imagem", layers: "Camadas", measure: "Medir", export: "Exportar", warnings: "Avisos", fit: "Enquadrar planta", noDrawing: "Nenhuma planta aberta", chooseLanguage: "Idioma", drawing: "Planta", content: "CONTEÚDO DA PLANTA", quality: "CONTROLO DE QUALIDADE", search: "Procurar camada…", all: "Todas", none: "Nenhuma", close: "Fechar", cancel: "Cancelar", download: "Criar pacote ZIP", rasterTitle: "Vetorializar imagem raster", classify: "Classificar tipos de linha", process: "Gerar geometria", install: "Instalar", installTitle: "Instale o ArqueoCAD", help: "Ajuda", helpTitle: "Manual do ArqueoCAD Mobile", footerText: "Software gratuito e de livre distribuição criado por José Javier Martínez.", about: "Acerca de", aboutTitle: "Acerca do ArqueoCAD", aboutBodyPrefix: "Esta aplicação faz parte do", aboutBodySuffix: "de José Javier Martínez García" },
  zh: { brandTag: "现场绘图", open: "打开平面图", openShort: "打开", vectorize: "矢量化图像", layers: "图层", measure: "测量", export: "导出", warnings: "提示", fit: "适应图纸", noDrawing: "未打开图纸", chooseLanguage: "语言", drawing: "图纸", content: "图纸内容", quality: "质量控制", search: "搜索图层…", all: "全部", none: "无", close: "关闭", cancel: "取消", download: "创建 ZIP", rasterTitle: "矢量化栅格图像", classify: "分类线型", process: "生成几何", install: "安装", installTitle: "安装 ArqueoCAD", help: "帮助", helpTitle: "ArqueoCAD Mobile 手册", footerText: "由 José Javier Martínez 创建的免费、自由分发软件。", about: "关于", aboutTitle: "关于 ArqueoCAD", aboutBodyPrefix: "此应用属于", aboutBodySuffix: "的 José Javier Martínez García" },
  hi: { brandTag: "फील्ड ड्रॉइंग", open: "प्लान खोलें", openShort: "खोलें", vectorize: "चित्र वेक्टराइज़ करें", layers: "लेयर", measure: "मापें", export: "निर्यात", warnings: "सूचनाएँ", fit: "प्लान फिट करें", noDrawing: "कोई प्लान खुला नहीं", chooseLanguage: "भाषा", drawing: "प्लान", content: "प्लान सामग्री", quality: "गुणवत्ता नियंत्रण", search: "लेयर खोजें…", all: "सभी", none: "कोई नहीं", close: "बंद करें", cancel: "रद्द करें", download: "ZIP बनाएँ", rasterTitle: "रास्टर चित्र वेक्टराइज़ करें", classify: "रेखा प्रकार वर्गीकृत करें", process: "ज्यामिति बनाएँ", install: "इंस्टॉल", installTitle: "ArqueoCAD इंस्टॉल करें", help: "सहायता", helpTitle: "ArqueoCAD Mobile मैनुअल", footerText: "José Javier Martínez द्वारा बनाया गया निःशुल्क, मुक्त वितरण सॉफ़्टवेयर।", about: "परिचय", aboutTitle: "ArqueoCAD के बारे में", aboutBodyPrefix: "यह एप्लिकेशन इसका हिस्सा है", aboutBodySuffix: "José Javier Martínez García का" },
  ru: { brandTag: "ПОЛЕВОЙ ЧЕРТЁЖ", open: "Открыть план", openShort: "Открыть", vectorize: "Векторизовать изображение", layers: "Слои", measure: "Измерить", export: "Экспорт", warnings: "Предупреждения", fit: "Вписать план", noDrawing: "План не открыт", chooseLanguage: "Язык", drawing: "План", content: "СОДЕРЖИМОЕ ПЛАНА", quality: "КОНТРОЛЬ КАЧЕСТВА", search: "Поиск слоя…", all: "Все", none: "Нет", close: "Закрыть", cancel: "Отмена", download: "Создать ZIP", rasterTitle: "Векторизация растра", classify: "Классифицировать типы линий", process: "Создать геометрию", install: "Установить", installTitle: "Установить ArqueoCAD", help: "Помощь", helpTitle: "Руководство ArqueoCAD Mobile", footerText: "Бесплатное свободно распространяемое ПО José Javier Martínez.", about: "О приложении", aboutTitle: "О ArqueoCAD", aboutBodyPrefix: "Это приложение является частью", aboutBodySuffix: "José Javier Martínez García" },
  ja: { brandTag: "現地図面", open: "図面を開く", openShort: "開く", vectorize: "画像をベクトル化", layers: "レイヤー", measure: "測定", export: "書き出し", warnings: "警告", fit: "図面に合わせる", noDrawing: "図面が開かれていません", chooseLanguage: "言語", drawing: "図面", content: "図面の内容", quality: "品質管理", search: "レイヤーを検索…", all: "すべて", none: "なし", close: "閉じる", cancel: "キャンセル", download: "ZIPを作成", rasterTitle: "ラスター画像をベクトル化", classify: "線種を分類", process: "ジオメトリを生成", install: "インストール", installTitle: "ArqueoCADをインストール", help: "ヘルプ", helpTitle: "ArqueoCAD Mobile マニュアル", footerText: "José Javier Martínez が作成した無料・自由配布ソフトウェア。", about: "概要", aboutTitle: "ArqueoCADについて", aboutBodyPrefix: "このアプリは", aboutBodySuffix: "José Javier Martínez García の一部です" },
};

const uiLocaleOverrides: Partial<Record<Lang, Partial<Copy>>> = {
  fr: { zoomOut: "Zoom arrière", zoomIn: "Zoom avant", north: "Nord", draftHint: "points · double-clic pour terminer la polyligne", home: "ArchaeoCAD — accueil", hideTools: "Masquer les outils", showTools: "Afficher les outils" },
  de: { zoomOut: "Verkleinern", zoomIn: "Vergrößern", north: "Norden", draftHint: "Punkte · Doppelklick zum Beenden der Polylinie", home: "ArchaeoCAD — Startseite", hideTools: "Werkzeuge ausblenden", showTools: "Werkzeuge anzeigen" },
  it: { zoomOut: "Riduci zoom", zoomIn: "Aumenta zoom", north: "Nord", draftHint: "punti · doppio clic per terminare la polilinea", home: "ArchaeoCAD — home", hideTools: "Nascondi strumenti", showTools: "Mostra strumenti" },
  pt: { zoomOut: "Afastar", zoomIn: "Aproximar", north: "Norte", draftHint: "pontos · duplo clique para terminar a polilinha", home: "ArchaeoCAD — início", hideTools: "Ocultar ferramentas", showTools: "Mostrar ferramentas" },
  zh: { zoomOut: "缩小", zoomIn: "放大", north: "北方", draftHint: "个点 · 双击完成折线", home: "ArchaeoCAD — 首页", hideTools: "隐藏工具", showTools: "显示工具" },
  hi: { zoomOut: "ज़ूम आउट", zoomIn: "ज़ूम इन", north: "उत्तर", draftHint: "बिंदु · पॉलीलाइन समाप्त करने के लिए डबल-क्लिक करें", home: "ArchaeoCAD — मुखपृष्ठ", hideTools: "उपकरण छिपाएँ", showTools: "उपकरण दिखाएँ" },
  ru: { zoomOut: "Уменьшить", zoomIn: "Увеличить", north: "Север", draftHint: "точек · дважды щёлкните для завершения полилинии", home: "ArchaeoCAD — главная", hideTools: "Скрыть инструменты", showTools: "Показать инструменты" },
  ja: { zoomOut: "縮小", zoomIn: "拡大", north: "北", draftHint: "点 · ダブルクリックでポリラインを終了", home: "ArchaeoCAD — ホーム", hideTools: "ツールを隠す", showTools: "ツールを表示" },
};

function browserLanguage(): Lang {
  if (typeof navigator === "undefined") return "es";
  const candidates = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean).map((value) => value.toLowerCase().split("-")[0]);
  return candidates.find((value): value is Lang => languageOptions.some((option) => option.code === value)) ?? "es";
}

type RasterJob = { file: File; url: string };
type RecentProject = { id: string; name: string; format: Drawing["format"]; entities: number; layers: number; createdAt: number; drawing?: Drawing };

function isRaster(extension?: string) {
  return ["png", "jpg", "jpeg", "webp", "bmp"].includes(extension ?? "");
}

function warningText(value: string, lang: Lang) {
  if (lang === "es") return value;
  const complex = value.match(/^(\d+) entidades complejas/);
  if (lang === "ar") {
    if (complex) return `يتم عرض ${complex[1]} من العناصر المعقدة بصورة مبسطة؛ استخدم تطبيق سطح المكتب عندما يلزم الحفاظ على بنية CAD الأصلية.`;
    if (value.startsWith("El SVG no declara capas")) return "لا يعرّف ملف SVG طبقات Inkscape؛ استُخدمت مجموعاته كطبقات عمل.";
    if (value.startsWith("La geometría procede de una imagen")) return "تم استنتاج هذه الهندسة من صورة ويجب مراجعتها قبل استخدامها كتوثيق نهائي.";
    if (value.startsWith("Las capas se han clasificado automáticamente")) return "صُنفت الطبقات تلقائياً حسب الشكل والاستمرارية والاتجاه والكثافة؛ يُنصح بمراجعة العناصر الملتبسة.";
    if (value.startsWith("Escala calibrada automáticamente")) return "تمت معايرة المقياس تلقائياً باستخدام شريط المقياس الموجود في الصورة.";
    if (value.startsWith("La imagen no se ha calibrado")) return "لم تتم معايرة الصورة: تظهر القياسات بالبكسل أو بوحدات الرسم.";
    if (value.startsWith("OCR:")) return value.replace(/^OCR:\s*/, "التعرف الضوئي على الحروف: ").replace("textos añadidos a 08_TEXTOS_EDITABLES.", "نصوص أضيفت إلى 08_TEXTOS_EDITABLES.");
    if (value.startsWith("OCR no ha encontrado")) return "لم يعثر OCR على نصوص بدرجة ثقة كافية؛ راجع الصورة الممسوحة.";
    if (value.includes("baja confianza de clasificación")) return value.replace(/trazos tienen baja confianza de clasificación y conviene revisarlos\./, "عناصر ذات ثقة تصنيف منخفضة ويُنصح بمراجعتها.");
    return value;
  }
  const localized = {
    fr: { complex: (n: string) => `${n} entités complexes sont affichées sous forme simplifiée ; utilisez l’application de bureau pour conserver la structure CAD originale.`, svg: "Le SVG ne déclare pas de calques Inkscape ; ses groupes ont été utilisés comme calques de travail.", image: "Cette géométrie provient d’une image et doit être vérifiée avant toute utilisation documentaire.", classified: "Les calques ont été classés automatiquement ; vérifiez les éléments ambigus.", scale: "Échelle calibrée automatiquement avec la barre graphique de l’image.", uncalibrated: "L’image n’est pas calibrée : les mesures sont en pixels/unités de dessin.", ocr: "OCR : textes ajoutés au calque 08_TEXTOS_EDITABLES.", ocrNone: "L’OCR n’a pas trouvé de texte avec une confiance suffisante ; vérifiez le scan.", low: "Certains traits ont une faible confiance de classification et doivent être vérifiés." },
    de: { complex: (n: string) => `${n} komplexe Entitäten werden vereinfacht angezeigt; verwenden Sie die Desktop-App, um die ursprüngliche CAD-Struktur zu erhalten.`, svg: "Das SVG enthält keine Inkscape-Ebenen; seine Gruppen wurden als Arbeitsebenen verwendet.", image: "Diese Geometrie wurde aus einem Bild abgeleitet und sollte vor der Dokumentation geprüft werden.", classified: "Die Ebenen wurden automatisch klassifiziert; mehrdeutige Elemente sollten geprüft werden.", scale: "Maßstab automatisch mit dem grafischen Maßstab des Bildes kalibriert.", uncalibrated: "Das Bild ist nicht kalibriert: Maße werden in Pixeln/Zeichnungseinheiten angezeigt.", ocr: "OCR: Texte zur Ebene 08_TEXTOS_EDITABLES hinzugefügt.", ocrNone: "OCR hat keinen Text mit ausreichender Sicherheit gefunden; prüfen Sie den Scan.", low: "Einige Striche haben eine geringe Klassifikationssicherheit und sollten geprüft werden." },
    it: { complex: (n: string) => `${n} entità complesse sono mostrate in forma semplificata; usa l’app desktop per conservare la struttura CAD originale.`, svg: "L’SVG non dichiara livelli Inkscape; i gruppi sono stati usati come livelli di lavoro.", image: "Questa geometria proviene da un’immagine e deve essere verificata prima dell’uso documentale.", classified: "I livelli sono stati classificati automaticamente; verifica gli elementi ambigui.", scale: "Scala calibrata automaticamente con la barra grafica dell’immagine.", uncalibrated: "L’immagine non è calibrata: le misure sono in pixel/unità di disegno.", ocr: "OCR: testi aggiunti al livello 08_TEXTOS_EDITABLES.", ocrNone: "L’OCR non ha trovato testo con sufficiente affidabilità; controlla la scansione.", low: "Alcuni tratti hanno bassa affidabilità di classificazione e devono essere verificati." },
    pt: { complex: (n: string) => `${n} entidades complexas são mostradas de forma simplificada; use a aplicação de computador para preservar a estrutura CAD original.`, svg: "O SVG não declara camadas do Inkscape; os grupos foram usados como camadas de trabalho.", image: "Esta geometria foi obtida de uma imagem e deve ser revista antes do uso documental.", classified: "As camadas foram classificadas automaticamente; reveja os elementos ambíguos.", scale: "Escala calibrada automaticamente com a barra gráfica da imagem.", uncalibrated: "A imagem não está calibrada: as medidas são apresentadas em píxeis/unidades de desenho.", ocr: "OCR: textos adicionados à camada 08_TEXTOS_EDITABLES.", ocrNone: "O OCR não encontrou texto com confiança suficiente; reveja o scan.", low: "Alguns traços têm baixa confiança de classificação e devem ser revistos." },
    zh: { complex: (n: string) => `${n} 个复杂实体以简化形式显示；如需保留原始 CAD 结构，请使用桌面应用。`, svg: "SVG 未声明 Inkscape 图层；已将其组用作工作图层。", image: "此几何图形来自图像，作为正式文档使用前应进行检查。", classified: "图层已自动分类；请检查不明确的元素。", scale: "已使用图像中的图形比例尺自动校准比例。", uncalibrated: "图像未校准：测量值以像素/绘图单位显示。", ocr: "OCR：文本已添加到 08_TEXTOS_EDITABLES 图层。", ocrNone: "OCR 未找到置信度足够的文本；请检查扫描图。", low: "部分线条的分类置信度较低，应进行检查。" },
    hi: { complex: (n: string) => `${n} जटिल इकाइयाँ सरलीकृत रूप में दिखाई गई हैं; मूल CAD संरचना रखने के लिए डेस्कटॉप ऐप का उपयोग करें।`, svg: "SVG में Inkscape लेयर घोषित नहीं हैं; समूहों को कार्य लेयर के रूप में उपयोग किया गया।", image: "यह ज्यामिति एक छवि से निकाली गई है और दस्तावेज़ में उपयोग से पहले जाँचनी चाहिए।", classified: "लेयरों को स्वचालित रूप से वर्गीकृत किया गया; अस्पष्ट तत्वों की समीक्षा करें।", scale: "छवि के ग्राफ़िक स्केल से पैमाना स्वचालित रूप से कैलिब्रेट किया गया।", uncalibrated: "छवि कैलिब्रेट नहीं है: माप पिक्सेल/ड्रॉइंग इकाइयों में हैं।", ocr: "OCR: 08_TEXTOS_EDITABLES लेयर में टेक्स्ट जोड़े गए।", ocrNone: "OCR को पर्याप्त विश्वास वाला टेक्स्ट नहीं मिला; स्कैन की समीक्षा करें।", low: "कुछ स्ट्रोक का वर्गीकरण विश्वास कम है और उनकी समीक्षा करनी चाहिए।" },
    ru: { complex: (n: string) => `${n} сложных объектов показаны упрощённо; для сохранения структуры CAD используйте настольное приложение.`, svg: "SVG не содержит слоёв Inkscape; его группы использованы как рабочие слои.", image: "Эта геометрия получена из изображения и должна быть проверена перед использованием в документации.", classified: "Слои классифицированы автоматически; проверьте неоднозначные элементы.", scale: "Масштаб автоматически откалиброван по графической шкале изображения.", uncalibrated: "Изображение не откалибровано: размеры указаны в пикселях/единицах чертежа.", ocr: "OCR: текст добавлен в слой 08_TEXTOS_EDITABLES.", ocrNone: "OCR не нашёл текст с достаточной уверенностью; проверьте скан.", low: "Некоторые линии имеют низкую уверенность классификации и требуют проверки." },
    ja: { complex: (n: string) => `${n} 個の複雑なエンティティを簡略表示しています。元の CAD 構造を保持するにはデスクトップアプリを使用してください。`, svg: "SVG に Inkscape レイヤーの宣言がないため、グループを作業レイヤーとして使用しました。", image: "このジオメトリは画像から推定されたため、文書に使用する前に確認してください。", classified: "レイヤーは自動分類されています。不明確な要素を確認してください。", scale: "画像のグラフィック尺度を使用して自動的にスケールを調整しました。", uncalibrated: "画像は未校正です。測定値はピクセル/図面単位で表示されます。", ocr: "OCR: 08_TEXTOS_EDITABLES レイヤーにテキストを追加しました。", ocrNone: "OCR で十分な信頼度のテキストが見つかりませんでした。スキャンを確認してください。", low: "分類の信頼度が低い線があるため、確認してください。" },
  }[lang];
  if (localized) {
    if (complex) return localized.complex(complex[1]);
    if (value.startsWith("El SVG no declara capas")) return localized.svg;
    if (value.startsWith("La geometría procede de una imagen")) return localized.image;
    if (value.startsWith("Las capas se han clasificado automáticamente")) return localized.classified;
    if (value.startsWith("Escala calibrada automáticamente")) return localized.scale;
    if (value.startsWith("La imagen no se ha calibrado")) return localized.uncalibrated;
    if (value.startsWith("OCR:")) return localized.ocr;
    if (value.startsWith("OCR no ha encontrado")) return localized.ocrNone;
    if (value.includes("baja confianza de clasificación")) return localized.low;
  }
  if (complex) return `${complex[1]} complex entities are shown in simplified form; use the desktop application when the original CAD structure must be preserved.`;
  if (value.startsWith("El SVG no declara capas")) return "The SVG does not declare Inkscape layers; its groups were used as working layers.";
  if (value.startsWith("La geometría procede de una imagen")) return "This geometry was inferred from an image and should be reviewed before it is used as final documentation.";
  if (value.startsWith("Las capas se han clasificado automáticamente")) return "Layers were classified automatically using shape, continuity, orientation and density; ambiguous elements should be reviewed.";
  if (value.startsWith("Escala calibrada automáticamente")) return value.replace("Escala calibrada automáticamente con una barra gráfica de", "Scale calibrated automatically with a graphic scale of").replace("metros", "metres").replace("centímetros", "centimetres").replace("milímetros", "millimetres");
  if (value.startsWith("La imagen no se ha calibrado")) return "The image was not calibrated: measurements are shown in pixels/drawing units.";
  if (value.startsWith("OCR:")) return value.replace(/^OCR:\s*/, "OCR: ").replace("textos añadidos a 08_TEXTOS_EDITABLES.", "text items added to 08_TEXTOS_EDITABLES.");
  if (value.startsWith("OCR no ha encontrado")) return "OCR did not find text with enough confidence; review the scan.";
  if (value.includes("baja confianza de clasificación")) return value.replace(/trazos tienen baja confianza de clasificación y conviene revisarlos\./, "strokes have low classification confidence and should be reviewed.");
  return value;
}

export default function ArqueoCadMobile() {
  const [lang, setLang] = useState<Lang>("es");
  const [drawing, setDrawingRaw] = useState<Drawing | null>(null);
  const historyRef = useRef<Drawing[]>([]);
  const futureRef = useRef<Drawing[]>([]);
  const setDrawing = (next: SetStateAction<Drawing | null>) => {
    setDrawingRaw((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      if (resolved !== current && current) historyRef.current = [...historyRef.current.slice(-49), current];
      if (resolved !== current) futureRef.current = [];
      return resolved;
    });
  };
  const undoDrawing = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    setDrawingRaw((current) => { if (current) futureRef.current.push(current); return previous; });
    setToast(lang === "es" ? "Cambio deshecho" : "Change undone");
  };
  const redoDrawing = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    setDrawingRaw((current) => { if (current) historyRef.current.push(current); return next; });
    setToast(lang === "es" ? "Cambio rehecho" : "Change redone");
  };
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(window.localStorage.getItem("arqueocad-projects") ?? "[]");
      return Array.isArray(stored) ? stored.slice(0, 8) : [];
    } catch { return []; }
  });
  const [activePanel, setActivePanel] = useState<"layers" | "warnings" | null>(null);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [vectorCategory, setVectorCategory] = useState<VectorCategory>("draw");
  const [vectorTool, setVectorTool] = useState<VectorTool>("select");
  const [vectorToolsOpen, setVectorToolsOpen] = useState(true);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [orthoEnabled, setOrthoEnabled] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [view3dOpen, setView3dOpen] = useState(false);
  const [dwgInfo, setDwgInfo] = useState<{ version: string; release: string; size: number } | null>(null);
  const [dwgConverting, setDwgConverting] = useState(false);
  const [dwgFile, setDwgFile] = useState<File | null>(null);
  const [exportMode, setExportMode] = useState<"layers" | "filtered">("layers");
  const [exportFormats, setExportFormats] = useState({ dxf: true, svg: true });
  const [draggingFile, setDraggingFile] = useState(false);
  const [toast, setToast] = useState("");
  const [dwgOpen, setDwgOpen] = useState(false);
  const [rasterJob, setRasterJob] = useState<RasterJob | null>(null);
  const [threshold, setThreshold] = useState(165);
  const [simplify, setSimplify] = useState(0.6);
  const [detail, setDetail] = useState<RasterOptions["detail"]>(2);
  const [classifyLines, setClassifyLines] = useState(true);
  // OCR is opt-in: loading the language model can take tens of seconds on a
  // phone and must never block the normal raster vectorization workflow.
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [detectScale, setDetectScale] = useState(true);
  const [scaleBarLength, setScaleBarLength] = useState("8");
  const [realWidth, setRealWidth] = useState("");
  const [rasterUnit, setRasterUnit] = useState<RasterOptions["unit"]>("m");
  const [vectorizing, setVectorizing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installMode, setInstallMode] = useState<"native" | "ios" | "manual">("manual");
  const [installOpen, setInstallOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const planInputRef = useRef<HTMLInputElement>(null);
  const rasterInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const vertexDragRef = useRef<{ id: string; index: number } | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const panPendingRef = useRef<{ x: number; y: number } | null>(null);
  const rawCopy = { ...(lang === "es" ? copy.es : lang === "en" ? copy.en : lang === "ar" ? copy.ar : { ...copy.es, ...(languageOverrides[lang] ?? {}) }), ...(uiLocaleOverrides[lang] ?? {}) };
  const t: Copy = Object.fromEntries(Object.entries(rawCopy).map(([key, value]) => [key, typeof value === "string" ? value.replaceAll("ArqueoCAD", "ArchaeoCAD") : value])) as Copy;
  const vt = { ...(lang === "en" ? vectorToolsCopy.en : vectorToolsCopy.es), ...(vectorLocaleOverrides[lang] ?? {}), ...(vectorTermOverrides[lang] ?? {}) };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redoDrawing() : undoDrawing(); }
      if (event.key.toLowerCase() === "y") { event.preventDefault(); redoDrawing(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lang]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => undefined);
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) {
      setInstalled(true);
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const dismissed = window.sessionStorage.getItem("arqueocad-install-dismissed") === "1";
    let timer: number | undefined;
    const offerInstall = (mode: "native" | "ios" | "manual") => {
      setInstallMode(mode);
      if (!dismissed) {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setInstallOpen(true), 900);
      }
    };
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      offerInstall("native");
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallOpen(false);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    offerInstall(isIos ? "ios" : "manual");
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("arqueocad-language", lang);
  }, [lang]);

  useEffect(() => {
    try {
      window.localStorage.setItem("arqueocad-projects", JSON.stringify(recentProjects));
    } catch {
      // A very large drawing can exceed localStorage; keep the current session usable.
    }
  }, [recentProjects]);

  useEffect(() => {
    const saved = window.localStorage.getItem("arqueocad-language") as Lang | null;
    if (saved && languageOptions.some((option) => option.code === saved)) setLang(saved);
    else setLang(browserLanguage());
  }, []);

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
  const reviewEntities = useMemo(() => primitives.filter((entity) => typeof entity.confidence === "number" && entity.confidence < 0.5).slice(0, 40), [primitives]);
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

  function dismissInstall() {
    window.sessionStorage.setItem("arqueocad-install-dismissed", "1");
    setInstallOpen(false);
  }

  async function installApp() {
    if (!installPrompt) {
      dismissInstall();
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallOpen(false);
    if (choice.outcome === "dismissed") window.sessionStorage.setItem("arqueocad-install-dismissed", "1");
  }

  function loadDrawing(next: Drawing) {
    setDrawing(next);
    const project: RecentProject = { id: `${next.name}-${next.format}`, name: next.name, format: next.format, entities: next.primitives.length, layers: next.layers.length, createdAt: Date.now(), drawing: next };
    setRecentProjects((current) => [project, ...current.filter((item) => item.id !== project.id)].slice(0, 8));
    setSelectedEntityIds([]);
    setDraftPoints([]);
    setVectorTool("select");
    setMeasurePoints([]);
    setMeasureMode(false);
    resetView();
    setActivePanel("layers");
    setToast(`${t.ready}: ${next.layers.length} ${t.layers.toLowerCase()}`);
  }

  function goToCover() {
    setDrawing(null);
    setActivePanel(null);
    setSelectedEntityIds([]);
    setDraftPoints([]);
    setMeasurePoints([]);
    setMeasureMode(false);
  }

  function deleteRecentProject(id: string) {
    setRecentProjects((current) => current.filter((project) => project.id !== id));
  }

  function addSymbol(symbolId: string) {
    if (!drawing) return;
    const symbol = archaeologySymbols.find((item) => item.id === symbolId);
    if (!symbol) return;
    const layer = drawing.layers.find((candidate) => !candidate.auxiliary)?.name ?? "01_ESTRUCTURAS";
    const entity = symbolEntity(symbol, layer, drawing.layers.find((candidate) => candidate.name === layer)?.color);
    setDrawing((current) => current ? { ...current, primitives: [...current.primitives, entity] } : current);
    setSelectedEntityIds([entity.id]);
    setLibraryOpen(false);
    setToast(lang === "es" ? `Símbolo añadido: ${symbol.name.split(" /")[0]}` : `Symbol added: ${symbol.name.split(" /")[1] ?? symbol.name}`);
  }

  async function convertDwg() {
    const input = dwgFile;
    if (!input) { setToast(lang === "es" ? "Vuelve a seleccionar el archivo DWG" : "Select the DWG file again"); return; }
    setDwgConverting(true);
    try {
      const bytes = await convertDwgToDxf(input);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/dxf" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${input.name.replace(/\.dwg$/i, "")}.dxf`; anchor.click(); URL.revokeObjectURL(url);
      setToast(lang === "es" ? "DXF convertido y descargado" : "DXF converted and downloaded");
    } catch { setToast(lang === "es" ? "No se pudo convertir este DWG en el navegador" : "This DWG could not be converted in the browser"); }
    finally { setDwgConverting(false); }
  }

  function openRecentProject(project: RecentProject) {
    if (!project.drawing) {
      setToast(t.projectUnavailable);
      return;
    }
    loadDrawing(project.drawing);
    setToast(`${t.ready}: ${project.name.replace(/\.[^.]+$/, "")}`);
  }

  function openRaster(file: File) {
    if (rasterJob) URL.revokeObjectURL(rasterJob.url);
    setRasterJob({ file, url: URL.createObjectURL(file) });
    setThreshold(165);
    setSimplify(0.6);
    const compactDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1 || window.innerWidth < 700;
    setDetail(compactDevice ? 1 : 2);
    setClassifyLines(true);
    // OCR remains available through the checkbox, but is opt-in on phones so
    // the first vectorization is not delayed by downloading language data.
    setOcrEnabled(false);
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
      setDwgFile(file);
      setDwgInfo(await inspectDwg(file));
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
        ocr: ocrEnabled,
        scaleBarLength: detectScale && Number(scaleBarLength) > 0 ? Number(scaleBarLength) : null,
      });
      closeRaster();
      loadDrawing(next);
      setToast(`${t.rasterReady}: ${next.primitives.length} ${t.entities}`);
    } catch {
      // Do not leave the raster dialog covering the error toast: on mobile
      // that looked like a frozen vectorizer and prevented a retry.
      closeRaster();
      setToast(t.noLines);
    } finally {
      setVectorizing(false);
    }
  }

  function updateLayer(name: string, field: "visible" | "selected") {
    setDrawing((current) => current ? ({ ...current, layers: current.layers.map((layer) => layer.name === name ? { ...layer, [field]: !layer[field] } : layer) }) : current);
  }

  function moveEntityToLayer(id: string, layerName: string) {
    setDrawing((current) => {
      if (!current || !current.layers.some((layer) => layer.name === layerName)) return current;
      const nextPrimitives = current.primitives.map((entity) => entity.id === id ? { ...entity, layer: layerName, color: current.layers.find((layer) => layer.name === layerName)?.color } : entity);
      const counts = new Map<string, number>();
      nextPrimitives.forEach((entity) => counts.set(entity.layer, (counts.get(entity.layer) ?? 0) + 1));
      return { ...current, primitives: nextPrimitives, layers: current.layers.map((layer) => ({ ...layer, count: counts.get(layer.name) ?? 0 })) };
    });
  }

  function selectAll(selected: boolean) {
    setDrawing((current) => current ? ({ ...current, layers: current.layers.map((layer) => ({ ...layer, selected: layer.auxiliary ? false : selected, visible: layer.auxiliary ? layer.visible : selected })) }) : current);
  }

  function newEntityId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function entityPoints(entity: Primitive): Point[] {
    if (entity.points?.length) return entity.points;
    if (entity.center) {
      const radius = entity.radius ?? 1;
      return [{ x: entity.center.x - radius, y: entity.center.y }, { x: entity.center.x + radius, y: entity.center.y }];
    }
    return [];
  }

  function transformSelected(transform: (entity: Primitive) => Primitive, message: string) {
    if (!selectedEntityIds.length) {
      setToast(`${vt.hint}.`);
      return;
    }
    setDrawing((current) => current ? { ...current, primitives: current.primitives.map((entity) => selectedEntityIds.includes(entity.id) ? transform(entity) : entity) } : current);
    setToast(message);
  }

  function selectedCenter(entity: Primitive) {
    const points = entityPoints(entity);
    if (!points.length) return entity.center ?? { x: 0, y: 0 };
    return { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
  }

  function applyVectorTool(tool: VectorTool) {
    if (tool === "snap") { setSnapEnabled((value) => !value); return; }
    if (tool === "ortho") { setOrthoEnabled((value) => !value); return; }
    if (tool === "grid") { setGridEnabled((value) => !value); return; }
    if (tool === "layers") { setActivePanel("layers"); return; }
    if (tool === "properties") { setActivePanel("warnings"); return; }
    if (tool === "order") {
      if (!selectedEntityIds.length) { setToast(`${vt.hint}.`); return; }
      setDrawing((current) => {
        if (!current) return current;
        const selected = current.primitives.filter((entity) => selectedEntityIds.includes(entity.id));
        const rest = current.primitives.filter((entity) => !selectedEntityIds.includes(entity.id));
        return { ...current, primitives: [...rest, ...selected] };
      });
      setToast(`${vt.order}: ${vt.ready.toLowerCase()}`);
      return;
    }
    if (tool === "move") { transformSelected((entity) => translateEntity(entity as never, { x: 1, y: 1 }) as unknown as Primitive, `${vt.move}: +1, +1`); return; }
    if (tool === "copy") {
      if (!selectedEntityIds.length) { setToast(`${vt.hint}.`); return; }
      setDrawing((current) => {
        if (!current) return current;
        const copies = current.primitives.filter((entity) => selectedEntityIds.includes(entity.id)).map((entity) => ({ ...translateEntity(entity as never, { x: 2, y: 2 }) as unknown as Primitive, id: newEntityId("copy") }));
        return { ...current, primitives: [...current.primitives, ...copies] };
      });
      setToast(vt.copy);
      return;
    }
    if (tool === "rotate" || tool === "scale" || tool === "mirror") {
      transformSelected((entity) => {
        const pivot = selectedCenter(entity);
        const angle = tool === "rotate" ? Math.PI / 2 : 0;
        const factor = tool === "scale" ? 1.15 : 1;
        const mirror = tool === "mirror";
        const transformed = tool === "rotate" ? rotateEntity(entity as never, pivot, angle) : tool === "scale" ? scaleEntity(entity as never, pivot, factor) : mirrorEntity(entity as never, { x: pivot.x - 1, y: pivot.y }, { x: pivot.x + 1, y: pivot.y });
        return { ...transformed as unknown as Primitive, rotation: entity.rotation !== undefined && tool === "rotate" ? entity.rotation + 90 : entity.rotation };
      }, vt[tool]);
      return;
    }
    if (tool === "offset") { transformSelected((entity) => ({ ...entity, points: entity.points ? offsetPolyline(entity.points, 0.5, entity.closed) : entity.points }), `${vt.offset}: 0.5`); return; }
    if (tool === "explode") {
      if (!selectedEntityIds.length) { setToast(`${vt.hint}.`); return; }
      setDrawing((current) => {
        if (!current) return current;
        const next: Primitive[] = [];
        current.primitives.forEach((entity) => {
          if (!selectedEntityIds.includes(entity.id) || !entity.points || entity.points.length < 2) { next.push(entity); return; }
          for (let index = 1; index < entity.points.length; index += 1) next.push({ ...entity, id: newEntityId("segment"), points: [entity.points[index - 1], entity.points[index]], closed: false });
        });
        return { ...current, primitives: next };
      });
      setSelectedEntityIds([]);
      setToast(vt.explode);
      return;
    }
    if (tool === "split") {
      if (!selectedEntityIds.length) { setToast(`${vt.hint}.`); return; }
      setDrawing((current) => {
        if (!current) return current;
        const next: Primitive[] = [];
        current.primitives.forEach((entity) => {
          if (!selectedEntityIds.includes(entity.id) || !entity.points || entity.points.length < 4) { next.push(entity); return; }
          const middle = Math.floor(entity.points.length / 2);
          next.push({ ...entity, id: newEntityId("split-a"), points: entity.points.slice(0, middle + 1), closed: false }, { ...entity, id: newEntityId("split-b"), points: entity.points.slice(middle), closed: false });
        });
        return { ...current, primitives: next };
      });
      setSelectedEntityIds([]);
      setToast(vt.split);
      return;
    }
    if (tool === "join") {
      if (selectedEntityIds.length < 2) { setToast(`${vt.join}: ${vt.hint.toLowerCase()}`); return; }
      setDrawing((current) => {
        if (!current) return current;
        const selected = current.primitives.filter((entity) => selectedEntityIds.includes(entity.id) && entity.type === "polyline" && entity.points?.length);
        if (selected.length < 2) return current;
        const first = selected[0];
        const points = selected.slice(1).reduce((joined, entity) => {
          const next = entity.points ?? [];
          if (!next.length) return joined;
          const end = joined[joined.length - 1];
          const start = next[0];
          const reverse = Math.hypot(end.x - next[next.length - 1].x, end.y - next[next.length - 1].y) < Math.hypot(end.x - start.x, end.y - start.y);
          const ordered = reverse ? [...next].reverse() : next;
          return [...joined, ...ordered.slice(Math.hypot(end.x - ordered[0].x, end.y - ordered[0].y) < 0.001 ? 1 : 0)];
        }, [...(first.points ?? [])]);
        const closedRings = selected.filter((entity) => entity.closed && entity.points).map((entity) => entity.points!);
        const union = closedRings.length === selected.length ? unionPolygons(closedRings) : [];
        const joined = { ...first, id: newEntityId("joined"), points: union[0]?.length ? union[0] : points, closed: Boolean(union[0]?.length) || first.closed };
        return { ...current, primitives: [...current.primitives.filter((entity) => !selectedEntityIds.includes(entity.id)), joined] };
      });
      setSelectedEntityIds([]);
      setToast(vt.join);
      return;
    }
    if (tool === "trim" || tool === "extend") {
      if (!selectedEntityIds.length) { setToast(`${vt[tool]}: ${vt.hint.toLowerCase()}`); return; }
      setDrawing((current) => current ? { ...current, primitives: current.primitives.map((entity) => {
        if (!selectedEntityIds.includes(entity.id) || entity.type !== "polyline" || !entity.points || entity.points.length < 3) return entity;
        if (tool === "trim") return { ...entity, points: entity.points.slice(0, -1), closed: false };
        const end = entity.points[entity.points.length - 1];
        const previous = entity.points[entity.points.length - 2];
        const length = Math.max(0.001, Math.hypot(end.x - previous.x, end.y - previous.y));
        const extension = { x: end.x + (end.x - previous.x) / length, y: end.y + (end.y - previous.y) / length };
        return { ...entity, points: [...entity.points, extension], closed: false };
      }) } : current);
      setToast(vt[tool]);
      return;
    }
    if (tool === "vertices") {
      setToast(`${vt[tool]}: ${selectedEntityIds.length ? vt.ready.toLowerCase() : vt.hint.toLowerCase()}`);
      return;
    }
    setVectorTool(tool);
    setDraftPoints([]);
    setToast(`${vt.ready}: ${vt[tool]}`);
  }

  function snapPoint(point: Point) {
    let next = point;
    if (snapEnabled) next = { x: Math.round(next.x), y: Math.round(next.y) };
    if (orthoEnabled && draftPoints.length) {
      const origin = draftPoints[0];
      if (Math.abs(next.x - origin.x) >= Math.abs(next.y - origin.y)) next = { x: next.x, y: origin.y };
      else next = { x: origin.x, y: next.y };
    }
    return next;
  }

  function addDrawPoint(point: Point) {
    const nextPoint = snapPoint(point);
    const points = [...draftPoints, nextPoint];
    const layer = drawing?.layers.find((candidate) => !candidate.auxiliary)?.name ?? "01_ESTRUCTURAS";
    const color = drawing?.layers.find((candidate) => candidate.name === layer)?.color;
    const finish = (entity: Primitive) => {
      setDrawing((current) => current ? { ...current, primitives: [...current.primitives, entity] } : current);
      setSelectedEntityIds([entity.id]);
      setDraftPoints([]);
      setVectorTool("select");
    };
    const common = { id: newEntityId("draw"), layer, color, lineWeight: 0.18 };
    if (vectorTool === "point") finish({ ...common, type: "point", center: nextPoint });
    else if (vectorTool === "line" && points.length === 2) finish({ ...common, type: "polyline", points, lineType: "continuous" });
    else if (vectorTool === "rectangle" && points.length === 2) { const [a, b] = points; finish({ ...common, type: "polyline", points: [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }, { x: a.x, y: a.y }], closed: true }); }
    else if (vectorTool === "circle" && points.length === 2) finish({ ...common, type: "circle", center: points[0], radius: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) });
    else if (vectorTool === "arc" && points.length === 3) {
      const [start, through, end] = points;
      const determinant = 2 * (start.x * (through.y - end.y) + through.x * (end.y - start.y) + end.x * (start.y - through.y));
      if (Math.abs(determinant) < 1e-6) {
        finish({ ...common, type: "polyline", points: [start, through, end], closed: false });
      } else {
        const startSq = start.x ** 2 + start.y ** 2;
        const throughSq = through.x ** 2 + through.y ** 2;
        const endSq = end.x ** 2 + end.y ** 2;
        const center = {
          x: (startSq * (through.y - end.y) + throughSq * (end.y - start.y) + endSq * (start.y - through.y)) / determinant,
          y: (startSq * (end.x - through.x) + throughSq * (start.x - end.x) + endSq * (through.x - start.x)) / determinant,
        };
        const radius = Math.hypot(start.x - center.x, start.y - center.y);
        const angle = (p: Point) => Math.atan2(p.y - center.y, p.x - center.x);
        const a0 = angle(start); const am = angle(through); const a1 = angle(end);
        const ccwDistance = (a1 - a0 + Math.PI * 2) % (Math.PI * 2);
        const middleOnCcw = (am - a0 + Math.PI * 2) % (Math.PI * 2) < ccwDistance;
        const sweep = middleOnCcw ? ccwDistance : ccwDistance - Math.PI * 2;
        const steps = Math.max(12, Math.ceil(Math.abs(sweep) * 18));
        const arcPoints = Array.from({ length: steps + 1 }, (_, index) => {
          const current = a0 + sweep * index / steps;
          return { x: center.x + Math.cos(current) * radius, y: center.y + Math.sin(current) * radius };
        });
        finish({ ...common, type: "polyline", points: arcPoints, closed: false, smooth: true });
      }
    }
    else if ((vectorTool === "polyline" || vectorTool === "polygon") && points.length >= 3 && vectorTool === "polygon") finish({ ...common, type: "polyline", points: [...points, points[0]], closed: true });
    else setDraftPoints(points);
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
    const canPan = Boolean(drag && vectorTool === "select" && !measureMode);
    const point = canPan ? null : eventPoint(event);
    if (point && !canPan) setCursorPoint(point);
    if (vertexDragRef.current && point) {
      const { id, index } = vertexDragRef.current;
      const nextPoint = snapPoint(point);
      setDrawing((current) => current ? { ...current, primitives: current.primitives.map((entity) => entity.id === id && entity.points ? { ...entity, points: entity.points.map((item, itemIndex) => itemIndex === index ? nextPoint : item) } : entity) } : current);
      return;
    }
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved && vectorTool === "select" && !measureMode) {
      const rect = event.currentTarget.getBoundingClientRect();
      panPendingRef.current = { x: drag.panX - dx * viewWidth / rect.width, y: drag.panY - dy * viewHeight / rect.height };
      if (panFrameRef.current === null) {
        panFrameRef.current = window.requestAnimationFrame(() => {
          if (panPendingRef.current) setPan(panPendingRef.current);
          panPendingRef.current = null;
          panFrameRef.current = null;
        });
      }
    }
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (drag && !drag.moved && measureMode) {
      const point = eventPoint(event);
      if (point) setMeasurePoints((current) => [...current, point]);
    } else if (drag && !drag.moved && ["point", "line", "polyline", "polygon", "rectangle", "circle", "arc"].includes(vectorTool)) {
      const point = eventPoint(event);
      if (point) addDrawPoint(point);
    }
    vertexDragRef.current = null;
    dragRef.current = null;
    panPendingRef.current = null;
    if (panFrameRef.current !== null) { window.cancelAnimationFrame(panFrameRef.current); panFrameRef.current = null; }
  }

  function onEntityPointerDown(event: ReactPointerEvent<SVGElement>, id: string) {
    event.stopPropagation();
    if (measureMode) return;
    setSelectedEntityIds((current) => event.shiftKey ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id]);
  }

  function onWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    setZoom((current) => Math.min(10, Math.max(0.65, current * (event.deltaY > 0 ? 0.9 : 1.1))));
  }

  async function saveProjectToDevice() {
    if (!drawing) return;
    const stem = safeName(drawing.name.replace(/\.[^.]+$/, "")) || "arqueocad-proyecto";
    const dxf = toDxf(drawing.primitives, drawing.unit);
    const svg = toSvg(drawing.primitives, drawing.name);
    try {
      if (window.showDirectoryPicker) {
        const directory = await window.showDirectoryPicker({ mode: "readwrite" });
        const dxfHandle = await directory.getFileHandle(`${stem}.dxf`, { create: true });
        const dxfWriter = await dxfHandle.createWritable();
        await dxfWriter.write(dxf);
        await dxfWriter.close();
        const svgHandle = await directory.getFileHandle(`${stem}.svg`, { create: true });
        const svgWriter = await svgHandle.createWritable();
        await svgWriter.write(svg);
        await svgWriter.close();
        setToast(`${t.savedProject}: ${stem}`);
        return;
      }
      // Safari/iOS and older Android WebViews do not expose directory access.
      // Keep the workflow useful by downloading an editable DXF instead.
      const blob = new Blob([dxf], { type: "application/dxf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${stem}.dxf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast(`${t.savedProject}: ${stem}.dxf`);
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") setToast(t.saveCancelled);
    }
  }

  function createExport() {
    if (!drawing) return;
    const chosenLayers = drawing.layers.filter((layer) => layer.selected && !layer.auxiliary);
    if (!chosenLayers.length || (!exportFormats.dxf && !exportFormats.svg)) return;
    const stem = safeName(drawing.name.replace(/\.[^.]+$/, ""));
    const files: { name: string; content: string }[] = [];
    const groups = exportMode === "layers"
      ? chosenLayers.map((layer) => ({ suffix: safeName(layer.name), names: [layer.name] }))
      : [{ suffix: lang === "es" ? "seleccion" : lang === "ar" ? "selection_ar" : "selection", names: chosenLayers.map((layer) => layer.name) }];
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
    <main className="app-shell" dir={lang === "ar" ? "rtl" : "ltr"} onDragOver={(event) => { event.preventDefault(); setDraggingFile(true); }} onDragLeave={() => setDraggingFile(false)} onDrop={(event) => { event.preventDefault(); setDraggingFile(false); const file = event.dataTransfer.files[0]; if (file) void readFile(file); }}>
      <input ref={planInputRef} className="sr-only" type="file" accept=".dxf,.dwg,.svg" onChange={onPlanInput} />
      <input ref={rasterInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" onChange={onRasterInput} />

      <header className="topbar">
        <button className="brand-block brand-home" onClick={goToCover} aria-label={t.home}><div className="brand-mark" aria-hidden="true"><span>A</span></div><div><strong>ArchaeoCAD</strong><small>{t.brandTag} · {APP_VERSION}</small></div></button>
        <div className="file-summary" title={drawing?.name ?? t.noDrawing}>
          <span className="format-badge">{drawing ? (drawing.format === "RASTER" ? "IMG" : drawing.format) : "—"}</span>
          <div><strong>{drawing?.name ?? t.noDrawing}</strong><small>{drawing ? `${drawing.primitives.length.toLocaleString(lang)} ${t.entities} · ${drawing.layers.length} ${t.layers.toLowerCase()} · ${drawing.unit}` : t.noDrawingMeta}</small></div>
        </div>
        <div className="top-actions">
          <span className="privacy-note"><span className="status-dot" />{t.local}</span>
          {drawing && <label className="project-switcher-wrap"><span>{t.switchProject}</span><select className="project-switcher" value={`${drawing.name}-${drawing.format}`} onChange={(event) => { const project = recentProjects.find((item) => item.id === event.target.value); if (project) openRecentProject(project); }} aria-label={t.switchProject}>{recentProjects.filter((project) => project.drawing).map((project) => <option key={project.id} value={project.id}>{project.name.replace(/\.[^.]+$/, "")}</option>)}</select></label>}
          {drawing && <button className="save-project-trigger" onClick={() => void saveProjectToDevice()} aria-label={t.saveProject}><span aria-hidden="true">⇩</span><b>{t.saveProject}</b></button>}
          {!installed && <button className="install-trigger" onClick={() => setInstallOpen(true)} aria-label={t.install}><span aria-hidden="true">⇩</span><b>{t.install}</b></button>}
          <label className="language-select-wrap"><span>{t.chooseLanguage}</span><select className="language-select" value={lang} onChange={(event) => setLang(event.target.value as Lang)} aria-label={t.chooseLanguage}>{languageOptions.map((option) => <option key={option.code} value={option.code}>{option.code.toUpperCase()} — {option.label}</option>)}</select></label>
          <button className="help-trigger" onClick={() => setHelpOpen(true)} aria-label={t.help} title={t.help}>?</button>
        </div>
      </header>

      <section className={`workspace ${drawing ? "" : "empty-workspace"}`}>
        <nav className="tool-rail" aria-label={t.mobileTools}>
          <button onClick={() => planInputRef.current?.click()}><span className="tool-glyph">＋</span><small>{t.openShort}</small></button>
          <button onClick={() => rasterInputRef.current?.click()}><span className="tool-glyph">▧</span><small>{t.vectorizeShort}</small></button>
          <button disabled={!drawing} onClick={() => void saveProjectToDevice()}><span className="tool-glyph">⇩</span><small>{t.saveProject}</small></button>
          <button disabled={!drawing} className={activePanel === "layers" ? "active" : ""} onClick={() => setActivePanel(activePanel === "layers" ? null : "layers")}><span className="tool-glyph layers-glyph">▤</span><small>{t.layers}</small></button>
          <button disabled={!drawing} className={measureMode ? "active" : ""} onClick={() => { setMeasureMode((current) => !current); setActivePanel(null); }}><span className="tool-glyph">⌁</span><small>{t.measure}</small></button>
          <button disabled={!drawing} className={activePanel === "warnings" ? "active" : ""} onClick={() => setActivePanel(activePanel === "warnings" ? null : "warnings")}><span className="tool-glyph warning-glyph">!</span><small>{t.warnings}</small>{Boolean(drawing?.warnings.length) && <span className="notification-count">{drawing?.warnings.length}</span>}</button>
          <button disabled={!drawing} onClick={() => setLibraryOpen(true)}><span className="tool-glyph">◇</span><small>{lang === "es" ? "Símbolos" : "Symbols"}</small></button>
          <button disabled={!drawing} onClick={() => setView3dOpen(true)}><span className="tool-glyph">▱</span><small>{lang === "es" ? "Vista 3D" : "3D view"}</small></button>
          <div className="rail-spacer" />
          <button disabled={!drawing} onClick={resetView}><span className="tool-glyph">⌗</span><small>{t.fit}</small></button>
        </nav>

        {!drawing ? <section className="cover-area">
          <div className="cover-hero"><img className="cover-image" src="./og.png" alt="ArchaeoCAD Mobile, planimetría de excavación" /><div className="cover-scrim" /><div className="cover-copy"><span className="eyebrow">{t.coverEyebrow}</span><h1>{t.coverTitle}</h1><p>{t.coverBody}</p><div className="cover-actions"><button className="primary-button" onClick={() => planInputRef.current?.click()}>＋ {t.open}</button><button className="cover-secondary" onClick={() => rasterInputRef.current?.click()}>▧ {t.vectorize}</button></div><small className="cover-formats">{t.coverFormats}</small><div className="cover-private"><span className="status-dot" />{t.privateNote}</div></div></div>
          <section className="recent-projects" aria-label={t.projects}><div className="recent-projects-heading"><strong>{t.projects}</strong><span>{recentProjects.length}/8</span></div>{recentProjects.length ? <div className="recent-project-list">{recentProjects.map((project) => <article key={project.id} className="recent-project"><button className="recent-project-main" onClick={() => openRecentProject(project)} title={project.drawing ? t.openProject : t.projectUnavailable} disabled={!project.drawing}><strong title={project.name}>{project.name.replace(/\.[^.]+$/, "")}</strong><small>{project.format} · {project.entities} {t.entities} · {project.layers} {t.layers.toLowerCase()}</small></button><button onClick={() => deleteRecentProject(project.id)} aria-label={`${t.deleteProject}: ${project.name}`} title={t.deleteProject}>×</button></article>)}</div> : <p className="recent-project-empty">{t.noProjects}</p>}</section>
        </section> : <>
          <section className="canvas-area" aria-label={t.drawing}>
            <div className="canvas-toolbar"><div className="crumb"><span>{t.drawing}</span><b>/</b><strong>{drawing.name.replace(/\.[^.]+$/, "")}</strong></div><div className="view-controls"><button onClick={() => setZoom((value) => Math.max(0.65, value / 1.2))} aria-label={t.zoomOut}>−</button><output>{Math.round(zoom * 100)}%</output><button onClick={() => setZoom((value) => Math.min(10, value * 1.2))} aria-label={t.zoomIn}>＋</button><button onClick={resetView} aria-label={t.fit}>⌗</button></div></div>
            <div className={`drawing-board ${measureMode ? "measuring" : ""}`}><div className="grid-overlay" style={{ opacity: gridEnabled ? 1 : 0 }} /><section className={`vector-toolbox ${vectorToolsOpen ? "" : "collapsed"}`} aria-label={vt.title}><div className="vector-toolbox-heading"><strong>{vt.title}</strong><span>{selectedEntityIds.length} {vt.selected}</span><button className="vector-toolbox-toggle" onClick={() => setVectorToolsOpen((value) => !value)} aria-expanded={vectorToolsOpen} aria-label={vectorToolsOpen ? t.hideTools : t.showTools} title={vectorToolsOpen ? t.hideTools : t.showTools}>{vectorToolsOpen ? "−" : "+"}</button></div>{vectorToolsOpen && <><div className="vector-category-tabs">{(Object.keys(vectorCategoryTools) as VectorCategory[]).map((category) => <button key={category} className={vectorCategory === category ? "active" : ""} onClick={() => setVectorCategory(category)}>{vt[category]}</button>)}</div><div className="vector-tool-list">{vectorCategoryTools[vectorCategory].map((tool) => <button key={tool} className={`${vectorTool === tool ? "active" : ""} ${(tool === "snap" && snapEnabled) || (tool === "ortho" && orthoEnabled) || (tool === "grid" && gridEnabled) ? "toggled" : ""}`} onClick={() => applyVectorTool(tool)} title={vt[tool]}><span>{vectorToolIcons[tool]}</span><small>{vt[tool]}</small></button>)}</div>{draftPoints.length > 0 && <div className="vector-draft-hint">{draftPoints.length} {t.draftHint}</div>}</>}</section><svg ref={svgRef} className="cad-canvas" viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid meet" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={() => { if (vectorTool === "polyline" && draftPoints.length >= 2) { const layer = drawing.layers.find((candidate) => !candidate.auxiliary)?.name ?? "01_ESTRUCTURAS"; const entity: Primitive = { id: newEntityId("draw"), type: "polyline", layer, color: drawing.layers.find((candidate) => candidate.name === layer)?.color, points: draftPoints }; setDrawing((current) => current ? { ...current, primitives: [...current.primitives, entity] } : current); setSelectedEntityIds([entity.id]); setDraftPoints([]); setVectorTool("select"); } }} onPointerCancel={() => { vertexDragRef.current = null; dragRef.current = null; }} onWheel={onWheel} role="img" aria-label={`${drawing.name}, ${drawing.layers.length} ${t.layers.toLowerCase()}`}>
              {visiblePrimitives.map((entity) => {
                const color = entity.color ?? drawing.layers.find((layer) => layer.name === entity.layer)?.color ?? "#ece8dd";
                const dash = entity.lineType === "dashed" ? `${strokeWidth * 8} ${strokeWidth * 5}` : undefined;
                const selected = selectedEntityIds.includes(entity.id);
                const selectionProps = { onPointerDown: (event: ReactPointerEvent<SVGElement>) => onEntityPointerDown(event, entity.id), style: { cursor: "pointer" } };
                if (entity.type === "polyline" && entity.points?.length) return <polyline key={entity.id} {...selectionProps} points={entity.points.map((point) => `${point.x},${sy(point.y)}`).join(" ")} fill={entity.closed ? "rgba(214,163,75,0.06)" : "none"} stroke={selected ? "#ffd166" : color} strokeWidth={selected ? strokeWidth * 2.3 : strokeWidth} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />;
                if (entity.type === "circle" && entity.center) return <circle key={entity.id} {...selectionProps} cx={entity.center.x} cy={sy(entity.center.y)} r={entity.radius ?? 1} fill="none" stroke={selected ? "#ffd166" : color} strokeWidth={selected ? strokeWidth * 2.3 : strokeWidth} strokeDasharray={dash} opacity="0.9" />;
                if (entity.type === "point" && entity.center) return <circle key={entity.id} {...selectionProps} cx={entity.center.x} cy={sy(entity.center.y)} r={strokeWidth * 2.3} fill={selected ? "#ffd166" : color} />;
                if (entity.type === "text" && entity.center) return <text key={entity.id} {...selectionProps} x={entity.center.x} y={sy(entity.center.y)} fill={selected ? "#ffd166" : color} fontSize={entity.height ?? 1} fontFamily="ui-monospace, monospace" transform={`rotate(${-(entity.rotation ?? 0)} ${entity.center.x} ${sy(entity.center.y)})`}>{entity.text}</text>;
                return null;
              })}
              {draftPoints.length > 0 && <polyline points={draftPoints.map((point) => `${point.x},${sy(point.y)}`).join(" ")} fill="none" stroke="#ffd166" strokeWidth={strokeWidth * 1.8} strokeDasharray={`${strokeWidth * 5} ${strokeWidth * 3}`} />}
              {vectorTool === "vertices" && selectedEntityIds.flatMap((id) => { const entity = visiblePrimitives.find((item) => item.id === id); return entity?.type === "polyline" && entity.points ? entity.points.map((point, index) => <circle key={`${id}-vertex-${index}`} cx={point.x} cy={sy(point.y)} r={strokeWidth * 4} fill="#11191b" stroke="#ffd166" strokeWidth={strokeWidth * 1.4} onPointerDown={(event) => { event.stopPropagation(); vertexDragRef.current = { id, index }; }} />) : []; })}
              {measurePoints.length > 0 && <polyline points={measurePoints.map((point) => `${point.x},${sy(point.y)}`).join(" ")} fill="none" stroke="#ffcc66" strokeWidth={strokeWidth * 2} strokeDasharray={`${strokeWidth * 5} ${strokeWidth * 3}`} />}
              {measurePoints.map((point, index) => <g key={`measure-${index}`}><circle cx={point.x} cy={sy(point.y)} r={strokeWidth * 5} fill="#121a1c" stroke="#ffcc66" strokeWidth={strokeWidth * 1.5} /><text x={point.x} y={sy(point.y) + strokeWidth * 1.8} textAnchor="middle" fill="#ffcc66" fontSize={strokeWidth * 6}>{index + 1}</text></g>)}
            </svg><div className="north-arrow" aria-label={t.north}><span>N</span><i>↑</i></div><div className="scale-bar"><i style={{ width: `${Math.min(110, 55 * zoom)}px` }} /><span>{Math.max(1, Math.round(bounds.width / (10 * zoom)))} {drawing.unit === "metros" ? "m" : "u"}</span></div>{measureMode && <div className="measure-hint"><span>⌁</span>{t.measureHint}</div>}</div>
            <footer className="statusbar"><span><i className="status-dot" />{vectorTool === "select" ? t.ready : `${vt.ready}: ${vt[vectorTool]}`}</span><span>{cursorPoint ? `X ${cursorPoint.x.toFixed(2)} · Y ${cursorPoint.y.toFixed(2)}` : `X ${viewX.toFixed(2)} · Y ${(bounds.maxY - viewY).toFixed(2)}`}</span><span>{selectedEntityIds.length} {vt.selected} · 1:{Math.max(1, Math.round(100 / zoom))}</span></footer>
          </section>

          <aside className={`side-panel ${activePanel ? "open" : ""}`}>
            {activePanel === "layers" && <><div className="panel-heading"><div><span className="eyebrow">{t.content}</span><h2>{t.layers}</h2></div><button className="close-panel" onClick={() => setActivePanel(null)} aria-label={t.close}>×</button></div><div className="layer-stats"><span><b>{selectedCount}</b> {t.selected}</span><i /><span><b>{visibleCount}</b> {t.visible}</span></div><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} /></label><div className="select-actions"><button onClick={() => selectAll(true)}>{t.all}</button><button onClick={() => selectAll(false)}>{t.none}</button></div><div className="layer-list">{filteredLayers.map((layer) => <div className="layer-row" key={layer.name}><button className={`eye-button ${layer.visible ? "visible" : ""}`} onClick={() => updateLayer(layer.name, "visible")} aria-label={`${layer.visible ? t.hide : t.show} ${layer.name}`}><span /></button><label><input type="checkbox" checked={layer.selected} onChange={() => updateLayer(layer.name, "selected")} /><span className="custom-check">✓</span></label><span className="layer-swatch" style={{ background: layer.color }} /><div className="layer-name"><strong>{layer.name}</strong><small>{layer.count} {t.entities}{layer.auxiliary ? ` · ${t.auxiliaryLabel}` : ""}</small></div></div>)}</div><p className="panel-help"><span>i</span>{t.layerHelp}</p><div className="panel-footer"><button className="primary-button export-button" onClick={() => setExportOpen(true)} disabled={!selectedCount}><span>⇩</span>{t.export}<small>{selectedCount}</small></button></div></>}
            {activePanel === "warnings" && <><div className="panel-heading"><div><span className="eyebrow">{t.quality}</span><h2>{t.warnings}</h2></div><button className="close-panel" onClick={() => setActivePanel(null)} aria-label={t.close}>×</button></div><div className="warning-list">{drawing.warnings.length ? drawing.warnings.map((warning, index) => <article key={index}><span>!</span><p>{warningText(warning, lang)}</p></article>) : <div className="empty-state"><span>✓</span><p>{t.noWarnings}</p></div>}</div></>}
             {activePanel === "warnings" && reviewEntities.length > 0 && <section className="review-card"><div className="panel-heading"><div><span className="eyebrow">OCR / CAD</span><h3>{t.reviewTitle}</h3></div></div><p>{t.reviewHelp}</p><div className="review-list">{reviewEntities.map((entity) => <label key={entity.id}><span>{entity.type === "text" ? entity.text : entity.id}</span><small>{Math.round((entity.confidence ?? 0) * 100)}% {t.confidenceLabel}</small><select value={entity.layer} onChange={(event) => moveEntityToLayer(entity.id, event.target.value)} aria-label={`${t.reviewTarget} ${entity.id}`}>{layers.filter((layer) => !layer.auxiliary).map((layer) => <option key={layer.name} value={layer.name}>{layer.name}</option>)}</select></label>)}</div></section>}
           </aside>
        </>}
      </section>

      <footer className="license-footer"><span>{t.footerText}</span><strong><a href="http://josejaviermartinez.com/digital-laboratory/" target="_blank" rel="noreferrer">Laboratorio Digital</a></strong><small className="app-version-footer">{APP_VERSION}</small></footer>

      <nav className="mobile-nav" aria-label={t.mobileTools}><button onClick={() => planInputRef.current?.click()}><span>＋</span>{t.openShort}</button><button onClick={() => rasterInputRef.current?.click()}><span>▧</span>{t.vectorizeShort}</button><button disabled={!drawing} onClick={undoDrawing} title={lang === "es" ? "Deshacer" : "Undo"}><span>↶</span>{lang === "es" ? "Deshacer" : "Undo"}</button><button disabled={!drawing} onClick={redoDrawing} title={lang === "es" ? "Rehacer" : "Redo"}><span>↷</span>{lang === "es" ? "Rehacer" : "Redo"}</button><button disabled={!drawing} onClick={() => void saveProjectToDevice()}><span>⇩</span>{t.saveProject}</button><button disabled={!drawing} className={activePanel === "layers" ? "active" : ""} onClick={() => setActivePanel(activePanel === "layers" ? null : "layers")}><span>▤</span>{t.layers}</button><button disabled={!drawing} className={measureMode ? "measure-fab active" : "measure-fab"} onClick={() => { setMeasureMode((value) => !value); setActivePanel(null); }}><span>⌁</span>{t.measure}</button><button disabled={!drawing} onClick={() => setActivePanel(activePanel === "warnings" ? null : "warnings")}><span>!</span>{t.warnings}</button><button disabled={!drawing} onClick={() => setExportOpen(true)}><span>⇩</span>{t.export}</button></nav>

      {drawing && measureMode && measurePoints.length > 0 && <section className="measurement-card"><div><span>{t.length}</span><strong>{metrics.length.toFixed(2)} {drawing.unit === "metros" ? "m" : "u"}</strong></div>{measurePoints.length > 2 && <><div><span>{t.area}</span><strong>{metrics.area.toFixed(2)} {drawing.unit === "metros" ? "m²" : "u²"}</strong></div><div><span>{t.perimeter}</span><strong>{metrics.perimeter.toFixed(2)} {drawing.unit === "metros" ? "m" : "u"}</strong></div></>}{measurePoints.length > 1 && <div><span>{t.azimuth}</span><strong>{metrics.azimuth.toFixed(1)}°</strong></div>}<button onClick={() => setMeasurePoints((points) => points.slice(0, -1))}>{t.undo}</button><button onClick={() => setMeasurePoints([])}>{t.clear}</button></section>}

      {installOpen && !installed && <div className="modal-backdrop install-backdrop"><section className="install-card" role="dialog" aria-modal="true" aria-labelledby="install-title"><button className="install-close" onClick={dismissInstall} aria-label={t.close}>×</button><div className="install-app-icon" aria-hidden="true"><span>A</span></div><span className="eyebrow">ARCHAEOCAD MOBILE · {APP_VERSION}</span><h2 id="install-title">{t.installTitle}</h2><p>{t.installBody}</p>{installMode !== "native" && <div className="install-instruction"><span>{installMode === "ios" ? "□↑" : "⋮"}</span><strong>{installMode === "ios" ? t.installIos : t.installManual}</strong></div>}<div className="install-actions"><button className="secondary-button" onClick={dismissInstall}>{t.installLater}</button><button className="primary-button" onClick={() => void installApp()}>{installMode === "native" ? t.installNow : t.understood}</button></div></section></div>}

      {helpOpen && <div className="modal-backdrop help-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><div className="modal-heading"><div><span className="eyebrow">ARCHAEOCAD MOBILE · {APP_VERSION}</span><h2 id="help-title">{t.helpTitle}</h2></div><button onClick={() => setHelpOpen(false)} aria-label={t.close}>×</button></div><p className="help-intro">{t.helpIntro}</p><div className="help-grid"><article><span>01</span><div><h3>{t.helpOpenTitle}</h3><p>{t.helpOpenBody}</p></div></article><article><span>02</span><div><h3>{t.helpRasterTitle}</h3><p>{t.helpRasterBody}</p></div></article><article><span>03</span><div><h3>{t.helpLayersTitle}</h3><p>{t.helpLayersBody}</p></div></article><article><span>04</span><div><h3>{t.helpMeasureTitle}</h3><p>{t.helpMeasureBody}</p></div></article><article><span>05</span><div><h3>{t.helpExportTitle}</h3><p>{t.helpExportBody}</p></div></article><article><span>06</span><div><h3>{t.helpInstallTitle}</h3><p>{t.helpInstallBody}</p></div></article></div><div className="help-tip"><strong>{t.helpTipsTitle}</strong><p>{t.helpTipsBody}</p></div><div className="help-credits"><strong>{t.helpCreditsTitle}</strong><p>{t.helpCreditsBody}</p><nav aria-label={t.helpCreditsTitle}><a href="https://github.com/JJ-Martinez-Garcia/ArqueoCAD" target="_blank" rel="noreferrer">ArchaeoCAD · GitHub</a><a href="https://github.com/autotrace/autotrace" target="_blank" rel="noreferrer">AutoTrace · GPL/LGPL</a><a href="https://github.com/visioncortex/vtracer" target="_blank" rel="noreferrer">VTracer · MIT</a><a href="https://github.com/PhenX/Trazor" target="_blank" rel="noreferrer">Trazor · MIT</a><a href="https://github.com/facebook/react" target="_blank" rel="noreferrer">React · MIT</a></nav></div><div className="modal-actions"><button className="primary-button" onClick={() => setHelpOpen(false)}>{t.close}</button></div></section></div>}

      {exportOpen && drawing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setExportOpen(false); }}><section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title"><div className="modal-heading"><div><span className="eyebrow">{drawing.name}</span><h2 id="export-title">{t.exportTitle}</h2></div><button onClick={() => setExportOpen(false)} aria-label={t.close}>×</button></div><div className="export-summary"><span className="file-stack">▧</span><div><strong>{selectedCount} {t.layers.toLowerCase()}</strong><small>{drawing.primitives.filter((entity) => drawing.layers.find((layer) => layer.name === entity.layer)?.selected).length} {t.prepared}</small></div></div><fieldset><legend>{t.organisation}</legend><label className={exportMode === "layers" ? "choice selected" : "choice"}><input type="radio" name="mode" checked={exportMode === "layers"} onChange={() => setExportMode("layers")} /><span className="radio-dot" /><div><strong>{t.perLayer}</strong><small>{selectedCount} × {Number(exportFormats.dxf) + Number(exportFormats.svg)} {t.files}</small></div></label><label className={exportMode === "filtered" ? "choice selected" : "choice"}><input type="radio" name="mode" checked={exportMode === "filtered"} onChange={() => setExportMode("filtered")} /><span className="radio-dot" /><div><strong>{t.filtered}</strong><small>{t.keepTogether}</small></div></label></fieldset><fieldset><legend>{t.outputs}</legend><div className="format-grid"><label className={exportFormats.dxf ? "format-choice selected" : "format-choice"}><input type="checkbox" checked={exportFormats.dxf} onChange={() => setExportFormats((value) => ({ ...value, dxf: !value.dxf }))} /><span>DXF</span><small>{t.editable}</small></label><label className={exportFormats.svg ? "format-choice selected" : "format-choice"}><input type="checkbox" checked={exportFormats.svg} onChange={() => setExportFormats((value) => ({ ...value, svg: !value.svg }))} /><span>SVG</span><small>{t.inkscape}</small></label></div></fieldset><label className="option-line"><input type="checkbox" defaultChecked /><span className="custom-check">✓</span>{t.blocks}</label><label className="option-line"><input type="checkbox" /><span className="custom-check">✓</span>{t.auxiliary}</label><div className="modal-actions"><button className="secondary-button" onClick={() => setExportOpen(false)}>{t.cancel}</button><button className="primary-button" onClick={createExport} disabled={!selectedCount || (!exportFormats.dxf && !exportFormats.svg)}><span>⇩</span>{t.download}</button></div></section></div>}

      {rasterJob && <div className="modal-backdrop"><section className="raster-modal" role="dialog" aria-modal="true" aria-labelledby="raster-title"><div className="modal-heading"><div><span className="eyebrow">{rasterJob.file.name}</span><h2 id="raster-title">{t.rasterTitle}</h2></div><button onClick={closeRaster} aria-label={t.close}>×</button></div><p className="raster-intro">{t.rasterIntro}</p><div className="raster-layout"><div><span className="field-label">{t.sourceImage}</span><div className="raster-preview"><img src={rasterJob.url} alt={rasterJob.file.name} style={{ filter: `grayscale(1) contrast(${1 + threshold / 90})` }} /><span>{t.rasterFeature}</span></div><div className="raster-feature"><b>⌁</b><p><strong>{t.rasterFeature}</strong>{t.rasterFeatureBody}</p></div></div><div className="raster-controls"><fieldset><legend>{t.detection}</legend><label className="range-field"><span><b>{t.threshold}</b><output>{threshold}</output></span><input type="range" min="70" max="230" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /><small>{t.thresholdHelp}</small></label><label className="range-field"><span><b>{t.simplify}</b><output>{simplify.toFixed(1)}</output></span><input type="range" min="0.2" max="3" step="0.2" value={simplify} onChange={(event) => setSimplify(Number(event.target.value))} /><small>{t.simplifyHelp}</small></label><label className="select-field"><span>{t.detail}</span><select value={detail} onChange={(event) => setDetail(Number(event.target.value) as RasterOptions["detail"])}><option value="3">{t.detailHigh}</option><option value="2">{t.detailBalanced}</option><option value="1">{t.detailFast}</option></select></label><label className="option-line raster-option"><input type="checkbox" checked={classifyLines} onChange={() => setClassifyLines((value) => !value)} /><span className="custom-check">✓</span><span><b>{t.classify}</b><small>{t.classifyHelp}</small></span></label><label className="option-line raster-option"><input type="checkbox" checked={ocrEnabled} onChange={() => setOcrEnabled((value) => !value)} /><span className="custom-check">✓</span><span><b>{t.ocr}</b><small>{t.ocrHelp}</small></span></label></fieldset><fieldset><legend>{t.calibration}</legend><div className="calibration-grid"><label><span>{t.realWidth}</span><input type="number" min="0" step="any" value={realWidth} onChange={(event) => setRealWidth(event.target.value)} placeholder={t.widthPlaceholder} /></label><label><span>{t.unit}</span><select value={rasterUnit} onChange={(event) => setRasterUnit(event.target.value as RasterOptions["unit"])}><option value="m">m</option><option value="cm">cm</option><option value="mm">mm</option><option value="unit">u</option></select></label></div><small>{t.noCalibration}</small><label className="option-line raster-option"><input type="checkbox" checked={detectScale} onChange={() => setDetectScale((value) => !value)} /><span className="custom-check">✓</span><span><b>{t.detectScale}</b><small>{t.scaleHelp}</small></span></label>{detectScale && <div className="calibration-grid"><label><span>{t.scaleLength}</span><input type="number" min="0" step="any" value={scaleBarLength} onChange={(event) => setScaleBarLength(event.target.value)} /></label><label><span>{t.unit}</span><output className="unit-output">{rasterUnit === "unit" ? "u" : rasterUnit}</output></label></div>}</fieldset></div></div><div className="modal-actions"><button className="secondary-button" onClick={closeRaster} disabled={vectorizing}>{t.cancel}</button><button className="primary-button" onClick={() => void runVectorizer()} disabled={vectorizing}>{vectorizing ? <><span className="spinner" />{t.processing}</> : <>⌁ {t.process}</>}</button></div></section></div>}

      {dwgOpen && <div className="modal-backdrop"><section className="export-modal small-modal" role="dialog" aria-modal="true"><div className="dwg-symbol">DWG</div><h2>{t.dwgTitle}</h2><p>{t.dwgBody}</p>{dwgInfo && <div className="dwg-inspection"><strong>{dwgInfo.release}</strong><small>{dwgInfo.version} · {(dwgInfo.size / 1024).toFixed(1)} KB</small></div>}<small>{lang === "es" ? "Conversión directa local con LibreDWG-WASM:" : "Local direct conversion with LibreDWG-WASM:"}</small><button className="primary-button" onClick={() => void convertDwg()} disabled={dwgConverting}>{dwgConverting ? (lang === "es" ? "Convirtiendo…" : "Converting…") : (lang === "es" ? "Convertir a DXF aquí" : "Convert to DXF here")}</button><small>{dwgBridge.note}</small><a className="secondary-button" href={dwgBridge.converterUrl} target="_blank" rel="noreferrer">ODA File Converter</a><button className="secondary-button" onClick={() => setDwgOpen(false)}>{t.cancel}</button></section></div>}
      {libraryOpen && drawing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLibraryOpen(false); }}><section className="export-modal symbol-modal" role="dialog" aria-modal="true" aria-labelledby="symbols-title"><div className="modal-heading"><div><span className="eyebrow">FREECAD-LIBRARY · CAD</span><h2 id="symbols-title">{lang === "es" ? "Biblioteca arqueológica" : "Archaeology library"}</h2></div><button onClick={() => setLibraryOpen(false)} aria-label={t.close}>×</button></div><p>{lang === "es" ? "Inserta símbolos paramétricos en la capa activa y edítalos con las herramientas vectoriales." : "Insert parametric symbols into the active layer and edit them with vector tools."}</p><div className="symbol-grid">{archaeologySymbols.map((symbol) => <button key={symbol.id} className="symbol-card" onClick={() => addSymbol(symbol.id)}><svg viewBox="-1 -1 8 6" aria-hidden="true"><polyline points={symbol.points.map((point) => `${point.x},${-point.y + 4}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="0.16" /></svg><strong>{lang === "es" ? symbol.name.split(" /")[0] : (symbol.name.split("/")[1] ?? symbol.name)}</strong><small>{symbol.description}</small></button>)}</div><div className="modal-actions"><button className="secondary-button" onClick={() => setLibraryOpen(false)}>{t.close}</button></div></section></div>}
      {view3dOpen && drawing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setView3dOpen(false); }}><section className="export-modal view3d-modal" role="dialog" aria-modal="true" aria-labelledby="view3d-title"><div className="modal-heading"><div><span className="eyebrow">OPENCASCADE · CADQUERY</span><h2 id="view3d-title">{lang === "es" ? "Vista 3D experimental" : "Experimental 3D view"}</h2></div><button onClick={() => setView3dOpen(false)} aria-label={t.close}>×</button></div><p>{lang === "es" ? "Extrusión local de polígonos cerrados. La geometría original 2D permanece intacta." : "Local extrusion of closed polygons. Original 2D geometry remains unchanged."}</p><svg className="solid-preview" viewBox="-120 -90 240 180" role="img" aria-label="3D preview">{drawing.primitives.flatMap((entity) => extrudePrimitive(entity, Math.max(1, bounds.height / 30)).map((face, index) => { const pts = face.points.map((point) => { const projected = projectIsometric(point, 1); return `${projected.x},${projected.y}`; }).join(" "); return <polygon key={`${entity.id}-${index}`} points={pts} fill={face.kind === "top" ? "rgba(214,163,75,.3)" : "rgba(77,153,161,.28)"} stroke="#ffd166" strokeWidth="0.7" />; }))}</svg><div className="modal-actions"><button className="secondary-button" onClick={() => setView3dOpen(false)}>{t.close}</button></div></section></div>}
      {draggingFile && <div className="drop-overlay"><div><span>＋</span><h2>{t.drop}</h2><p>{t.dropFormats}</p></div></div>}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
