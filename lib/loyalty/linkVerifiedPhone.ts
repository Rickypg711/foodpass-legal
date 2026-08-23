// Web mirror of the app's PhoneLinkService (FOODPASS
// lib/loyalty/phone_link_service.dart): after an SMS verification the web must
// write users/{uid}.linkedPhone, exactly like the app already does.
//
// WHY THIS EXISTS. The vendor scanner resolves a scanned customer QR as
//   uid -> users/{uid}.linkedPhone -> phoneCustomers/{last10}
// (FOODPASS lib/loyalty/wallet_loyalty_service.dart). That path never reads
// Auth's own user.phoneNumber. So a customer who verified only on the web owned
// a uid the scanner could not resolve to their phone wallet — invisible while
// the web was read-only, but fatal the moment the web hands out a wallet pass,
// because the pass barcode is exactly {"userId":"<uid>","isForVisit":true}.
// Their card would scan, look right, and credit nothing.
//
// RULES CONTRACT (firestore.rules, userDocLinkedPhoneFieldValid):
// linkedPhone/linkedPhoneAt are self-writable ONLY on update, and ONLY when the
// caller's token carries a phone_number ending in those same 10 digits. They are
// deliberately absent from the create whitelist, so a missing user doc has to be
// created plain first and updated second. Hence two writes, on purpose.

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { getFirebaseAuth } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase";

/**
 * - `linked`  — we wrote it now.
 * - `already` — the doc already carried this exact number.
 * - `skipped` — no signed-in user, or the token does not prove this number.
 * - `failed`  — the write was rejected or errored (never thrown to the caller).
 */
export type LinkVerifiedPhoneResult = "linked" | "already" | "skipped" | "failed";

/** Last 10 digits, the canonical phone key across the whole system. */
export function last10Digits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

/**
 * Writes `users/{uid}.linkedPhone` for the currently signed-in, phone-verified
 * customer.
 *
 * Call it right after a successful SMS verification, on BOTH success paths: the
 * `link` path (anonymous user gains the number) and the `signInWithCredential`
 * fallback (the number already owned an account). Both end with a token that
 * carries `phone_number`, which is what the rules check.
 *
 * Never throws. A customer looking at their points must not see an error
 * because a background identity write failed.
 */
export async function linkVerifiedPhone(
  rawPhone: string,
): Promise<LinkVerifiedPhoneResult> {
  const digits = last10Digits(rawPhone);
  if (digits.length !== 10) return "skipped";

  try {
    const user = getFirebaseAuth().currentUser;
    if (!user) return "skipped";

    // The custom claim only appears on a FRESH token. Without this refresh the
    // very first write after verifying is rejected by the rules — the exact
    // reason the app calls getIdToken(true) in the same spot.
    await user.getIdToken(true);

    if (!user.phoneNumber || !user.phoneNumber.endsWith(digits)) {
      // Not our number to claim. Better to write nothing than to write a link
      // the scanner would trust.
      return "skipped";
    }

    const ref = doc(getFirebaseDb(), "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Create-whitelist only: no linkedPhone here, and the customer defaults
      // the rules demand. A phone-only customer has no name and no email — the
      // app leaves both empty on purpose rather than inventing one.
      await setDoc(ref, {
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        hasRestaurant: false,
        restaurantMode: false,
        restaurantId: "",
      });
    } else if (snap.get("linkedPhone") === digits) {
      return "already";
    }

    await updateDoc(ref, {
      linkedPhone: digits,
      linkedPhoneAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });

    return "linked";
  } catch (e) {
    console.error("[linkVerifiedPhone] write failed", e);
    return "failed";
  }
}
