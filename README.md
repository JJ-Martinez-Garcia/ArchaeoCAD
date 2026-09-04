# ArqueoCAD Mobile

Versión web móvil de [ArqueoCAD](https://github.com/JJ-Martinez-Garcia/ArqueoCAD), orientada al trabajo de campo arqueológico.

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

La aplicación se distribuye bajo los mismos términos GPL-3.0 del proyecto original.

