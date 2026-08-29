// storage.js
//
// Games are stored one-per-record in IndexedDB, not as one giant array in
// localStorage. Two reasons: localStorage caps out around 5-10MB per site
// (a real collection of games hits that within a few hundred games), and
// localStorage's API only lets you rewrite the WHOLE stored blob at once -
// so every single file import was re-serializing and re-saving the entire
// growing collection, getting slower the bigger it got. IndexedDB's quota
// is much larger (typically hundreds of MB+) and lets us write just the
// one new/changed record.

const DB_NAME = "among-us-stat-tracker";
const DB_VERSION = 1;
const ENTRIES_STORE = "entries";  // keyPath: fingerprint
const META_STORE = "meta";        // out-of-line keys: "playerSettings", "playerDatabase"

const OLD_STORAGE_KEY = "among-us-stat-tracker-data";       // legacy localStorage key (entries)
const OLD_PLAYER_SETTINGS_KEY = "among-us-player-settings"; // legacy localStorage key (settings)

let dbPromise = null;

function openDatabase() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
        db.createObjectStore(ENTRIES_STORE, { keyPath: "fingerprint" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function getAllEntries(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENTRIES_STORE, "readonly");
    const request = tx.objectStore(ENTRIES_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function putEntries(db, entries) {
  return new Promise((resolve, reject) => {
    if (!entries.length) {
      resolve();
      return;
    }
    const tx = db.transaction(ENTRIES_STORE, "readwrite");
    const store = tx.objectStore(ENTRIES_STORE);
    for (const entry of entries) {
      store.put(entry);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function clearEntries(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENTRIES_STORE, "readwrite");
    tx.objectStore(ENTRIES_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getMeta(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const request = tx.objectStore(META_STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putMeta(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// One-time migration from the old localStorage-based format, so nobody's
// existing collection gets silently dropped by this upgrade. Safe to call
// every startup - it's a no-op once the old keys are gone.
async function migrateFromLocalStorageIfNeeded(db) {
  let legacyEntries = null;
  let legacySettings = null;

  try {
    const rawEntries = localStorage.getItem(OLD_STORAGE_KEY);
    if (rawEntries) {
      legacyEntries = JSON.parse(rawEntries);
    }
  } catch (err) {
    console.error("Couldn't read legacy saved games during migration:", err);
  }

  try {
    const rawSettings = localStorage.getItem(OLD_PLAYER_SETTINGS_KEY);
    if (rawSettings) {
      legacySettings = JSON.parse(rawSettings);
    }
  } catch (err) {
    console.error("Couldn't read legacy player settings during migration:", err);
  }

  if (!legacyEntries && !legacySettings) {
    return;
  }

  try {
    if (Array.isArray(legacyEntries) && legacyEntries.length) {
      for (const entry of legacyEntries) {
        if (entry && !entry.fingerprint) {
          // Very old entries saved before fingerprinting existed - give
          // them a fallback key so they aren't lost.
          entry.fingerprint = `legacy:${entry.fileName || Math.random()}`;
        }
      }
      await putEntries(db, legacyEntries.filter(Boolean));
    }

    if (legacySettings) {
      await putMeta(db, "playerSettings", legacySettings);
    }

    // Only clear the old keys once the migration actually succeeded.
    localStorage.removeItem(OLD_STORAGE_KEY);
    localStorage.removeItem(OLD_PLAYER_SETTINGS_KEY);
    console.log(`Migrated ${legacyEntries ? legacyEntries.length : 0} saved game(s) to the new storage format.`);

  } catch (err) {
    console.error("Migration to IndexedDB failed - keeping legacy data in place to retry next load:", err);
  }
}

let migrationPromise = null;
async function ensureMigrated(db) {
  if (!migrationPromise) {
    migrationPromise = migrateFromLocalStorageIfNeeded(db);
  }
  await migrationPromise;
}

async function loadStoredEntries() {
  try {
    const db = await openDatabase();
    await ensureMigrated(db);
    return await getAllEntries(db);
  } catch (err) {
    console.error("Failed to load saved games:", err);
    return [];
  }
}

// Saves/updates just the entries that actually changed, instead of
// rewriting the whole collection - the key performance fix for large
// collections.
async function saveEntries(entries) {
  const db = await openDatabase();
  await putEntries(db, entries);
}

async function deleteAllEntries() {
  const db = await openDatabase();
  await clearEntries(db);
}

async function loadPlayerSettings() {
  const defaults = {
    aliases: {},
    hidden: [],
    keepSingleGame: []
  };

  try {
    const db = await openDatabase();
    await ensureMigrated(db);
    const raw = await getMeta(db, "playerSettings");

    if (!raw) {
      return defaults;
    }

    // Migrate settings saved before keepSingleGame existed.
    return {
      aliases: raw.aliases || {},
      hidden: raw.hidden || [],
      keepSingleGame: raw.keepSingleGame || []
    };

  } catch (err) {
    console.error("Failed to load player settings:", err);
    return defaults;
  }
}

async function savePlayerSettings(settings) {
  const db = await openDatabase();
  await putMeta(db, "playerSettings", settings);
}

async function loadPlayerDatabaseRaw() {
  try {
    const db = await openDatabase();
    const raw = await getMeta(db, "playerDatabase");
    return raw || null;
  } catch (err) {
    console.error("Failed to load player database:", err);
    return null;
  }
}

async function savePlayerDatabaseRaw(playerDatabase) {
  const db = await openDatabase();
  await putMeta(db, "playerDatabase", playerDatabase);
}
