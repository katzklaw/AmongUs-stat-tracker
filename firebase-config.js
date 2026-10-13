// firebase-config.js
//
// Paste your Firebase project's web config here (Firebase console ->
// Project settings -> General -> "Your apps" -> Web app -> SDK setup and
// configuration -> "Config"). This is the same kind of config object your
// score-sheet project uses. It is NOT a secret - it's meant to be public;
// what actually protects your data is the Firestore security rules
// (see FIREBASE_SETUP.md).
//
// Until apiKey is filled in, the app runs exactly as before (local only,
// no sharing).

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDGJ_6rk-hyxr3ErbjlAlr2qVDwA5AkhjY",
  authDomain: "sussy-scoresheet.firebaseapp.com",
  databaseURL: "https://sussy-scoresheet-default-rtdb.firebaseio.com",
  projectId: "sussy-scoresheet",
  storageBucket: "sussy-scoresheet.firebasestorage.app",
  messagingSenderId: "152966582754",
  appId: "1:152966582754:web:507f41158b35c3d447e9bb"
};

// Only this Google account can publish to the shared database (this must
// match the email in your Firestore security rules too).
window.ADMIN_EMAIL = "katzklaw@gmail.com";
