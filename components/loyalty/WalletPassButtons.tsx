"use client";

// WalletPassButtons — "add my loyalty card to the phone" for a customer who
// verified by SMS on the WEB, with no app and no account.
//
// ONE card for the whole community, not one per restaurant: the pass barcode is
// the universal earn payload {"userId":"<uid>","isForVisit":true}, so the same
// card earns at every Comeleal restaurant. That is the deliberate difference
// from a per-venue punch card — the customer's phone does not fill up with a
// card per taquería.
//
// Reuses the SAME callables the app uses (createAppleWalletPass /
// createGoogleWalletPass, us-central1). No new backend, no new certificates.
//
// ⚠️ GATE: only render this once users/{uid}.linkedPhone is written
// (lib/loyalty/linkVerifiedPhone.ts). The scanner resolves the pass by
// uid -> linkedPhone -> phoneCustomers; without that link the card scans fine
// and credits nothing, which is worse than having no card at all.

import { useState } from "react";
import { httpsCallable } from "firebase/functions";

import { getFirebaseAuth } from "@/lib/auth";
import { getFirebaseFunctions } from "@/lib/firebase";

/** iOS, including iPadOS which reports itself as a Mac with touch. */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Instagram / Facebook / TikTok in-app webviews. They cannot hand a .pkpass to
 * Wallet — the tap just dies. A lot of Comeleal traffic arrives from a bio
 * link, so this is the common case, not the edge case.
 */
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|LinkedInApp|Snapchat|MicroMessenger|TikTok|musical_ly/.test(
    navigator.userAgent,
  );
}

type Busy = "apple" | "google" | null;

export function WalletPassButtons() {
  const [busy, setBusy] = useState<Busy>(null);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const ios = isIOS();
  const inApp = isInAppBrowser();

  async function addToAppleWallet() {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid) return;
    setBusy("apple");
    setErr(null);
    try {
      const call = httpsCallable<
        { userId: string; isForVisit: boolean },
        { pkpassBase64?: string }
      >(getFirebaseFunctions(), "createAppleWalletPass");
      const res = await call({ userId: uid, isForVisit: true });
      const b64 = res.data?.pkpassBase64;
      if (!b64) throw new Error("empty_pass");

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.apple.pkpass" });
      const url = URL.createObjectURL(blob);
      // Safari opens the "Add to Apple Wallet" sheet off the MIME type. A
      // `download` attribute would defeat that and save a useless file instead.
      window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setAdded(true);
    } catch (e) {
      console.error("[WalletPassButtons] apple", e);
      setErr("No pudimos crear tu tarjeta. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  async function addToGoogleWallet() {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid) return;
    setBusy("google");
    setErr(null);
    try {
      const call = httpsCallable<{ userId: string }, { saveUrl?: string }>(
        getFirebaseFunctions(),
        "createGoogleWalletPass",
      );
      const res = await call({ userId: uid });
      const saveUrl = res.data?.saveUrl;
      if (!saveUrl) throw new Error("empty_save_url");
      window.location.href = saveUrl;
      setAdded(true);
    } catch (e) {
      console.error("[WalletPassButtons] google", e);
      setErr("No pudimos crear tu tarjeta. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="mt-4 rounded-2xl p-4"
      style={{ background: "#FAF9F5", border: "1px solid rgba(28,37,38,0.10)" }}
    >
      <p className="text-sm font-bold" style={{ color: "#1C2526" }}>
        Lleva tu tarjeta en el celular
      </p>
      <p className="mt-1 text-xs" style={{ color: "#8B6F47" }}>
        Una sola tarjeta para todos tus lugares. La enseñas al pagar y sumas
        puntos — no necesitas la app.
      </p>

      {ios && inApp ? (
        <p
          className="mt-3 rounded-xl px-3 py-2 text-xs"
          style={{ background: "#FFFBEB", border: "1px solid #B45309", color: "#B45309" }}
        >
          Para guardarla en Apple Wallet, abre esta página en Safari — desde
          aquí dentro no se puede. Toca los ··· de arriba y elige
          &ldquo;Abrir en Safari&rdquo;.
        </p>
      ) : ios ? (
        <button
          type="button"
          onClick={addToAppleWallet}
          disabled={busy !== null}
          className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60"
          style={{ background: "#1C2526", color: "#FFFFFF" }}
        >
          {busy === "apple" ? "Creando tu tarjeta…" : " Agregar a Apple Wallet"}
        </button>
      ) : (
        <button
          type="button"
          onClick={addToGoogleWallet}
          disabled={busy !== null}
          className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60"
          style={{ background: "#1C2526", color: "#FFFFFF" }}
        >
          {busy === "google" ? "Creando tu tarjeta…" : "Guardar en Google Wallet"}
        </button>
      )}

      {added && !err ? (
        <p className="mt-2 text-xs" style={{ color: "#16A34A" }}>
          Si no se abrió sola, revisa tus descargas.
        </p>
      ) : null}
      {err ? (
        <p className="mt-2 text-xs" style={{ color: "#B91C1C" }}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
