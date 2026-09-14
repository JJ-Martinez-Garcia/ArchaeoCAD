import initWasm from "vtracer-webapp/vtracer_webapp_bg.wasm?init";
import * as bindings from "vtracer-webapp/vtracer_webapp_bg.js";

let ready: Promise<void> | null = null;

export function ensureVTracer() {
  if (!ready) {
    ready = initWasm({ "./vtracer_webapp_bg.js": bindings }).then((instance) => {
      // Vite's ?init loader resolves to a WebAssembly.Instance; wasm-bindgen
      // expects the instance exports object used by the generated bindings.
      bindings.__wbg_set_wasm(instance.exports);
    });
  }
  return ready;
}

export const { BinaryImageConverter } = bindings;
