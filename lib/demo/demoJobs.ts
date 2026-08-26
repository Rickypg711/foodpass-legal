// El embudo menú-primero (STRATEGY_MENU_FIRST §6): capa cliente del demo.
//
// El prospecto NO tiene cuenta: auth anónima (la misma de los pedidos web),
// sube 1-3 fotos a menu_demos/{jobId}/ y crea menuDemoJobs/{jobId}. La
// función hace el resto y este módulo lo observa. El job se recuerda en
// localStorage para que "vuelve y aquí sigue tu menú" funcione (§6.7 —
// reanudación en dispositivo, porque el demo NO se comparte).

import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { ensureAnonymousUser } from "@/lib/auth";
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";

export const DEMO_JOB_STORE_KEY = "comeleal_demo_job_v1";
export const MAX_DEMO_PHOTOS = 3;

export type DemoItem = {
  name: string;
  description?: string;
  price: number;
  category?: string;
  optionGroups?: Array<{
    id: string;
    name: string;
    required: boolean;
    min: number;
    max: number;
    options: Array<{ id: string; name: string; priceDelta: number }>;
  }>;
};

export type DemoInfo = {
  restaurantName: string | null;
  phone: string | null;
  address: string | null;
  hoursText: string | null;
  businessHours: Record<string, unknown> | null;
  /** Tipo de restaurante clasificado por Gemini del menú completo (o null). */
  category?: string | null;
};

export type DemoJob = {
  id: string;
  uid: string;
  status: "processing" | "ready" | "failed";
  items?: DemoItem[];
  info?: DemoInfo;
  whatsapp?: string;
  errorMessage?: string;
  expiresAt?: Timestamp;
  convertedToRestaurantId?: string;
  stats?: { itemCount: number; rowCount: number; sizeFamilies: number };
};

// ── Núcleo puro (testeable): ¿el demo sigue vivo? ──────────────────────────
export function demoExpired(expiresAtMs: number | null, nowMs: number): boolean {
  return typeof expiresAtMs === "number" && Number.isFinite(expiresAtMs)
    ? nowMs >= expiresAtMs
    : false;
}

export function daysLeft(expiresAtMs: number | null, nowMs: number): number | null {
  if (typeof expiresAtMs !== "number" || !Number.isFinite(expiresAtMs)) return null;
  const d = Math.ceil((expiresAtMs - nowMs) / 86400000);
  return d > 0 ? d : 0;
}

// ── localStorage (best-effort, jamás truena) ───────────────────────────────
export function rememberDemoJob(jobId: string): void {
  try {
    window.localStorage.setItem(DEMO_JOB_STORE_KEY, jobId);
  } catch { /* best-effort */ }
}

export function recallDemoJob(): string | null {
  try {
    return window.localStorage.getItem(DEMO_JOB_STORE_KEY);
  } catch {
    return null;
  }
}

export function forgetDemoJob(): void {
  try {
    window.localStorage.removeItem(DEMO_JOB_STORE_KEY);
  } catch { /* best-effort */ }
}

// ── Compresión en cliente ──────────────────────────────────────────────────
// La foto de un teléfono moderno pesa 4-12MB; en datos móviles tarda y >8MB
// las reglas la rechazan. 2500px de lado largo conserva el texto del menú
// perfectamente legible para el parser y sube 10× más rápido. Si algo falla
// (HEIC raro, canvas bloqueado), se sube la original: jamás rompemos.
const MAX_SIDE = 2500;
const COMPRESS_OVER_BYTES = 1.5 * 1024 * 1024;

async function compressImage(file: File): Promise<File> {
  try {
    if (file.size <= COMPRESS_OVER_BYTES && file.type === "image/jpeg") return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.85),
    );
    if (!blob || blob.size === 0) return file;
    // Solo si de verdad ayudó (una JPEG ya chica no se re-comprime peor).
    if (blob.size >= file.size && scale === 1) return file;
    return new File([blob], "menu.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// ── Crear el job: subir fotos y sembrar el doc (dispara la función) ────────
export async function createDemoJob(
  photos: File[],
  whatsapp10: string | null,
): Promise<string> {
  const user = await ensureAnonymousUser();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();

  const jobRef = doc(collection(db, "menuDemoJobs"));
  const files = await Promise.all(
    photos.slice(0, MAX_DEMO_PHOTOS).map(compressImage),
  );
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const path = `menu_demos/${jobRef.id}/${i}.${ext}`;
    await uploadBytes(ref(storage, path), f, { contentType: f.type || "image/jpeg" });
    paths.push(path);
  }

  // La forma EXACTA que piden las reglas (hasOnly): whatsapp solo si viene.
  const payload: Record<string, unknown> = {
    uid: user.uid,
    status: "processing",
    photoPaths: paths,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (whatsapp10 && /^[0-9]{10}$/.test(whatsapp10)) payload.whatsapp = whatsapp10;
  await setDoc(jobRef, payload);
  rememberDemoJob(jobRef.id);
  return jobRef.id;
}

export function watchDemoJob(
  jobId: string,
  onChange: (job: DemoJob | null) => void,
): () => void {
  const db = getFirebaseDb();
  return onSnapshot(
    doc(db, "menuDemoJobs", jobId),
    (snap) => {
      onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as DemoJob) : null);
    },
    () => onChange(null),
  );
}

// ── Las estampas de la escalera (§6.2) — best-effort, jamás rompen el demo ─
async function stamp(jobId: string, field: string): Promise<void> {
  try {
    const db = getFirebaseDb();
    await updateDoc(doc(db, "menuDemoJobs", jobId), {
      [field]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch { /* best-effort */ }
}

export const stampViewed = (jobId: string) => stamp(jobId, "viewedAt");
export const stampPlayed = (jobId: string) => stamp(jobId, "playedDemoAt");
export const stampClaimStarted = (jobId: string) => stamp(jobId, "claimStartedAt");
