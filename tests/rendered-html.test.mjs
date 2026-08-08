import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships ArqueoCAD as a bilingual installable mobile application", async () => {
  const [page, vectorizer, layout, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/raster-vectorizer.ts", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/manifest.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
  ]);

  assert.match(page, /ArqueoCAD/);
  assert.match(page, /accept="\.dxf,\.dwg,\.svg"/);
  assert.match(page, /makeZip/);
  assert.match(page, /measurePoints/);
  assert.match(page, /El archivo se procesa solo en este dispositivo/);
  assert.match(page, /From the field to a layered drawing/);
  assert.match(page, /src="\/og\.png"/);
  assert.match(page, /useState<Drawing \| null>\(null\)/);
  assert.match(page, /image\/png,image\/jpeg,image\/webp,image\/bmp/);
  assert.match(vectorizer, /function thin/);
  assert.match(vectorizer, /tracePaths/);
  assert.match(vectorizer, /VECTOR_RASTER/);
  assert.match(layout, /ArqueoCAD Mobile/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(serviceWorker, /CACHE_NAME/);
});
