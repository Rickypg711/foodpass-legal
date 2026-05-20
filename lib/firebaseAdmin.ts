import { readFileSync } from "fs";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const PROJECT_ID = "foodpass-18b33";

function loadServiceAccount(): Record<string, unknown> | null {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv?.trim()) {
    return JSON.parse(jsonEnv) as Record<string, unknown>;
  }
  const path =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path?.trim()) {
    return JSON.parse(readFileSync(path.trim(), "utf8")) as Record<string, unknown>;
  }
  return null;
}

let adminApp: App | undefined;

export function getFirebaseAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
    return adminApp;
  }

  const sa = loadServiceAccount();
  if (!sa) {
    throw new Error("firebase_admin_credentials_missing");
  }
  adminApp = initializeApp({
    credential: cert(sa as Parameters<typeof cert>[0]),
    projectId: PROJECT_ID,
  });
  return adminApp;
}

export function hasFirebaseAdminCredentials(): boolean {
  return loadServiceAccount() !== null;
}

export function getFirebaseAdminDb(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}
