"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

// ─── BarcodeDetector types (not in TS stdlib yet) ─────────────────────────────

declare global {
  interface Window {
    BarcodeDetector: {
      new (options: { formats: string[] }): BarcodeDetectorInstance;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

interface BarcodeDetectorInstance {
  detect(
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ): Promise<Array<{ rawValue: string; format: string }>>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanStage =
  | "loading"    // checking auth + getting restaurantId
  | "permission" // about to ask for camera
  | "scanning"   // camera active
  | "processing" // QR found, writing to Firestore
  | "success"    // scan written, showing result
  | "error"      // unrecoverable error
  | "unsupported"; // BarcodeDetector not available

interface ScanResult {
  customerName: string;
  pointsAwarded: number;
}

interface RestaurantMeta {
  restaurantId: string;
  pointsPerVisit: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);

  const [stage, setStage] = useState<ScanStage>("loading");
  const [restaurant, setRestaurant] = useState<RestaurantMeta | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0); // scans this session

  // ── Auth + load restaurant meta ──────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) {
        router.push("/activar");
        return;
      }

      try {
        const db = getFirebaseDb();
        const userSnap = await getDoc(doc(db, "users", u.uid));
        const rid = userSnap.data()?.ownedRestaurantId as string | undefined;

        if (!rid) {
          router.push("/activar");
          return;
        }

        const restSnap = await getDoc(doc(db, "restaurants", rid));
        const restData = restSnap.data();

        setRestaurant({
          restaurantId: rid,
          pointsPerVisit: restData?.pointsPerVisit ?? 1,
        });

        // Check BarcodeDetector support
        if (!("BarcodeDetector" in window)) {
          setStage("unsupported");
          return;
        }

        setStage("permission");
      } catch (err) {
        console.error("[scanner] init failed", err);
        setErrorMsg("No pudimos cargar. Intenta de nuevo.");
        setStage("error");
      }
    }
    init();
  }, [router]);

  // ── Camera + scanning loop ───────────────────────────────────────────────

  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      isProcessingRef.current = false;
      setStage("scanning");

      // Poll every 300ms
      scanIntervalRef.current = setInterval(async () => {
        if (
          !videoRef.current ||
          !detectorRef.current ||
          isProcessingRef.current ||
          videoRef.current.readyState < 2
        )
          return;

        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            isProcessingRef.current = true;
            if (scanIntervalRef.current) {
              clearInterval(scanIntervalRef.current);
              scanIntervalRef.current = null;
            }
            handleBarcode(barcodes[0].rawValue);
          }
        } catch {
          // Video frame not ready — ignore silently
        }
      }, 300);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Actívalo en Configuración."
          : "No pudimos acceder a la cámara.";
      setErrorMsg(msg);
      setStage("error");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Barcode handler ──────────────────────────────────────────────────────

  async function handleBarcode(raw: string) {
    if (!restaurant) return;
    setStage("processing");

    try {
      // Parse payload — support JSON and legacy comeleal:uid / foodpass:uid
      let userId: string | null = null;
      let isForVisit = true;

      try {
        const payload = JSON.parse(raw) as {
          userId?: string;
          isForVisit?: boolean;
        };
        userId = payload.userId ?? null;
        isForVisit = payload.isForVisit !== false;
      } catch {
        // Legacy format
        const parts = raw.split(":");
        if (parts.length === 2 && parts[1]) {
          userId = parts[1];
        }
      }

      if (!userId || !isForVisit) {
        setErrorMsg(
          !userId
            ? "QR inválido. Pide al cliente su código de fidelidad."
            : "Este QR es de canje, no de visita."
        );
        setStage("scanning");
        resumeScanning();
        return;
      }

      const db = getFirebaseDb();

      // Write visitHistory — Cloud Function handles everything downstream
      await addDoc(
        collection(db, "restaurants", restaurant.restaurantId, "visitHistory"),
        {
          userId,
          timestamp: serverTimestamp(),
          pointsAwarded: restaurant.pointsPerVisit,
        }
      );

      // Fetch customer name (best effort, non-blocking)
      let customerName = "Cliente";
      try {
        const customerSnap = await getDoc(doc(db, "users", userId));
        const name = customerSnap.data()?.displayName;
        if (typeof name === "string" && name.trim()) {
          customerName = name.trim().split(" ")[0]; // first name only
        }
      } catch {
        // No big deal — we already wrote the scan
      }

      setScanResult({ customerName, pointsAwarded: restaurant.pointsPerVisit });
      setScanCount((n) => n + 1);
      setStage("success");
    } catch (err) {
      console.error("[scanner] handleBarcode failed", err);
      setErrorMsg("Error al registrar el scan. Intenta de nuevo.");
      setStage("scanning");
      resumeScanning();
    }
  }

  function resumeScanning() {
    isProcessingRef.current = false;
    if (!scanIntervalRef.current && detectorRef.current) {
      scanIntervalRef.current = setInterval(async () => {
        if (
          !videoRef.current ||
          !detectorRef.current ||
          isProcessingRef.current ||
          videoRef.current.readyState < 2
        )
          return;
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            isProcessingRef.current = true;
            clearInterval(scanIntervalRef.current!);
            scanIntervalRef.current = null;
            handleBarcode(barcodes[0].rawValue);
          }
        } catch {
          // ignore
        }
      }, 300);
    }
  }

  function handleNextScan() {
    setErrorMsg(null);
    setScanResult(null);
    setStage("scanning");
    resumeScanning();
  }

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => stopScanning();
  }, [stopScanning]);

  // ─── Render ───────────────────────────────────────────────────────────────

  // ── Unsupported ──────────────────────────────────────────────────────────
  if (stage === "unsupported") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#141414] px-6 text-center">
        <div className="text-4xl">🚫</div>
        <div>
          <p className="font-semibold text-white">
            Cámara no compatible con este navegador
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Usa Chrome en Android o Safari en iOS 17+ para escanear códigos QR.
          </p>
        </div>
        <Link
          href="/vendor"
          className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-white/70 transition-colors hover:text-white"
        >
          ← Volver al panel
        </Link>
      </div>
    );
  }

  // ── Hard error ───────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#141414] px-6 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-sm leading-relaxed text-white/60">
          {errorMsg ?? "Error desconocido"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-[#d97757] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
          <Link
            href="/vendor"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-white/70 hover:text-white"
          >
            Volver
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141414]">
        <Spinner />
      </div>
    );
  }

  // ── Permission ask ───────────────────────────────────────────────────────
  if (stage === "permission") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#141414] px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#d97757]/15 text-3xl">
          📷
        </div>
        <div>
          <p className="text-xl font-bold text-white">Acceso a cámara</p>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Necesitamos tu cámara para leer los códigos QR de tus clientes.
          </p>
        </div>
        <button
          onClick={startCamera}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-[#d97757] py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#c46644] active:scale-[0.98]"
          style={{ boxShadow: "0 4px 20px rgba(242,140,56,0.3)" }}
        >
          Activar cámara
        </button>
        <Link
          href="/vendor"
          className="text-sm text-white/35 hover:text-white/60 transition-colors"
        >
          Cancelar
        </Link>
      </div>
    );
  }

  // ── Scanner (scanning | processing | success) ────────────────────────────
  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-black">
      {/* Camera feed */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Dark overlay + viewfinder cutout via box-shadow trick */}
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-[18%]">
        <div
          className="relative h-[260px] w-[260px] rounded-2xl"
          style={{ boxShadow: "0 0 0 100vmax rgba(0,0,0,0.58)" }}
        >
          {/* Corner brackets */}
          <span className="absolute -left-[2px] -top-[2px] h-9 w-9 rounded-tl-xl border-l-[3px] border-t-[3px] border-[#d97757]" />
          <span className="absolute -right-[2px] -top-[2px] h-9 w-9 rounded-tr-xl border-r-[3px] border-t-[3px] border-[#d97757]" />
          <span className="absolute -bottom-[2px] -left-[2px] h-9 w-9 rounded-bl-xl border-b-[3px] border-l-[3px] border-[#d97757]" />
          <span className="absolute -bottom-[2px] -right-[2px] h-9 w-9 rounded-br-xl border-b-[3px] border-r-[3px] border-[#d97757]" />

          {/* Scan beam */}
          {stage === "scanning" && (
            <div
              className="scanner-beam-line absolute left-3 right-3 h-[2px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #d97757 20%, #d97757cc 50%, #d97757 80%, transparent 100%)",
                animation: "scanner-beam 2s ease-in-out infinite",
                top: 12,
                boxShadow: "0 0 8px rgba(242,140,56,0.6)",
              }}
            />
          )}

          {/* Processing overlay */}
          {stage === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
              <Spinner />
            </div>
          )}
        </div>
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-safe pt-4">
        <Link
          href="/vendor"
          className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          ← Panel
        </Link>
        {scanCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-xs font-medium text-white/80">
              {scanCount} {scanCount === 1 ? "scan" : "scans"} esta sesión
            </span>
          </div>
        )}
      </div>

      {/* Instructions below frame */}
      <div className="absolute left-0 right-0 top-[calc(18%+280px)] flex flex-col items-center gap-2 px-6 text-center">
        {stage === "scanning" && !errorMsg && (
          <p
            className="text-sm font-medium text-white/60"
            style={{ animation: "fade-in-up 0.4s ease-out forwards" }}
          >
            Apunta al código QR del cliente
          </p>
        )}
        {stage === "processing" && (
          <p className="text-sm font-medium text-white/60">Registrando…</p>
        )}
        {errorMsg && stage === "scanning" && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-sm text-red-300 backdrop-blur-sm">
            {errorMsg}
          </p>
        )}
      </div>

      {/* ── Success bottom sheet ──────────────────────────────────────────── */}
      {stage === "success" && scanResult && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-[#FAF7F2] px-6 pb-safe pb-8 pt-7"
          style={{
            animation: "success-slide-up 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          {/* Handle pill */}
          <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-[#1C2526]/15" />

          <div className="flex flex-col items-center text-center">
            {/* Avatar circle */}
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#d97757]/15 text-2xl font-bold text-[#d97757]">
              {scanResult.customerName[0]?.toUpperCase() ?? "C"}
            </div>

            <p className="text-lg font-bold text-[#1C2526]">
              {scanResult.customerName}
            </p>

            {/* Points awarded */}
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-mono text-[52px] font-bold leading-none text-[#d97757]">
                +{scanResult.pointsAwarded}
              </span>
              <span className="text-xl font-semibold text-[#d97757]/70">pts</span>
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-sm text-[#1C2526]/50">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
                ✓
              </span>
              <span>Scan registrado</span>
            </div>

            <button
              onClick={handleNextScan}
              className="mt-7 w-full rounded-xl bg-[#d97757] py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-[#c46644]"
              style={{ boxShadow: "0 4px 16px rgba(242,140,56,0.3)" }}
            >
              Siguiente cliente →
            </button>

            <Link
              href="/vendor"
              className="mt-3 block text-sm text-[#1C2526]/40 hover:text-[#1C2526]/70 transition-colors"
            >
              Ir al panel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="h-6 w-6 animate-spin text-[#d97757]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"
      />
    </svg>
  );
}
