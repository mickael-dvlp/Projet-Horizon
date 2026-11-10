// Stockage local des données invité. IndexedDB (quota bien plus large que
// les ~5 Mo du localStorage) est la copie principale ; le localStorage en
// garde une seconde, écrite de façon synchrone tant qu'elle tient dans son
// quota — c'est la seule écriture garantie terminée si la page se ferme
// juste après. Chaque copie porte sa date d'écriture ; à la lecture, la plus
// récente l'emporte.

const DB_NAME = "horizon";
const STORE_NAME = "data";

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function idbRequest(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = run(tx.objectStore(STORE_NAME));
    // Résolu à la fin de la transaction : les données sont alors écrites.
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Copie localStorage : { savedAt, data }. Un ancien enregistrement (données
// brutes, sans date) est accepté avec une date nulle.
function readLocalStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.savedAt === "number" && "data" in parsed) return parsed;
    return { savedAt: 0, data: parsed };
  } catch {
    return null;
  }
}

// Lit la copie la plus récente (IndexedDB ou localStorage), ou null.
export async function readLocalRecord(key) {
  const fromLocal = readLocalStorage(key);
  let fromIdb = null;
  try {
    fromIdb = (await idbRequest("readonly", (store) => store.get(key))) || null;
  } catch (error) {
    console.error("Lecture IndexedDB impossible :", error);
  }
  const candidates = [fromLocal, fromIdb].filter(Boolean);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.savedAt > best.savedAt ? c : best)).data;
}

// Écrit les deux copies. Renvoie une promesse résolue à true si au moins une
// copie est enregistrée (la copie IndexedDB une fois sa transaction
// terminée), false sinon.
export function writeLocalRecord(key, data) {
  const record = { savedAt: Date.now(), data };
  let localSaved = true;
  try {
    localStorage.setItem(key, JSON.stringify(record));
  } catch {
    localSaved = false;
    // Une copie plus ancienne laissée en place serait ignorée (plus vieille
    // que la copie IndexedDB) ; on libère tout de même la place.
    try {
      localStorage.removeItem(key);
    } catch {
      // Rien de plus à faire.
    }
  }
  return idbRequest("readwrite", (store) => store.put(record, key)).then(
    () => true,
    (error) => {
      console.error("Écriture IndexedDB impossible :", error);
      return localSaved;
    }
  );
}

export async function deleteLocalRecord(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Rien de plus à faire.
  }
  try {
    await idbRequest("readwrite", (store) => store.delete(key));
  } catch (error) {
    console.error("Suppression IndexedDB impossible :", error);
  }
}
