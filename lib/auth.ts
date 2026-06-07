import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirebaseApp } from "./firebase";

let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

/** Resolves when Firebase Auth has finished restoring session (or timed out). */
export function waitForAuthReady(): Promise<User | null> {
  const a = getFirebaseAuth();
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(a, (user) => {
      unsub();
      resolve(user);
    });
    setTimeout(() => {
      unsub();
      resolve(a.currentUser);
    }, 4000);
  });
}

/**
 * Sign in with Google popup — returns the authenticated user.
 * Same Firebase Auth UID as the Comeleal Flutter app when the vendor
 * later signs in with Google on mobile.
 */
export async function signInWithGoogle(): Promise<User> {
  const a = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(a, provider);
  return cred.user;
}

/**
 * Sign in with Facebook popup.
 * Requires Facebook provider enabled in Firebase Auth console.
 */
export async function signInWithFacebook(): Promise<User> {
  const a = getFirebaseAuth();
  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  const cred = await signInWithPopup(a, provider);
  return cred.user;
}

/**
 * Ensures a signed-in user (anonymous for guest checkout).
 * Required for Firestore order create/read per security rules.
 */
export async function ensureAnonymousUser(): Promise<User> {
  const a = getFirebaseAuth();
  await waitForAuthReady();
  if (a.currentUser) {
    return a.currentUser;
  }
  const cred = await signInAnonymously(a);
  return cred.user;
}
