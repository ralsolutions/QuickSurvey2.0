// IndexedDB wrapper with three stores:
//  - projects: full project JSON (without photo binaries)
//  - prices: per-project price table
//  - photos: photos as Blob, keyed by photoId — referenced from pins by id only

const DB_NAME = 'ral-quicksurvey';
const DB_VER = 2;  // bumped from 1: added photos store + migration
const STORE_PROJECTS = 'projects';
const STORE_PRICES = 'prices';
const STORE_PHOTOS = 'photos';

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_PRICES))   db.createObjectStore(STORE_PRICES,   { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_PHOTOS))   db.createObjectStore(STORE_PHOTOS,   { keyPath: 'id' });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = e => rej(e.target.error);
  });
}

// ── PROJECTS ──────────────────────────────────────────────────────────────────
export async function dbGetAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const req = tx.objectStore(STORE_PROJECTS).getAll();
    req.onsuccess = e => res(e.target.result || []);
    req.onerror = e => rej(e.target.error);
  });
}

export async function dbPut(project) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const req = tx.objectStore(STORE_PROJECTS).put(project);
    req.onsuccess = () => res();
    req.onerror = e => rej(e.target.error);
  });
}

export async function dbDelete(id) {
  const db = await openDB();
  // Delete project + its prices + its photos in parallel
  await Promise.all([
    new Promise((res, rej) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = e => rej(e.target.error);
    }),
    new Promise(res => {
      const tx = db.transaction(STORE_PRICES, 'readwrite');
      tx.objectStore(STORE_PRICES).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    }),
    deleteProjectPhotos(id).catch(() => {}),
  ]);
}

// ── PRICES ────────────────────────────────────────────────────────────────────
export async function dbGetPrices(projectId) {
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction(STORE_PRICES, 'readonly');
    const req = tx.objectStore(STORE_PRICES).get(projectId);
    req.onsuccess = e => res(e.target.result ? e.target.result.prices : {});
    req.onerror = () => res({});
  });
}

export async function dbSavePrices(projectId, prices) {
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction(STORE_PRICES, 'readwrite');
    tx.objectStore(STORE_PRICES).put({ id: projectId, prices });
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

// ── PHOTOS (Blobs) ────────────────────────────────────────────────────────────
//
// Photos are stored separately as Blobs so they don't bloat the project JSON.
// Each photo has a unique id; pins reference photos by id arrays:
//   pin.surveyPhotoIds = ['ph_abc123', 'ph_def456']
//
// On read, we generate object URLs on-demand and revoke them when no longer needed.

let _objectUrlCache = new Map(); // id → blobUrl

export function makePhotoId() {
  return 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function dbPutPhoto(id, blob, projectId) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    tx.objectStore(STORE_PHOTOS).put({ id, blob, projectId, createdAt: Date.now() });
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e.target.error);
  });
}

export async function dbGetPhoto(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction(STORE_PHOTOS, 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).get(id);
    req.onsuccess = e => res(e.target.result || null);
    req.onerror = () => res(null);
  });
}

// Returns a blob URL for a photo id — caches so the same id always returns the same URL
export async function getPhotoUrl(id) {
  if (!id) return null;
  if (_objectUrlCache.has(id)) return _objectUrlCache.get(id);
  const rec = await dbGetPhoto(id);
  if (!rec || !rec.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  _objectUrlCache.set(id, url);
  return url;
}

// Free a single object URL (does not delete the blob)
export function revokePhotoUrl(id) {
  const url = _objectUrlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    _objectUrlCache.delete(id);
  }
}

// Free all cached URLs (call when leaving a project)
export function revokeAllPhotoUrls() {
  for (const url of _objectUrlCache.values()) URL.revokeObjectURL(url);
  _objectUrlCache.clear();
}

