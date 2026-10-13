// cloud.js - optional Firebase (Firestore) sharing layer.
//
// Model: the admin's browser is the source of truth (IndexedDB). "Publish"
// copies all parsed games + player settings (aliases/hidden) up to
// Firestore. Everyone else opens the site in shared view, which downloads
// that snapshot and runs it through the exact same stats code - so shared
// numbers always match what the admin sees.
//
// Games are stored in a few big "chunk" documents (each a JSON string,
// kept under Firestore's 1MiB doc limit) instead of one doc per game, so a
// visitor loading ~700 games costs a handful of reads, not 700.

const CLOUD_GAMES_COLLECTION = "amongus_games";
const CLOUD_META_COLLECTION = "amongus_meta";
const CLOUD_SETTINGS_DOC = "settings";
const CLOUD_CHUNK_BYTE_LIMIT = 700000;

let cloudDb = null;
let cloudAuth = null;

function isCloudConfigured() {
  const cfg = window.FIREBASE_CONFIG;
  return !!(cfg && cfg.apiKey && cfg.projectId && window.firebase);
}

function initCloud() {
  if (!isCloudConfigured()) {
    return false;
  }
  if (!cloudDb) {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    cloudDb = firebase.firestore();
    // Falls back to long-polling when the browser/network/extension blocks
    // Firestore's streaming connection (a common cause of silent hangs).
    cloudDb.settings({ experimentalAutoDetectLongPolling: true, merge: true });
    cloudAuth = firebase.auth();
  }
  return true;
}

function chunkEntries(entries) {
  const encoder = new TextEncoder();
  const chunks = [];
  let current = [];
  let currentBytes = 2;

  for (const entry of entries) {
    const size = encoder.encode(JSON.stringify(entry)).length + 1;
    if (current.length && currentBytes + size > CLOUD_CHUNK_BYTE_LIMIT) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(entry);
    currentBytes += size;
  }
  if (current.length) {
    chunks.push(current);
  }
  return chunks;
}

function chunkDocId(index) {
  return "chunk_" + String(index).padStart(4, "0");
}

async function fetchSharedData() {
  initCloud();

  const [gamesSnap, settingsSnap] = await Promise.all([
    cloudDb.collection(CLOUD_GAMES_COLLECTION).get(),
    cloudDb.collection(CLOUD_META_COLLECTION).doc(CLOUD_SETTINGS_DOC).get()
  ]);

  const chunkDocs = gamesSnap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() }))
    .sort((a, b) => (a.data.index || 0) - (b.data.index || 0));

  const entries = [];
  for (const chunk of chunkDocs) {
    entries.push(...JSON.parse(chunk.data.json));
  }

  const meta = settingsSnap.exists ? settingsSnap.data() : null;
  const settings = meta && meta.json ? JSON.parse(meta.json) : { aliases: {}, hidden: [], keepSingleGame: [] };

  return {
    entries,
    settings,
    updatedAt: meta && meta.updatedAt ? meta.updatedAt.toDate() : null,
    gameCount: entries.length
  };
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + " timed out after " + Math.round(ms / 1000) + "s - Firestore isn't responding. Check the Firestore database exists, rules are published, and ad/privacy blockers aren't blocking firestore.googleapis.com.")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Each chunk is its own write (a single batch of everything could exceed
// Firestore's 10MiB request limit), with progress reported as it goes.
async function publishSharedData(entries, settings, onProgress) {
  initCloud();
  const report = (msg) => { if (onProgress) onProgress(msg); };

  const chunks = chunkEntries(entries);

  report("Contacting Firestore...");
  const existing = await withTimeout(cloudDb.collection(CLOUD_GAMES_COLLECTION).get({ source: "server" }), 30000, "Reading existing data");
  const keepIds = new Set(chunks.map((_, i) => chunkDocId(i)));

  for (let i = 0; i < chunks.length; i++) {
    report(`Publishing chunk ${i + 1} of ${chunks.length}...`);
    await withTimeout(
      cloudDb.collection(CLOUD_GAMES_COLLECTION).doc(chunkDocId(i)).set({
        index: i,
        count: chunks[i].length,
        json: JSON.stringify(chunks[i])
      }),
      90000,
      `Writing chunk ${i + 1}`
    );
  }

  for (const doc of existing.docs) {
    if (!keepIds.has(doc.id)) {
      await withTimeout(doc.ref.delete(), 30000, "Removing old chunk");
    }
  }

  report("Saving settings...");
  await withTimeout(
    cloudDb.collection(CLOUD_META_COLLECTION).doc(CLOUD_SETTINGS_DOC).set({
      json: JSON.stringify(settings || { aliases: {}, hidden: [], keepSingleGame: [] }),
      gameCount: entries.length,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }),
    30000,
    "Saving settings"
  );

  return { chunks: chunks.length, games: entries.length };
}

async function cloudSignIn() {
  initCloud();
  const provider = new firebase.auth.GoogleAuthProvider();
  const result = await cloudAuth.signInWithPopup(provider);
  return result.user;
}

function cloudSignOut() {
  initCloud();
  return cloudAuth.signOut();
}

function onCloudAuthChange(callback) {
  initCloud();
  return cloudAuth.onAuthStateChanged(callback);
}
