import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const firebaseConfig = useEmulators ? {
  apiKey: "demo-key", authDomain: "demo-quadmart.firebaseapp.com",
  projectId: "demo-quadmart", appId: "demo-quadmart-web",
} : {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// WebKit can buffer Firestore streaming responses indefinitely. Long-polling
// restores reads/listeners there; other browsers retain the SDK default transport.
// Track upstream: https://github.com/firebase/firebase-js-sdk/issues/9789
const webkit = typeof navigator !== "undefined" && /AppleWebKit/.test(navigator.userAgent)
  && !/(Chrome|Chromium|Edg|OPR)\//.test(navigator.userAgent);
export const db = initializeFirestore(app, webkit ? { experimentalForceLongPolling: true } : {});
export const auth = getAuth(app);

// The app instance survives hot reloads; connect each service only once.
if (useEmulators && !app.__quadmartEmulatorsConnected) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  app.__quadmartEmulatorsConnected = true;
}
