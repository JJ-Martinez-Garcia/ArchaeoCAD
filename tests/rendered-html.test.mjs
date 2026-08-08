import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships ArqueoCAD as an installable mobile-first application", async () => {
  const [page, layout, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/manifest.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
  ]);

  assert.match(page, /ArqueoCAD/);
  assert.match(page, /accept="\.dxf,\.dwg,\.svg"/);
  assert.match(page, /makeZip/);
  assert.match(page, /measurePoints/);
  assert.match(page, /El archivo se procesa solo en este dispositivo/);
  assert.match(layout, /ArqueoCAD Mobile/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(serviceWorker, /CACHE_NAME/);
});
