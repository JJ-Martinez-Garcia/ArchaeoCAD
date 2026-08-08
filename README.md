# ArqueoCAD Mobile

Versión web móvil de [ArqueoCAD](https://github.com/JJ-Martinez-Garcia/ArqueoCAD), orientada al trabajo de campo arqueológico.

## Funciones

- Abre planos DXF y SVG directamente en el navegador.
- Vectoriza escaneados y fotografías mediante binarización, limpieza, adelgazado del trazo y simplificación geométrica.
- Permite calibrar el ancho real de una imagen antes de generar DXF o SVG.
- Mantiene separadas la visibilidad de una capa y su selección para exportar.
- Mide longitud, perímetro, área y acimut topográfico.
- Exporta las capas elegidas como DXF y SVG dentro de un paquete ZIP.
- Funciona como aplicación instalable y conserva una copia de la interfaz para uso sin conexión.
- Procesa los planos localmente: los archivos no se suben a un servidor.
- Incluye una interfaz completa en español e inglés seleccionable desde la cabecera.

DWG sigue necesitando una conversión previa a DXF mediante ODA File Converter, igual que en la aplicación de escritorio.

## Desarrollo

Requiere Node.js 22 o posterior.

```bash
npm install
npm run dev
npm run build
```

La aplicación se distribuye bajo los mismos términos GPL-3.0 del proyecto original.
