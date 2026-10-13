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

async function publishSharedData(entries, settings) {
  initCloud();

  const chunks = chunkEntries(entries);
  const existing = await cloudDb.collection(CLOUD_GAMES_COLLECTION).get();
  const keepIds = new Set(chunks.map((_, i) => chunkDocId(i)));

  // Firestore batches cap at 500 operations; we'd need ~hundreds of
  // thousands of games to get near that, but chunk the batches anyway.
  const ops = [];
  chunks.forEach((chunk, i) => {
    ops.push({
      ref: cloudDb.collection(CLOUD_GAMES_COLLECTION).doc(chunkDocId(i)),
      data: { index: i, count: chunk.length, json: JSON.stringify(chunk) }
    });
  });
  existing.docs.forEach((doc) => {
    if (!keepIds.has(doc.id)) {
      ops.push({ ref: doc.ref, remove: true });
    }
  });
  ops.push({
    ref: cloudDb.collection(CLOUD_META_COLLECTION).doc(CLOUD_SETTINGS_DOC),
    data: {
      json: JSON.stringify(settings || { aliases: {}, hidden: [], keepSingleGame: [] }),
      gameCount: entries.length,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }
  });

  for (let i = 0; i < ops.length; i += 400) {
    const batch = cloudDb.batch();
    ops.slice(i, i + 400).forEach((op) => {
      if (op.remove) {
        batch.delete(op.ref);
      } else {
        batch.set(op.ref, op.data);
      }
    });
    await batch.commit();
  }

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
