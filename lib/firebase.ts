import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions as _getFunctions, type Functions } from "firebase/functions";

// Public client config (same project as the Comeleal / Foodpass app).
const firebaseConfig = {
  apiKey: "AIzaSyB6JpeqOiPEFyELSHl9p64v2XPXk6uN9Xk",
  appId: "1:111825516835:web:c224c2dfd3148dcd627496",
  projectId: "foodpass-18b33",
  authDomain: "foodpass-18b33.firebaseapp.com",
  storageBucket: "foodpass-18b33.firebasestorage.app",
  messagingSenderId: "111825516835",
} as const;

let app: FirebaseApp;

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0]!;
  }
  return app;
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

export function getFirebaseFunctions(): Functions {
  return _getFunctions(getFirebaseApp(), "us-central1");
}
