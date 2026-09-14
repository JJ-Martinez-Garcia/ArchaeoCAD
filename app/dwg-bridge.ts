export const dwgBridge = {
  name: "LibreDWG / ODA bridge",
  status: "external-converter",
  supportedInput: ["DWG"],
  note: "La PWA detecta DWG y ofrece conversión compatible; LibreDWG requiere un backend/WASM compilado por plataforma.",
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
