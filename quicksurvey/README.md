# Quick Survey — RAL Solutions

PWA web para inspección de edificios con acceso por cuerda. Pin defects on
elevation photos, track repair phases, review with clients.

## Stack

- React 18 + Vite (build tool)
- IndexedDB para persistencia (incluye fotos como Blobs)
- Web Worker para procesar fotos sin trabar la UI
- vite-plugin-pwa: service worker, manifest, instalable
- Sin backend (por ahora). Todo corre offline-first.

## Deploy a Vercel — sin Node local

Esta es la ruta recomendada. Vercel buildea por vos.

### 1) Crear el repo en GitHub

1. Andá a https://github.com/new
2. Crear un repo nuevo, ej: `quicksurvey`
3. Importante: dejá la opción "Initialize with README" **desactivada** (vamos a subir todo al toque)

### 2) Subir los archivos

Dos opciones:

**Opción A — Drag & drop desde la web de GitHub** (más fácil sin Node)

1. En tu repo nuevo, click en "uploading an existing file"
2. Arrastrá toda la carpeta `quicksurvey/` (con todos los archivos y subcarpetas)
3. Commit message: "Initial commit"
4. Click "Commit changes"

**Opción B — Git desde la terminal** (si ya tenés git)

```bash
cd quicksurvey
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/quicksurvey.git
git push -u origin main
```

### 3) Conectar a Vercel

1. Andá a https://vercel.com/new
2. "Import Git Repository" → seleccioná `quicksurvey`
3. Vercel detecta automáticamente:
   - Framework Preset: **Vite**
   - Build Command: `npm run build` (auto)
   - Output Directory: `dist` (auto)
4. Click **Deploy**

Vercel descarga las dependencias, corre `npm install` y `npm run build`, y
publica el resultado. Toma ~30-60 segundos la primera vez.

### 4) Tu URL

Vercel te da una URL tipo `https://quicksurvey.vercel.app`. Esa es tu PWA
en producción. Cada push a `main` redespliega solo.

## Hacer cambios sin Node local

Editás los archivos directamente en GitHub:

1. Abrí cualquier archivo en tu repo
2. Click en el ícono de lápiz (✏) arriba a la derecha
3. Editá, scrolleá abajo, "Commit changes"
4. Vercel detecta el push y redespliega solo en ~30s

Para cambios más grandes, usá GitHub Desktop o VSCode con la extensión
de GitHub — siguen sin necesitar Node local.

## Estructura del proyecto

```
quicksurvey/
├── index.html              ← shell mínimo + splash screen
├── package.json            ← dependencias y scripts
├── vite.config.js          ← config de Vite + PWA
├── .gitignore
├── public/
│   └── icons/              ← íconos PWA (puedo regenerar si querés cambiarlos)
└── src/
    ├── main.jsx            ← entry point
    ├── App.jsx             ← orquestador principal (canvas, gestos, modos)
    ├── lib/
    │   ├── constants.js    ← colores, status, repair types, hazards
    │   ├── helpers.js      ← format dates, hooks (debounce, mobile, online)
    │   ├── db.js           ← IndexedDB + migración base64→Blob + export/import
    │   └── photo.js        ← compresión + watermark (worker + fallback)
    ├── workers/
    │   └── photo.worker.js ← procesamiento de fotos off-main-thread
    └── components/
        ├── UserSetup.jsx   ← primera carga: nombre, empresa, rol
        ├── HomeScreen.jsx  ← lista de proyectos
        ├── Setup.jsx       ← wizard de nuevo proyecto
        ├── PinModal.jsx    ← modal de pin (la grande)
        ├── SummaryTable.jsx ← tabla de precios y resumen
        ├── SurveyReview.jsx ← flujo de aprobación del cliente
        ├── TrashPanel.jsx  ← restaurar pins borrados
        ├── DrawingCanvas.jsx ← dibujar arriba de fotos
        ├── PhotoNav.jsx    ← galería fullscreen
        ├── PhotoImg.jsx    ← carga async desde IndexedDB
        ├── Marker.jsx      ← pin individual en el canvas
        ├── RoleSwitcher.jsx ← cambiar rol/usuario
        └── Toast.jsx       ← notificación inferior
```

## Performance — qué cambió desde la versión anterior

1. **Sin Babel en el browser**: antes el HTML cargaba Babel para transpilar JSX
   en runtime. Ahora Vite lo precompila → 150-200ms menos en el TTI.
2. **Code splitting**: las modales pesadas (PinModal, SummaryTable, DrawingCanvas)
   solo se descargan cuando el usuario las abre. Bundle inicial mucho más chico.
3. **Fotos como Blobs**: antes los pins guardaban fotos como base64 (~33% más
   grandes que el binario). Ahora son Blobs en un store separado de IndexedDB,
   referenciadas por id. La lectura es lazy (con object URLs cacheados).
4. **Worker para procesar fotos**: el watermark + compresión corre en un Web
   Worker → la UI nunca se traba. Hay fallback a main thread para Safari viejo.
5. **GPU compositing en pins**: usamos `transform: translate3d()` y `willChange`
   para que el navegador los componga en GPU. Movimientos suaves incluso con
   100+ pins.
6. **Persistencia debounced**: las escrituras a IndexedDB pasan por un debounce
   de 400ms — no escribe en cada keystroke.
7. **Migración automática**: la primera vez que abrís un proyecto viejo, el
   código convierte solo todas las fotos base64 a Blobs y borra el campo viejo.

## Migración de datos viejos

Si ya tenés proyectos guardados en la versión single-file, la PWA los lee
automáticamente la primera vez. No tenés que hacer nada.

Si querés mover datos de un dispositivo a otro: Home → ⭳ exportar proyecto →
te baja un .json con todo (incluyendo fotos en base64). En el otro
dispositivo: Home → ⭱ IMPORT → seleccionás ese .json.

## Próximos pasos sugeridos

- **Reemplazar íconos**: los actuales son placeholders. Mandame uno de RAL en SVG
  o PNG 1024x1024 y los regenero.
- **Service worker custom**: si querés que la app pre-cachee imágenes de proyectos
  recientes para uso offline garantizado, hay que extender la config de
  vite-plugin-pwa. Por ahora cachea sí o sí JS/CSS/HTML/fonts.
- **Backend**: cuando estés listo, Supabase + un endpoint de sync. Te paso un
  diseño de schema cuando llegues a esa etapa.

## Comandos (si después decidís tener Node local)

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # build de producción → dist/
npm run preview    # preview del build local
```

Pero acordate: para Vercel **no necesitás nada de esto**. Vercel hace todo eso
en su servidor cuando hacés push.

---

Hecho con ❤ para [RAL Solutions](https://ralsolutions.co.nz) · Auckland, NZ
