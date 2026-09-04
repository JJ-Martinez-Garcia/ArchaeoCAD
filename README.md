# ArchaeoCAD

Aplicación web progresiva (PWA) para visualizar, revisar, editar y vectorizar planos arqueológicos desde el navegador, el móvil o el ordenador.

## Aplicación pública

- **GitHub Pages:** https://jj-martinez-garcia.github.io/ArchaeoCAD/
- **Repositorio:** https://github.com/JJ-Martinez-Garcia/ArchaeoCAD

La aplicación funciona como una PWA instalable desde navegadores compatibles. Los archivos de trabajo se procesan localmente en el dispositivo siempre que sea posible.

## Funciones principales

- Apertura y visualización de archivos DXF y SVG.
- Importación de imágenes PNG, JPG y WEBP.
- Vectorización de imágenes rasterizadas.
- Clasificación de geometría por capas.
- Reconocimiento OCR de textos.
- Exportación a DXF y SVG.
- Herramientas de dibujo, edición, precisión y organización.
- Interfaz multilingüe: ES, EN, AR, FR, DE, IT, PT, ZH, HI, RU y JA.
- Almacenamiento y apertura de proyectos recientes en el dispositivo.
- Instalación como aplicación independiente en móvil y escritorio.

## Créditos

ArchaeoCAD es un software gratuito y de libre distribución creado por **José Javier Martínez** para el [Laboratorio Digital](http://josejaviermartinez.com/digital-laboratory/).

Sitio web del autor: [josejaviermartinez.com](http://www.josejaviermartinez.com)

## Código fuente y bibliotecas

El código fuente de la aplicación se mantiene en este repositorio. La aplicación utiliza, entre otras, estas bibliotecas de código abierto:

- [React](https://github.com/facebook/react) y [React DOM](https://github.com/facebook/react) — MIT.
- [Tesseract.js](https://github.com/naptha/tesseract.js) — Apache-2.0.
- [VTracer](https://github.com/visioncortex/vtracer) / [vtracer-webapp](https://github.com/visioncortex/vtracer) — licencias indicadas por sus respectivos repositorios.
- [Vite](https://github.com/vitejs/vite) — MIT.
- [TypeScript](https://github.com/microsoft/TypeScript) — Apache-2.0.
- [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) — MIT.
- [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) — Apache-2.0.

Las licencias completas de cada dependencia se encuentran en sus repositorios y en los paquetes instalados. Los avisos y condiciones de terceros deben conservarse al redistribuir una copia.

## Licencia de ArchaeoCAD

La aplicación se ofrece gratuitamente y puede distribuirse sin coste. El código original y los recursos creados específicamente para ArchaeoCAD pertenecen a José Javier Martínez. Para reutilizar, modificar o redistribuir el código original en otros proyectos, consulta al autor y conserva esta atribución y los avisos de licencia de terceros.

## Desarrollo local

Requisitos: Node.js 22 o posterior.

```bash
npm install
npm run dev
```

Para generar una compilación:

```bash
npm run build
```

## Avisos

La vectorización y el OCR son asistencias automáticas: revisa siempre la geometría, las capas, las escalas y los textos antes de utilizar un plano como documentación definitiva.
