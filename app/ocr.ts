export type OcrText = {
  text: string;
  confidence: number;
  box: { x0: number; y0: number; x1: number; y1: number };
};

import workerUrl from "tesseract.js/dist/worker.min.js?url";

const OCR_TIMEOUT_MS = 15000;
type OcrWorker = {
  setParameters: (parameters: Record<string, string>) => Promise<unknown>;
  recognize: (image: HTMLCanvasElement) => Promise<{ data: OcrBlockData }>;
  terminate: () => Promise<unknown>;
};
type OcrBlockData = { blocks?: OcrBlock[] };
type OcrBlock = { paragraphs?: OcrParagraph[] };
type OcrParagraph = { lines?: OcrLine[] };
type OcrLine = { words?: OcrWord[] };
type OcrWord = { text: string; confidence: number; bbox: OcrText["box"] };

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * OCR runs only when the user enables it. Tesseract caches its WebAssembly
 * core and language data in the browser, so subsequent plans are faster.
 * The result is intentionally limited to words with a usable bounding box;
 * uncertain words remain out of the CAD drawing instead of creating noise.
 */
export async function recognizeRasterText(source: HTMLCanvasElement): Promise<OcrText[]> {
  if (typeof window === "undefined") return [];
  let worker: OcrWorker | null = null;
  let timeout: number | undefined;
  try {
    const { createWorker } = await import("tesseract.js");
    const work = (async () => {
      const activeWorker = await createWorker("spa+eng", 1, {
        logger: () => undefined,
        // Blob workers are blocked by the CSP of some installed PWAs. The
        // bundled worker URL works in Chrome, Safari and older Android WebView.
        workerBlobURL: false,
        workerPath: workerUrl,
        cacheMethod: "write",
      });
      const typedWorker = activeWorker as unknown as OcrWorker;
      worker = typedWorker;
      await typedWorker.setParameters({
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
        user_defined_dpi: "200",
      });
      const result = await typedWorker.recognize(source);
      const words = (result.data.blocks ?? [])
        .flatMap((block) => block.paragraphs ?? [])
        .flatMap((paragraph) => paragraph.lines ?? [])
        .flatMap((line) => line.words ?? []);
      return words.map((word) => ({
        text: cleanText(word.text),
        confidence: Number(word.confidence) || 0,
        box: word.bbox,
      })).filter((word) => word.text.length > 0 && word.confidence >= 28 && word.box.x1 > word.box.x0 && word.box.y1 > word.box.y0);
    })();
    const timedOut = new Promise<OcrText[]>((resolve) => {
      timeout = window.setTimeout(() => {
        void worker?.terminate();
        resolve([]);
      }, OCR_TIMEOUT_MS);
    });
    return await Promise.race([work, timedOut]);
  } catch {
    // OCR is an enhancement. If a browser blocks the worker or language data
    // is unavailable, vectorization continues without text primitives.
    return [];
  } finally {
    if (timeout) window.clearTimeout(timeout);
    await worker?.terminate().catch(() => undefined);
  }
}
