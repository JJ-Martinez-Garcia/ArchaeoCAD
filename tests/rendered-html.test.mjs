import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships ArqueoCAD as a multilingual installable mobile application", async () => {
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
  assert.match(page, /Este es un software gratuito y de libre distribución creado por José Javier Martínez/);
  assert.match(page, /http:\/\/www\.josejaviermartinez\.com/);
  assert.match(page, /const APP_VERSION = "v8"/);
  assert.match(page, /aria-pressed=\{lang === "es"\}>ES<\/button>/);
  assert.match(page, /aria-pressed=\{lang === "en"\}>EN<\/button>/);
  assert.match(page, /aria-pressed=\{lang === "ar"\}>AR<\/button>/);
  assert.match(page, /من الميدان إلى مخطط منظم في طبقات/);
  assert.match(page, /document\.documentElement\.dir = lang === "ar" \? "rtl" : "ltr"/);
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /installPrompt\.prompt/);
  assert.match(page, /Añadir a pantalla de inicio/);
  assert.match(page, /no dentro de ChatGPT/);
  assert.match(vectorizer, /function thin/);
  assert.match(vectorizer, /tracePaths/);
  assert.match(vectorizer, /adaptiveBinary/);
  assert.match(vectorizer, /detailLimit/);
  assert.match(vectorizer, /01_ESTRUCTURAS/);
  assert.match(vectorizer, /04_EJES_SECCIONES/);
  assert.match(vectorizer, /scaleBarLength/);
  assert.match(vectorizer, /must never be eroded/);
  assert.match(layout, /ArqueoCAD Mobile/);
  assert.match(layout, /apple-mobile-web-app-capable/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /scope: "\/"/);
  assert.match(manifest, /prefer_related_applications: false/);
  assert.match(manifest, /icon-192\.png/);
  assert.match(manifest, /icon-maskable-512\.png/);
  assert.match(serviceWorker, /CACHE_NAME/);
});