export async function deletePhoto(id) {
  if (!id) return;
  revokePhotoUrl(id);
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    tx.objectStore(STORE_PHOTOS).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

export async function deleteProjectPhotos(projectId) {
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    const store = tx.objectStore(STORE_PHOTOS);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = e => {
      const cur = e.target.result;
      if (cur) {
        if (cur.value.projectId === projectId) cur.delete();
        cur.continue();
      }
    };
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

// ── MIGRATION: convert old base64 photos to Blob storage ──────────────────────
//
// Old format (v1 of the app): pin.surveyPhotos = ['data:image/jpeg;base64,...', ...]
// New format: pin.surveyPhotoIds = ['ph_abc', 'ph_def']
//
// Runs once on first open of a project that still has the old format.

function dataUrlToBlob(dataUrl) {
  // Parse data URL → Blob
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function migrateProjectIfNeeded(project) {
  if (!project || project._migratedToBlobs) return project;
  let changed = false;
  const newProject = { ...project, elevations: [...(project.elevations || [])] };

  for (let ei = 0; ei < newProject.elevations.length; ei++) {
    const el = { ...newProject.elevations[ei] };

    // Migrate elevation image (was base64)
    if (el.img && typeof el.img === 'string' && el.img.startsWith('data:')) {
      try {
        const blob = dataUrlToBlob(el.img);
        const id = makePhotoId();
        await dbPutPhoto(id, blob, project.id);
        el.imgPhotoId = id;
        delete el.img;
        changed = true;
      } catch (e) {
        console.warn('Failed to migrate elevation image', e);
      }
    }

    // Migrate pins
    const newPins = [];
    for (const pin of el.pins || []) {
      const newPin = { ...pin };
      for (const key of ['surveyPhotos', 'fixingPhotos', 'donePhotos']) {
        if (Array.isArray(newPin[key]) && newPin[key].length > 0 && typeof newPin[key][0] === 'string' && newPin[key][0].startsWith('data:')) {
          const ids = [];
          for (const dataUrl of newPin[key]) {
            try {
              const blob = dataUrlToBlob(dataUrl);
              const id = makePhotoId();
              await dbPutPhoto(id, blob, project.id);
              ids.push(id);
            } catch (e) {
              console.warn('Failed to migrate pin photo', e);
            }
          }
          newPin[key + 'Ids'] = ids;
          delete newPin[key];
          changed = true;
        }
      }
      newPins.push(newPin);
    }
    el.pins = newPins;
    newProject.elevations[ei] = el;
  }

  if (changed) {
    newProject._migratedToBlobs = true;
    await dbPut(newProject);
  }
  return newProject;
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────────────
//
// Bundles project + prices + all referenced photos as a single JSON file.
// Photos are encoded as base64 in the export so the file is portable.

async function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = e => res(e.target.result);
    fr.onerror = e => rej(e);
    fr.readAsDataURL(blob);
  });
}

export async function exportProject(project) {
  const prices = await dbGetPrices(project.id).catch(() => ({}));

  // Collect all photo ids referenced by this project
  const photoIds = new Set();
  for (const el of project.elevations || []) {
    if (el.imgPhotoId) photoIds.add(el.imgPhotoId);
    for (const pin of el.pins || []) {
      for (const key of ['surveyPhotoIds', 'fixingPhotoIds', 'donePhotoIds']) {
        for (const id of pin[key] || []) photoIds.add(id);
      }
    }
  }

  // Fetch each blob and convert to data URL
  const photos = {};
  for (const id of photoIds) {
    const rec = await dbGetPhoto(id);
    if (rec && rec.blob) {
      try { photos[id] = await blobToDataUrl(rec.blob); } catch (e) {}
    }
  }

  const bundle = {
    _type: 'ral-quicksurvey-export',
    _version: 2,
    _exportedAt: new Date().toISOString(),
    project, prices, photos,
  };
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quicksurvey-' + (project.name || 'project').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

export async function importProjectFromFile(file) {
  const text = await file.text();
  const bundle = JSON.parse(text);
  if (bundle._type !== 'ral-quicksurvey-export' || !bundle.project) throw new Error('Invalid Quick Survey export file');

  const p = bundle.project;
  const newId = Date.now().toString();
  const idMap = {}; // old photo id → new photo id

  // Restore photos with fresh ids tied to the new project
  if (bundle.photos) {
    for (const [oldId, dataUrl] of Object.entries(bundle.photos)) {
      try {
        const blob = dataUrlToBlob(dataUrl);
        const newPhotoId = makePhotoId();
        await dbPutPhoto(newPhotoId, blob, newId);
        idMap[oldId] = newPhotoId;
      } catch (e) {
        console.warn('Failed to import photo', e);
      }
    }
  }

  // Remap photo ids in the project
  const remappedElevations = (p.elevations || []).map(el => {
    const newEl = { ...el };
    if (newEl.imgPhotoId && idMap[newEl.imgPhotoId]) newEl.imgPhotoId = idMap[newEl.imgPhotoId];
    newEl.pins = (newEl.pins || []).map(pin => {
      const newPin = { ...pin };
      for (const key of ['surveyPhotoIds', 'fixingPhotoIds', 'donePhotoIds']) {
        if (Array.isArray(newPin[key])) {
          newPin[key] = newPin[key].map(id => idMap[id] || id).filter(Boolean);
        }
      }
      return newPin;
    });
    return newEl;
  });

  const imported = {
    ...p,
    id: newId,
    _importedFrom: p.id,
    _importedAt: new Date().toISOString(),
    _migratedToBlobs: true,
    name: p.name + ' (imported)',
    elevations: remappedElevations,
  };
  await dbPut(imported);
  if (bundle.prices && Object.keys(bundle.prices).length > 0) await dbSavePrices(newId, bundle.prices);
  return imported;
}
