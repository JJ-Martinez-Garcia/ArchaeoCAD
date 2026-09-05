# ArchaeoCAD

Aplicación web de [ArchaeoCAD](https://github.com/JJ-Martinez-Garcia/ArchaeoCAD), orientada al trabajo de campo arqueológico.

## Sitio web y aplicación

La aplicación PWA está disponible en:

**[https://jj-martinez-garcia.github.io/ArchaeoCAD/](https://jj-martinez-garcia.github.io/ArchaeoCAD/)**

Puede abrirse desde un navegador de escritorio o móvil y permite instalarse como aplicación cuando el navegador es compatible.

## Funciones

- Abre planos DXF y SVG directamente en el navegador.
- Vectoriza escaneados y fotografías mediante binarización, limpieza, adelgazado del trazo y simplificación geométrica.
- Permite calibrar el ancho real de una imagen antes de generar DXF o SVG.
- Mantiene separadas la visibilidad de una capa y su selección para exportar.
- Mide longitud, perímetro, área y acimut topográfico.
- Exporta las capas elegidas como DXF y SVG dentro de un paquete ZIP.
- Incluye edición 2D por categorías: dibujo, transformación, geometría, precisión, capas y orden de dibujo.
- Historial de deshacer/rehacer con atajos Ctrl/Cmd+Z, Shift+Z y Y.
- Biblioteca de símbolos arqueológicos paramétricos inspirada en FreeCAD-library.
- Vista 3D experimental local para extruir polígonos cerrados, inspirada en OpenCascade/CadQuery.
- Funciona como aplicación instalable y conserva una copia de la interfaz para uso sin conexión.
- Procesa los planos localmente: los archivos no se suben a un servidor.
- Incluye una interfaz completa en español e inglés seleccionable desde la cabecera.

DWG puede convertirse directamente a DXF en el navegador mediante [LibreDWG Web](https://github.com/mlightcad/libredwg-web) (GPL-3.0), cargado bajo demanda desde su distribución WASM. También se ofrece ODA File Converter como alternativa para archivos incompatibles.

## Módulos CAD y hoja de ruta integrada

1. **Vectorización raster**: normalización de contraste, máscaras cromáticas independientes, trazado por componentes y curvas suavizadas.
2. **Edición 2D**: punto, línea, polilínea, polígono, círculo, arco, mover, copiar, rotar, escalar, espejo, offset, partir, unir y explotar.
3. **Clasificación**: capas de estructuras, curvas, ejes, tramas, símbolos, textos, escala/norte y marco, con revisión manual y confianza.
4. **Intercambio CAD**: DXF/SVG nativos y conversión DWG local mediante LibreDWG Web.
5. **Vista 3D**: extrusión experimental de polígonos cerrados para inspección rápida.
6. **Biblioteca arqueológica**: símbolos paramétricos editables inspirados en FreeCAD-library.
7. **OCR**: etiquetas y cotas editables en su propia capa.
8. **Rendimiento móvil**: límites de resolución y recorrido para mantener la PWA receptiva en WebViews.
9. **Control de calidad**: avisos de trazos abiertos, entidades diminutas, duplicados y baja confianza.

Las funciones de terceros se mantienen separadas por módulos para respetar sus licencias: React/Vite (MIT), VTracer (MIT), Trazor (MIT), ImageTracerJS (BSD-2-Clause si se incorpora) y LibreDWG (GPL-3.0). Debe conservarse el texto de licencia de cada dependencia al distribuir una compilación.

## Desarrollo

Requiere Node.js 22 o posterior.

```bash
npm install
npm run dev
npm run build
```

## Derechos y licencias

Copyright © José Javier Martínez García. ArchaeoCAD se distribuye como software libre bajo los términos de la **GNU General Public License v3.0 (GPL-3.0)**, conforme al proyecto original. Consulta el aviso de licencia del repositorio en [LICENSE](./LICENSE) y el texto completo en [gnu.org](https://www.gnu.org/licenses/gpl-3.0.html).

Los créditos y avisos de terceros deben conservarse al redistribuir una compilación:

- [React](https://github.com/facebook/react): MIT.
- [Vite](https://github.com/vitejs/vite): MIT.
- [VTracer](https://github.com/visioncortex/vtracer): MIT.
- [Tesseract.js](https://github.com/naptha/tesseract.js): Apache-2.0.
- [LibreDWG](https://github.com/LibreDWG/libredwg) y su puente web: GPL-3.0.
- [OpenCascade/CadQuery](https://github.com/CadQuery/cadquery): LGPL-3.0 y Apache-2.0 según el componente utilizado.

La aplicación procesa los archivos localmente en el dispositivo; no se envían planos a un servidor de ArchaeoCAD. Las licencias de cada dependencia prevalecen sobre esta nota cuando se distribuyen sus propios componentes.

