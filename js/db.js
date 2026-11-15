// Dünne Hülle um IndexedDB. Kennt nur Stores und Schlüssel, keine Fachlogik.
//
// IndexedDB statt localStorage, weil Safari localStorage bei etwa 5 MB deckelt
// und das nach zwei Jahren Trainingslog knapp würde.

const DB_NAME = 'trainings-app';
const DB_VERSION = 1;

export const STORES = [
  'exercises', 'units', 'phases',
  'trainings', 'cardio', 'kneeChecks',
  'clearances', 'measurements',
  'meta',
];

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // Jede Schemastufe läuft genau einmal. Spätere Änderungen bekommen einen
      // eigenen Block "if (event.oldVersion < 2)" und DB_VERSION wird erhöht.
      if (event.oldVersion < 1) {
        for (const name of STORES) {
          db.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'id' });
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Eine neuere App-Version in einem anderen Tab will upgraden: Platz machen.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Die App ist noch in einem anderen Fenster offen. Bitte dort schließen.'));
  });
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Speichern abgebrochen'));
  });
}

export async function getAll(store) {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const req = tx.objectStore(store).getAll();
  await done(tx);
  return req.result;
}

export async function put(store, value) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await done(tx);
}

export async function putMany(store, values) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  await done(tx);
}

export async function remove(store, key) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
}

/**
 * Ersetzt den Inhalt der angegebenen Stores in einer einzigen Transaktion.
 * Scheitert ein Teil, bleibt alles beim alten Stand. Wichtig für Import und Reset.
 */
export async function replaceStores(data) {
  const db = await openDb();
  const names = Object.keys(data);
  const tx = db.transaction(names, 'readwrite');
  for (const name of names) {
    const os = tx.objectStore(name);
    os.clear();
    for (const v of data[name]) os.put(v);
  }
  await done(tx);
}
