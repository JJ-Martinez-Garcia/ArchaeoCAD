export const dwgBridge = {
  name: "LibreDWG / ODA bridge",
  status: "external-converter",
  supportedInput: ["DWG"],
  note: "La web y Android usan LibreDWG-WASM; la aplicación Tauri intenta primero OpenCADStudio instalado localmente y vuelve a LibreDWG si no está disponible.",
  converterUrl: "https://www.opendesign.com/guestfiles/oda_file_converter",
};

const releaseCodes: Record<string, string> = { AC1015: "AutoCAD 2000", AC1018: "AutoCAD 2004", AC1021: "AutoCAD 2007", AC1024: "AutoCAD 2010", AC1027: "AutoCAD 2013", AC1032: "AutoCAD 2018" };

export async function inspectDwg(file: File) {
  const header = new TextDecoder("ascii").decode(await file.slice(0, 32).arrayBuffer());
  const version = header.slice(0, 6).replace(/[^A-Z0-9]/g, "");
  return { version, release: releaseCodes[version] ?? "DWG compatible", size: file.size };
}

export async function convertDwgToDxf(file: File): Promise<Uint8Array> {
  const { LibreDwg } = await import("@mlightcad/libredwg-web");
  // Use the published WASM artifact so GitHub Pages does not need to carry a
  // 10 MB binary in every app revision. The converter remains client-side;
  // the drawing bytes are never uploaded to our server.
  const converter = await LibreDwg.create("https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.10/wasm");
  const result = converter.dwg_write_dxf(await file.arrayBuffer());
  if (!result) throw new Error("DWG conversion failed");
  return result instanceof Uint8Array ? result : new Uint8Array(result);
}

export async function convertDwgToDxfNative(file: File): Promise<Uint8Array> {
  const internals = (window as Window & { __TAURI_INTERNALS__?: { invoke?: (command: string, args?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
  if (!internals?.invoke) throw new Error("Tauri API unavailable");
  const bytes = await internals.invoke("convert_dwg_with_opencadstudio", { input: Array.from(new Uint8Array(await file.arrayBuffer())) }) as number[];
  return new Uint8Array(bytes);
}
