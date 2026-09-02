export type OcrText = {
  text: string;
  confidence: number;
  box: { x0: number; y0: number; x1: number; y1: number };
};

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
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("spa+eng", 1, {
      logger: () => undefined,
      workerBlobURL: true,
    });
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
        user_defined_dpi: "200",
      });
      const result = await worker.recognize(source);
      const words = (result.data.blocks ?? [])
        .flatMap((block) => block.paragraphs ?? [])
        .flatMap((paragraph) => paragraph.lines ?? [])
        .flatMap((line) => line.words ?? []);
      return words.map((word) => ({
        text: cleanText(word.text),
        confidence: Number(word.confidence) || 0,
        box: word.bbox,
      })).filter((word) => word.text.length > 0 && word.confidence >= 28 && word.box.x1 > word.box.x0 && word.box.y1 > word.box.y0);
    } finally {
      await worker.terminate();
    }
  } catch {
    // OCR is an enhancement. If a browser blocks the worker or language data
    // is unavailable, vectorization continues without text primitives.
    return [];
  }
}
