"use client";

import { MercadoPagoConnectCard } from "@/components/vendor/MercadoPagoConnectCard";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, deleteField, collection, getDocs, addDoc, deleteDoc, query, where, limit } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";
import { entitlementOf } from "@/lib/subscription/entitlement";
import { waitForAuthReady, getFirebaseAuth } from "@/lib/auth";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import { persistReadiness, stepGroupFromReasons } from "@/lib/vendorReadiness";
import { parseDiscountProfiles, isFounderTestRestaurant, type DiscountProfile } from "@/lib/loyalty/discountProfiles";
import { isGoogleReviewUrl } from "@/lib/googleReviewUrl";
import { parsePosStaff, type PosStaffMember, type PosStaffRole } from "@/lib/posStaff";
import { PUBLIC_WHATSAPP_WA_ME_VENDOR_HELP } from "@/lib/contactEmail";
import { isUsableSlug, slugFromRestaurantData, slugify } from "@/lib/slug";
import type { User } from "firebase/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_CATEGORIES = [
  "Tacos","Café","Hamburguesas","Pizza","Sushi",
  "Mariscos","Antojitos","Carnes","Postres","Otro",
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetEnviado, setResetEnviado] = useState(false);

  /// Solo las cuentas creadas con correo+contraseña la tienen. Una de Google
  /// o Apple no, y ofrecérsela sería ofrecer cambiar algo que no existe.
  const tienePassword = (user?.providerData ?? []).some(
    (p) => p.providerId === "password",
  );

  async function handleCambiarPassword() {
    const correo = user?.email?.trim();
    if (!correo) return;
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(getFirebaseAuth(), correo);
    } catch {
      // Se confirma igual: no se le dice a nadie si un correo existe o no.
    }
    setResetEnviado(true);
  }

  const [signingOut, setSigningOut] = useState(false);
  const [activatingPro, setActivatingPro] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  // Dirección tal como venía de Firestore. Sirve para saber si el dueño la
  // cambió de verdad y sólo entonces volver a geocodificar (ver handleSave).
  const initialAddressRef = useRef<string>("");
  /// true cuando la dirección guardada NO se pudo ubicar en el mapa. El local
  /// queda fuera de "Cerca de ti" y de Recompensas (la app filtra a 20 km), así
  /// que hay que DECÍRSELO al dueño — no basta con marcarlo en Firestore.
  const [locationUnresolved, setLocationUnresolved] = useState(false);
  const [phone, setPhone] = useState("");
  /** "Nuestra historia" (patrón Our Story de Owner/Metro Pizza) — se pinta
   * en la página pública /r/{id} cuando el dueño la escribe. Opcional. */
  const [story, setStory] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  /** Slug público (comeleal.com/r/{slug}) — se auto-reclama al guardar. */
  const [slug, setSlug] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [dailyRevenueGoal, setDailyRevenueGoal] = useState<number | "">("");
  /** "Pagar al recoger" en el menú web — el cliente ordena sin pago en línea
   * y paga en el local; el pedido llega a Pedidos y se cobra ahí. */
  const [payAtPickup, setPayAtPickup] = useState(false);
  const [birthdayEnabled, setBirthdayEnabled] = useState(false);
  const [birthdayPoints, setBirthdayPoints] = useState(10);
  const [mpConnected, setMpConnected] = useState(false);
  const [mpEmail, setMpEmail] = useState<string | null>(null);
  /** Saving re-runs the readiness check; incomplete → restaurant demoted to
   * "setup" and web Mercado Pago pauses. Surface it — never fail silently. */
  const [setupReasons, setSetupReasons] = useState<string[]>([]);
  /** Descuentos especiales (Pro) — perfiles que el POS aplica por cliente. */
  const [discountProfiles, setDiscountProfiles] = useState<DiscountProfile[]>([]);
  /** Equipo de la caja (PIN roster) — perfiles sin cuenta, estilo Square. */
  const [posStaff, setPosStaff] = useState<PosStaffMember[]>([]);
  /** Cuentas del equipo (members con acceso propio) — se invitan desde la app. */
  const [teamAccounts, setTeamAccounts] = useState<TeamAccountRow[]>([]);

  // Images state
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      setUser(u);
      const db = getFirebaseDb();
      // Staff-aware: configuración/billing es SOLO del dueño (matrix del app:
      // manager canManageSettings=false). Staff cae a su home, no a /activar.
      const ctx = await resolveVendorContext(db, u.uid);
      if (!ctx) { router.push("/activar"); return; }
      if (ctx.role !== "owner") { router.push(vendorHomeForRole(ctx.role)); return; }
      const rid = ctx.restaurantId;

      const [rSnap, subSnap] = await Promise.all([
        getDoc(doc(db, "restaurants", rid)),
        getDoc(doc(db, "restaurants", rid, "subscriptions", "current")).catch(() => null),
      ]);

      const data = rSnap.data() ?? {};
      setRestaurantId(rid);
      setName((data.name as string) ?? "");
      setAddress((data.address as string) ?? "");
      initialAddressRef.current = (data.address as string) ?? "";
      setLocationUnresolved(
        data.locationNeedsReview === true ||
          (Number(data.lat) === 0 && Number(data.lng) === 0),
      );
      setPhone((data.phone as string) ?? "");
      setStory((data.story as string) ?? "");
      setGoogleReviewUrl((data.googleReviewUrl as string) ?? "");
      setSlug(slugFromRestaurantData(data));
      setCategories((data.categories as string[]) ?? []);
      const goal = data.dailyRevenueGoal as number | undefined;
      setDailyRevenueGoal(goal && goal > 0 ? goal : "");
      setPayAtPickup(data.payAtPickupEnabled === true);
      const bday = data.birthdayReward as Record<string, unknown> | undefined;
      if (bday && typeof bday === "object") {
        setBirthdayEnabled(bday.enabled === true);
        const pts = Number(bday.points);
        if (Number.isFinite(pts) && pts > 0) setBirthdayPoints(pts);
      }
      setMpConnected(data.mercadoPagoConnected === true);
      setMpEmail(typeof data.mercadoPagoEmail === "string" ? data.mercadoPagoEmail : null);
      setDiscountProfiles(parseDiscountProfiles(data.discountProfiles));
      try {
        const staffSnap = await getDocs(collection(db, "restaurants", rid, "posStaff"));
        setPosStaff(parsePosStaff(staffSnap.docs));
      } catch { /* roster vacío o sin permiso — la sección muestra vacío */ }
      try {
        const memSnap = await getDocs(collection(db, "restaurants", rid, "members"));
        const rows: TeamAccountRow[] = [];
        memSnap.docs.forEach((m) => {
          const d = (m.data() ?? {}) as Record<string, unknown>;
          const isSelf = m.id === u.uid;
          const rawName = typeof d.name === "string" && d.name.trim() ? d.name.trim() : "";
          const rawEmail = typeof d.email === "string" && d.email ? d.email : "";
          rows.push({
            id: m.id,
            name:
              rawName ||
              (isSelf ? (u.displayName?.trim() || "Tú") : ""),
            email: rawEmail || (isSelf ? (u.email ?? "") : ""),
            role: d.role === "owner" ? "owner" : d.role === "manager" ? "manager" : "employee",
            status: typeof d.status === "string" ? d.status : "active",
          });
        });
        rows.sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name)));
        setTeamAccounts(rows);
      } catch { /* sin permiso de roster → solo se muestra el upsell/nota */ }
      if (data.isSetupComplete === false) {
        setSetupReasons((data.setupIncompleteReasons as string[]) ?? []);
      }

      const logo = (data.logoUrl as string) || (data.imageUrl as string) || "";
      const cover = (data.coverImageUrl as string) || (data.menuBannerUrl as string) || "";
      setLogoUrl(logo);
      setCoverUrl(cover);

      // Plan — la REGLA ÚNICA (lib/subscription/entitlement.ts), la misma que
      // usan el servidor, la app y /vendor/plan. El legado `plan: "pro"` sin
      // campos canónicos lo respeta adentro (grandfathered); aquí sólo queda
      // encima el doc viejo de subscriptions, que entitlementOf no conoce.
      const subData = subSnap?.data();
      const isPro =
        entitlementOf(data).isPro ||
        (subData?.status === "active" && subData?.plan === "pro");
      setPlan(isPro ? "pro" : "free");

      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  /** Pro checkout: create MP preapproval ($299/mes) and redirect to its init_point.
   * The subscription webhook grants Pro on restaurants/{id}; app + web read the same fields. */
  async function handleActivatePro() {
    if (!restaurantId || !user || activatingPro) return;
    setActivatingPro(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/mercado-pago/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ restaurantId }),
      });
      const json = (await res.json().catch(() => ({}))) as { initPoint?: string };
      if (!res.ok || !json.initPoint) {
        throw new Error("checkout_unavailable");
      }
      window.location.href = json.initPoint;
    } catch {
      setError(
        "No pudimos iniciar el pago con Mercado Pago. Intenta de nuevo o activa Pro desde la app.",
      );
      setActivatingPro(false);
    }
  }

  function toggleCategory(cat: string) {
    // Paridad con la app: "Categorías (Selecciona hasta 3)" — la web no
    // tenía tope y dejaba palomear las 10.
    setCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      if (prev.length >= 3) return prev;
      return [...prev, cat];
    });
    setSaved(false);
  }

  async function handleLogoUpload(file: File) {
    if (!restaurantId) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no debe pesar más de 5 MB.");
      return;
    }
    setLogoUploading(true);
    setError(null);
    try {
      const storage = getFirebaseStorage();
      const fileExt = file.name.split(".").pop() || "jpg";
      const storageRef = ref(storage, `restaurant_pictures/${restaurantId}/${Date.now()}.${fileExt}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      const db = getFirebaseDb();
      await updateDoc(doc(db, "restaurants", restaurantId), {
        imageUrl: url,
        logoUrl: url,
        lastUpdated: serverTimestamp(),
      });
      setLogoUrl(url);
      await persistReadiness(restaurantId);
    } catch (e) {
      console.error("[logoUpload]", e);
      setError("Error al subir el logo.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleCoverUpload(file: File) {
    if (!restaurantId) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no debe pesar más de 5 MB.");
      return;
    }
    setCoverUploading(true);
    setError(null);
    try {
      const storage = getFirebaseStorage();
      const storageRef = ref(storage, `restaurant_banners/${restaurantId}/cover.jpg`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      const db = getFirebaseDb();
      await updateDoc(doc(db, "restaurants", restaurantId), {
        coverImageUrl: url,
        menuBannerUrl: url,
        lastUpdated: serverTimestamp(),
      });
      setCoverUrl(url);
      await persistReadiness(restaurantId);
    } catch (e) {
      console.error("[coverUpload]", e);
      setError("Error al subir la portada.");
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleCoverDelete() {
    if (!restaurantId) return;
    setCoverUploading(true);
    setError(null);
    try {
      if (coverUrl) {
        try {
          const storage = getFirebaseStorage();
          const storageRef = ref(storage, `restaurant_banners/${restaurantId}/cover.jpg`);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.warn("[coverDeleteStorage]", storageErr);
        }
      }
      
      const db = getFirebaseDb();
      await updateDoc(doc(db, "restaurants", restaurantId), {
        coverImageUrl: deleteField(),
        menuBannerUrl: deleteField(),
        lastUpdated: serverTimestamp(),
      });
      setCoverUrl("");
      await persistReadiness(restaurantId);
    } catch (e) {
      console.error("[coverDelete]", e);
      setError("Error al eliminar la portada.");
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleSave() {
    if (!restaurantId) return;
    if (!name.trim()) { setError("El nombre del restaurante es obligatorio."); return; }
    if (!address.trim()) { setError("La dirección es obligatoria."); return; }
    if (googleReviewUrl.trim() && !isGoogleReviewUrl(googleReviewUrl)) {
      setError("El link de reseñas debe ser de Google (g.page, maps.google…). Cópialo del botón \"Pedir reseñas\" de tu Perfil de Negocio de Google.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: Record<string, any> = {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        story: story.trim(),
        googleReviewUrl: googleReviewUrl.trim(),
        categories,
        payAtPickupEnabled: payAtPickup,
        birthdayReward: { enabled: birthdayEnabled, points: birthdayPoints },
        lastUpdated: serverTimestamp(),
      };
      if (dailyRevenueGoal !== "" && Number(dailyRevenueGoal) > 0) {
        update.dailyRevenueGoal = Number(dailyRevenueGoal);
      } else {
        update.dailyRevenueGoal = 0;
      }

      // Auto-reclamo del slug bonito (comeleal.com/r/luzz-pizza) la primera
      // vez que se guarda. Best-effort: si algo falla, el guardado normal
      // sigue — el link con ID funciona siempre. El slug NO cambia en
      // renombres (los links compartidos jamás se rompen).
      let claimedSlug: string | null = null;
      if (!slug) {
        try {
          const base = slugify(name.trim());
          if (isUsableSlug(base)) {
            for (let i = 0; i < 8 && !claimedSlug; i++) {
              const candidate = i === 0 ? base : `${base.slice(0, 37)}-${i + 1}`;
              const taken = await getDocs(
                query(collection(db, "restaurants"), where("slug", "==", candidate), limit(1)),
              );
              const other = taken.docs.find((d) => d.id !== restaurantId);
              if (!other) claimedSlug = candidate;
            }
            if (claimedSlug) update.slug = claimedSlug;
          }
        } catch { /* sin slug esta vez — reintenta en el próximo guardado */ }
      }

      // ── Re-geocodificar cuando cambia la dirección ─────────────────────
      // PARIDAD CON LA APP: en la app, guardar la dirección escribe TAMBIÉN
      // lat/lng (manage_restaurant_screen.dart usa el pin del mapa). Aquí no
      // se hacía, así que un dueño podía corregir su dirección y quedarse con
      // las coordenadas viejas — o en 0,0 para siempre. Justo el camino que
      // usarían los locales que hoy están mal ubicados para arreglarse solos.
      //
      // Sólo se dispara si la dirección REALMENTE cambió, para no gastar
      // llamadas a Google en cada guardado de horario o de meta diaria.
      const addressChanged = address.trim() !== (initialAddressRef.current ?? "").trim();
      if (addressChanged) {
        try {
          const geoRes = await fetch("/api/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: address.trim(), phone: phone.trim() }),
          });
          const verdict = await geoRes.json();
          setLocationUnresolved(!verdict?.ok);
          if (verdict?.ok) {
            update.lat = verdict.lat;
            update.lng = verdict.lng;
            update.locationSource = "vendor_web_edit";
            update.locationPrecision = verdict.precision;
            update.locationFormattedAddress = verdict.formatted;
            update.locationNeedsReview = false;
            update.locationUpdatedAt = serverTimestamp();
          } else {
            // No se pudo ubicar con confianza: NO se escribe un pin
            // equivocado (peor que no tener pin) — se marca para revisión.
            update.locationNeedsReview = true;
            update.locationReviewReason = verdict?.reason ?? "desconocido";
            update.locationUpdatedAt = serverTimestamp();
          }
        } catch (geoErr) {
          console.warn("[configuracion/geocode]", geoErr);
          update.locationNeedsReview = true;
          update.locationReviewReason = "geocode_exception";
        }
      }

      await updateDoc(doc(db, "restaurants", restaurantId), update);
      initialAddressRef.current = address.trim();
      if (claimedSlug) setSlug(claimedSlug);
      const readiness = await persistReadiness(restaurantId);
      setSetupReasons(readiness && !readiness.isComplete ? readiness.reasons : []);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("[configuracion/save]", e);
      setError("No pudimos guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut(getAuth());
      router.push("/activar");
    } catch {
      setSigningOut(false);
    }
  }

  // Estas dos tarjetas viven en la columna izquierda en desktop y al FINAL
  // de la página en móvil (el formulario del negocio va primero en teléfono).
  const planCard = (
            <SectionCard label="Tu plan">
              {plan === "pro" ? (
                <div className="py-1">
                  <p className="text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                    Plan Pro activo ⭐
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>
                    Lealtad ilimitada, recuperación por WhatsApp, descuentos especiales, Comeleal AI y soporte directo
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  <p className="text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                    Plan Gratis — para operar
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "rgba(28,37,38,0.45)" }}>
                    Menú QR, Caja/POS, pedidos, tus clientes y reportes: gratis siempre.
                    Incluye 50 visitas de lealtad al mes.
                  </p>
                  <div
                    className="mt-3 rounded-xl p-3.5"
                    style={{ background: "rgba(242,140,56,0.07)", border: "1px solid rgba(242,140,56,0.25)" }}
                  >
                    <p className="text-[12px] font-bold" style={{ color: "#1C2526" }}>
                      Pro · $299/mes — para que tus clientes regresen
                    </p>
                    <ul className="mt-1.5 space-y-1 text-[11px]" style={{ color: "rgba(28,37,38,0.6)" }}>
                      <li>✓ Lealtad ilimitada (sin tope de 50 visitas)</li>
                      <li>✓ Recuperación automática por WhatsApp sin límite</li>
                      <li>✓ Comeleal AI sin límite</li>
                      <li>✓ Descuentos especiales (staff y familia) — la caja los aplica sola</li>
                      <li>✓ Soporte directo — te contesta una persona</li>
                    </ul>
                    <button
                      type="button"
                      onClick={handleActivatePro}
                      disabled={activatingPro}
                      className="mt-3 w-full rounded-xl px-3 py-2.5 text-[12px] font-bold text-[#1C2526] transition hover:opacity-90 disabled:opacity-60"
                      style={{ background: "#F28C38" }}
                    >
                      {activatingPro ? "Abriendo pago…" : "Activar Pro →"}
                    </button>
                    <p className="mt-1.5 text-center text-[10px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                      Pago seguro con Mercado Pago · cancela cuando quieras
                    </p>
                    <Link
                      href="/vendor/plan"
                      className="mt-2 block text-center text-[11px] font-semibold underline underline-offset-2"
                      style={{ color: "#F28C38" }}
                    >
                      Ver la comparación completa →
                    </Link>
                  </div>
                </div>
              )}
            </SectionCard>
  );

  const soporteCard = (
            <SectionCard label="Soporte">
              <ManageLink
                href="https://apps.apple.com/mx/app/foodpass/id6745301069"
                emoji="📱"
                title="App cliente (iOS)"
                subtitle="Descarga la app para los clientes"
                external
              />
              <ManageLink
                href={PUBLIC_WHATSAPP_WA_ME_VENDOR_HELP}
                emoji="💬"
                title="Ayuda por WhatsApp"
                subtitle="Te contesta una persona"
                external
                last
              />
            </SectionCard>
  );

  return (
    <>
      <main className="px-4 pb-16 pt-5 md:px-8 md:pt-7">

        {/* Page title */}
        <div className="mb-5">
          <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "#1C2526" }}>Configuración</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>
            Perfil, plan y ajustes de tu cuenta
          </p>
        </div>

        <div className="max-w-6xl">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          {/* ── Left column: cuenta ── */}
          <div className="space-y-4">

            {/* ── Profile pill ── */}
            <div
              className="flex items-center gap-3 rounded-2xl px-5 py-4"
              style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)" }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
                style={{ background: "rgba(217,119,87,0.12)", color: "#F28C38" }}
              >
                {(user?.displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                  {user?.displayName ?? user?.email ?? "Propietario"}
                </p>
                <p className="text-[11px] truncate" style={{ color: "rgba(28,37,38,0.4)" }}>
                  {user?.email ?? ""}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={
                  plan === "pro"
                    ? { background: "rgba(217,119,87,0.15)", color: "#F28C38" }
                    : { background: "rgba(28,37,38,0.07)", color: "rgba(28,37,38,0.4)" }
                }
              >
                {plan === "pro" ? "⭐ Pro" : "Free"}
              </span>
            </div>

            {/* Cambiar contraseña — NO existía en el panel, y el dueño vive
                AQUÍ: aquí está su Caja, sus pedidos y sus reportes. Sin esto
                tenía que bajarse la app solo para cambiarla.
                Se manda liga por correo en vez de pedir la actual: quien la
                quiere cambiar suele ser justo quien no la recuerda, y pedirle
                la vieja lo deja trabado. Solo se ofrece a cuentas que DE VERDAD
                tienen contraseña — una de Google no la tiene. */}
            {tienePassword && (
              <button
                type="button"
                onClick={handleCambiarPassword}
                disabled={resetEnviado}
                className="flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-left transition-colors hover:bg-[#faf9f5] disabled:cursor-default"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)" }}
              >
                <span className="text-[16px]">🔒</span>
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                    {resetEnviado ? "Correo enviado" : "Cambiar mi contraseña"}
                  </span>
                  <span className="block text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                    {resetEnviado
                      ? "Revisa tu correo y sigue la liga."
                      : "Te mandamos una liga a tu correo."}
                  </span>
                </span>
                {!resetEnviado && (
                  <span className="text-[13px]" style={{ color: "rgba(28,37,38,0.3)" }}>›</span>
                )}
              </button>
            )}

            {locationUnresolved && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                <p className="font-semibold">
                  No pudimos ubicar tu dirección en el mapa
                </p>
                <p className="mt-1 leading-relaxed">
                  Tu restaurante <strong>no aparece</strong> en &ldquo;Cerca de ti&rdquo; ni
                  en Recompensas dentro de la app hasta que lo ubiquemos.
                  Escribe la <strong>calle y número, colonia y ciudad</strong> —
                  con &ldquo;{address.trim() || "el centro"}&rdquo; no alcanza — y
                  guarda otra vez.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                {error}
              </div>
            )}

            {/* ── Gestionar ── */}
            <SectionCard label="Gestionar">
              <ManageLink
                href="/vendor/setup/horario"
                emoji="🕐"
                title="Horarios"
                subtitle="Días y horas de atención"
              />
              <ManageLink
                href="/vendor/setup/menu"
                emoji="🍽️"
                title="Menú"
                subtitle="Platillos e importar con IA"
              />
              <ManageLink
                href="/vendor/setup/recompensas"
                emoji="🎁"
                title="Recompensas"
                subtitle="Programa de lealtad"
                last
              />
            </SectionCard>

            {/* ── Suscripción (docs/PRICING.md) ── */}
            <div className="hidden lg:block">{planCard}</div>

            {/* ── Soporte ── */}
            <div className="hidden lg:block">{soporteCard}</div>

            {/* ── Cerrar sesión (desktop: al final de la columna izquierda) ── */}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="hidden w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[13px] font-semibold transition-colors lg:flex"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(28,37,38,0.07)",
                color: signingOut ? "rgba(28,37,38,0.3)" : "#EF4444",
              }}
            >
              {signingOut ? <><Spin /> Cerrando sesión…</> : "Cerrar sesión"}
            </button>

            <p className="hidden pb-4 text-center text-[10px] lg:block" style={{ color: "rgba(28,37,38,0.25)" }}>
              Comeleal · v{new Date().getFullYear()}
            </p>

          </div>

          {/* ── Right column: negocio ── */}
          <div className="space-y-4">

            {/* ── Datos del restaurante ── */}
            <SectionCard label="Información del negocio">
              <Field label="Nombre *">
                <TextInput value={name} onChange={(v) => { setName(v); setSaved(false); }} placeholder="Ej. Tacos El Güero" />
              </Field>
              <Field label="Dirección *">
                <TextInput value={address} onChange={(v) => { setAddress(v); setSaved(false); }} placeholder="Calle, colonia, ciudad" />
              </Field>
              <Field label="Teléfono">
                <TextInput value={phone} onChange={(v) => { setPhone(v); setSaved(false); }} placeholder="614 123 4567" type="tel" />
              </Field>
              <Field label="Tu historia (opcional)">
                <textarea
                  value={story}
                  onChange={(e) => { setStory(e.target.value); setSaved(false); }}
                  placeholder="¿Cómo empezó tu restaurante? Los negocios con historia venden más — sale en tu página pública."
                  rows={4}
                  maxLength={1200}
                  className="w-full resize-y rounded-xl px-3 py-2.5 text-[13px] outline-none transition-colors"
                  style={{
                    background: "#F5F3EF",
                    border: "1px solid rgba(28,37,38,0.12)",
                    color: "#1C2526",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#F28C38")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(28,37,38,0.12)")}
                />
                <p className="mt-1 text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                  Se muestra como &quot;Nuestra historia&quot; en tu página comeleal.com/r/…
                </p>
              </Field>
              {/* Funnel de reseñas: con la liga puesta, cada cliente que gana
                  puntos (app y recibo web) recibe la invitación a dejar reseña
                  justo en el momento de mayor gusto. Espejo del campo en la
                  app (ManageRestaurantScreen, sección de redes). */}
              <Field label="Link de reseñas de Google (opcional)">
                <TextInput
                  value={googleReviewUrl}
                  onChange={(v) => { setGoogleReviewUrl(v); setSaved(false); }}
                  placeholder="https://g.page/r/…/review"
                  type="url"
                />
                <p className="mt-1 text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                  Cópialo del botón &quot;Pedir reseñas&quot; en tu Perfil de Negocio de
                  Google. Con el link puesto, Comeleal invita a tus clientes a dejarte
                  reseña justo después de ganar puntos — reseñas de visitas reales.
                </p>
              </Field>
            </SectionCard>

            {/* ── Tu página en internet ── */}
            {restaurantId ? <PublicLinksCard restaurantId={restaurantId} slug={slug} /> : null}

            {/* ── Imágenes del restaurante ── */}
            <SectionCard label="Imágenes del negocio">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Section */}
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-gray-200 bg-[#F5F3EF]/30">
                  <span className="block mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Logo / Miniatura</span>
                  <div className="relative group w-24 h-24 rounded-full overflow-hidden border border-gray-100 bg-[#F5F3EF]">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-2xl text-gray-400">🍽️</div>
                    )}
                    {logoUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Spinner />
                      </div>
                    )}
                  </div>
                  <label className="mt-3 cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all text-white bg-[#1C2526] hover:opacity-90">
                    {logoUrl ? "Cambiar Logo" : "Subir Logo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                      }}
                      disabled={logoUploading}
                    />
                  </label>
                </div>

                {/* Cover Banner Section */}
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-gray-200 bg-[#F5F3EF]/30">
                  <span className="block mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Portada / Banner</span>
                  <div className="relative group w-full h-24 rounded-lg overflow-hidden border border-gray-100 bg-[#F5F3EF]">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt="Portada" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-2xl text-gray-400">🖼️</div>
                    )}
                    {coverUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Spinner />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <label className="cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all text-white bg-[#1C2526] hover:opacity-90">
                      {coverUrl ? "Cambiar Portada" : "Subir Portada"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCoverUpload(file);
                        }}
                        disabled={coverUploading}
                      />
                    </label>
                    {coverUrl && (
                      <button
                        type="button"
                        onClick={handleCoverDelete}
                        disabled={coverUploading}
                        className="rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* ── Categorías ── */}
            <SectionCard label="Tipo de restaurante (hasta 3)">
              <div className="flex flex-wrap gap-2">
                {RESTAURANT_CATEGORIES.map((cat) => {
                  const active = categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-all"
                      style={
                        active
                          ? { background: "#F28C38", color: "#fff", border: "1.5px solid #F28C38" }
                          : { background: "transparent", color: "rgba(28,37,38,0.55)", border: "1.5px solid rgba(28,37,38,0.14)" }
                      }
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* NOTE: "Puntos por visita" intentionally NOT editable — the app fixes
                pointsPerVisit to 1 and earning is governed by loyaltyEarnPolicy.
                Exposing it here would desync web from app reward math. */}

            {/* ── Meta de ingresos ── */}
            <SectionCard label="Meta de ingresos diaria">
              <Field label="Meta en MXN (opcional)">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: "rgba(28,37,38,0.45)" }}>$</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={dailyRevenueGoal}
                    placeholder="0"
                    onChange={(e) => { setDailyRevenueGoal(e.target.value === "" ? "" : Number(e.target.value)); setSaved(false); }}
                    className="w-36 rounded-xl px-3 py-2.5 text-[13px] outline-none"
                    style={{
                      background: "#F5F3EF",
                      border: "1px solid rgba(28,37,38,0.12)",
                      color: "#1C2526",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#F28C38")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(28,37,38,0.12)")}
                  />
                  <span className="text-[12px]" style={{ color: "rgba(28,37,38,0.4)" }}>MXN / día</span>
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                  El Brain AI usa esta meta para calcular el progreso diario.
                </p>
              </Field>
            </SectionCard>

            {/* ── Pedidos en línea ── */}
            <SectionCard label="Pedidos en línea">
              <button
                type="button"
                onClick={() => { setPayAtPickup((v) => !v); setSaved(false); }}
                aria-pressed={payAtPickup}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-all"
                style={{
                  background: payAtPickup ? "#FFF3E8" : "#F5F3EF",
                  border: payAtPickup
                    ? "1px solid rgba(242,140,56,0.5)"
                    : "1px solid rgba(28,37,38,0.12)",
                }}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                    💵 Aceptar &quot;Pagar al recoger&quot;
                  </span>
                  <span className="mt-0.5 block text-[11px]" style={{ color: "rgba(28,37,38,0.5)" }}>
                    Tus clientes ordenan desde el menú sin pagar en línea y pagan
                    al recoger. El pedido llega a Pedidos y lo cobras ahí
                    (efectivo o tarjeta).
                  </span>
                </span>
                <span
                  className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                  style={{ background: payAtPickup ? "#F28C38" : "rgba(28,37,38,0.2)" }}
                  aria-hidden
                >
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                    style={{ left: payAtPickup ? "22px" : "2px" }}
                  />
                </span>
              </button>
              <p className="mt-2 text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                Con Mercado Pago conectado, el cliente elige entre pagar en línea
                o al recoger. Sin Mercado Pago, esta opción es la única forma de
                recibir pedidos en línea.
              </p>
            </SectionCard>

            {/* ── Premio de cumpleaños ──
                Espejo del BirthdayRewardToggle de la app. Puntos y no platillo
                a propósito (viajan por todas las superficies sin estados
                nuevos). Default OFF: es dinero del dueño. El depósito lo hace
                functions/birthday_reward_sweep.js (dormido tras
                BIRTHDAY_REWARD_ENABLED). */}
            <SectionCard label="Premio de cumpleaños">
              <button
                type="button"
                onClick={() => { setBirthdayEnabled((v) => !v); setSaved(false); }}
                aria-pressed={birthdayEnabled}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-all"
                style={{
                  background: birthdayEnabled ? "#FFF3E8" : "#F5F3EF",
                  border: birthdayEnabled
                    ? "1px solid rgba(242,140,56,0.5)"
                    : "1px solid rgba(28,37,38,0.12)",
                }}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                    🎂 Regalar puntos de cumpleaños
                  </span>
                  <span className="mt-0.5 block text-[11px]" style={{ color: "rgba(28,37,38,0.5)" }}>
                    El día de su cumpleaños, tus clientes reciben puntos de
                    regalo y un aviso para venir a celebrar contigo. Comeleal lo
                    hace solito.
                  </span>
                </span>
                <span
                  className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                  style={{ background: birthdayEnabled ? "#F28C38" : "rgba(28,37,38,0.2)" }}
                  aria-hidden
                >
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                    style={{ left: birthdayEnabled ? "22px" : "2px" }}
                  />
                </span>
              </button>
              {birthdayEnabled ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
                    Puntos de regalo:
                  </span>
                  {[5, 10, 20].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setBirthdayPoints(opt); setSaved(false); }}
                      className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all"
                      style={{
                        background: birthdayPoints === opt ? "#F28C38" : "#F5F3EF",
                        color: birthdayPoints === opt ? "#fff" : "#1C2526",
                        border: birthdayPoints === opt
                          ? "1px solid #F28C38"
                          : "1px solid rgba(28,37,38,0.12)",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            {/* Conectar Mercado Pago — va pegado a "Pedidos en línea" porque es
                justo donde el dueño lo busca despues de leer el parrafo de
                arriba, que hasta hoy prometia algo que no se podia hacer aqui. */}
            {restaurantId && (
              <MercadoPagoConnectCard
                restaurantId={restaurantId}
                connected={mpConnected}
                accountEmail={mpEmail}
              />
            )}

            {/* ── Descuentos especiales (Pro) ── */}
            {restaurantId && (
              <DiscountProfilesSection
                restaurantId={restaurantId}
                isPro={plan === "pro" || isFounderTestRestaurant(restaurantId)}
                profiles={discountProfiles}
                onProfilesChange={setDiscountProfiles}
              />
            )}

            {/* ── Equipo de la caja (PIN roster) ── */}
            {restaurantId && (
              <PosStaffSection
                restaurantId={restaurantId}
                staff={posStaff}
                onStaffChange={setPosStaff}
                accounts={teamAccounts}
                isPro={plan === "pro" || isFounderTestRestaurant(restaurantId)}
              />
            )}

            {/* ── Configuración incompleta → pagos en línea pausados ── */}
            {setupReasons.length > 0 && (() => {
              const pending = stepGroupFromReasons(setupReasons);
              const labels = [
                pending.business ? "Información del negocio" : null,
                pending.hours ? "Horario" : null,
                pending.menu ? "Menú" : null,
                pending.rewards ? "Recompensas" : null,
              ].filter(Boolean);
              return (
                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: "#FFF7ED",
                    border: "1px solid rgba(234,88,12,0.35)",
                  }}
                >
                  <p className="text-[13px] font-bold" style={{ color: "#9A3412" }}>
                    ⚠️ Tu configuración está incompleta
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: "rgba(154,52,18,0.85)" }}>
                    Falta: {labels.join(", ")}. Mientras tanto, los pagos en línea
                    con Mercado Pago están pausados en tu menú
                    {payAtPickup ? " (Pagar al recoger sigue funcionando)" : ""}.
                  </p>
                  <Link
                    href="/vendor/setup"
                    className="mt-2 inline-block rounded-lg px-3 py-1.5 text-[12px] font-bold text-white"
                    style={{ background: "#EA580C" }}
                  >
                    Completar configuración →
                  </Link>
                </div>
              );
            })()}

            {/* ── Guardar ── */}
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: saved ? "#22c55e" : "#F28C38" }}
            >
              {saved ? "✓ Cambios guardados" : saving ? <><Spin /> Guardando…</> : "Guardar cambios"}
            </button>

          </div>

          {/* ── Móvil: plan, soporte y cerrar sesión al FINAL de la página ── */}
          <div className="space-y-4 lg:hidden">
            {planCard}
            {soporteCard}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[13px] font-semibold transition-colors"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(28,37,38,0.07)",
                color: signingOut ? "rgba(28,37,38,0.3)" : "#EF4444",
              }}
            >
              {signingOut ? <><Spin /> Cerrando sesión…</> : "Cerrar sesión"}
            </button>
            <p className="pb-4 text-center text-[10px]" style={{ color: "rgba(28,37,38,0.25)" }}>
              Comeleal · v{new Date().getFullYear()}
            </p>
          </div>
          </div>
        )}
        </div>
      </main>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Tu página en internet — los dos links públicos del negocio con copiar de un
 * tap. La landing /r/{id} solo genera tráfico si el dueño la USA: aquí es
 * donde se entera de que existe (bio de Instagram + sitio web en Google Maps
 * = el loop de SEO local trabajando para él y para Comeleal).
 */
function PublicLinksCard({
  restaurantId,
  slug,
}: {
  restaurantId: string;
  slug: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const links = [
    {
      key: "landing",
      label: "🏠 Tu página",
      // Con slug: el link corto bonito (comeleal.com/luzz-pizza — ideal para
      // bio y statuses). Sin slug: el de ID (guarda la configuración una vez
      // y se activa solo).
      url: slug
        ? `https://comeleal.com/${slug}`
        : `https://comeleal.com/r/${restaurantId}`,
      hint: slug
        ? "Tu mini-sitio: menú, horario, ubicación y WhatsApp."
        : "Tu mini-sitio. Guarda la configuración para activar tu link corto con el nombre de tu negocio.",
    },
    {
      key: "menu",
      label: "🍽 Tu menú",
      // Con slug: link corto para compartir. El QR impreso trae el de ID y
      // sigue llegando al mismo menú — /menu/{id} es eterno.
      url: slug
        ? `https://comeleal.com/menu/${slug}`
        : `https://comeleal.com/menu/${restaurantId}`,
      hint: "Directo al menú — el mismo destino de tu QR de mesa.",
    },
  ];

  async function copyLink(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard bloqueado — el link queda visible para copiar a mano */
    }
  }

  return (
    <SectionCard label="Tu página en internet">
      <div className="space-y-3">
        {links.map((l) => (
          <div
            key={l.key}
            className="rounded-xl px-3.5 py-3"
            style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.08)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                  {l.label}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px]" style={{ color: "rgba(28,37,38,0.55)" }}>
                  {l.url.replace("https://", "")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                  style={{ border: "1px solid rgba(28,37,38,0.12)", color: "#1C2526", background: "#ffffff" }}
                >
                  Ver
                </a>
                <button
                  type="button"
                  onClick={() => copyLink(l.key, l.url)}
                  className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors"
                  style={{ background: copied === l.key ? "#22C55E" : "#F28C38" }}
                >
                  {copied === l.key ? "✓ Copiado" : "Copiar"}
                </button>
              </span>
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "rgba(28,37,38,0.5)" }}>
              {l.hint}
            </p>
          </div>
        ))}
        <p
          className="rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed"
          style={{ background: "#FFF3E8", border: "1px solid rgba(242,140,56,0.25)", color: "rgba(28,37,38,0.65)" }}
        >
          💡 <strong>Pon tu página en la bio de Instagram y como sitio web en tu
          perfil de Google Maps.</strong> Así te encuentran en Google, ven tu menú
          y te piden por WhatsApp — sin pagarle a nadie más.
        </p>
      </div>
    </SectionCard>
  );
}

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)" }}
    >
      <p
        className="mb-4 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "rgba(28,37,38,0.35)" }}
      >
        {label}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold" style={{ color: "rgba(28,37,38,0.5)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-colors"
      style={{
        background: "#F5F3EF",
        border: "1px solid rgba(28,37,38,0.12)",
        color: "#1C2526",
      }}
      onFocus={(e) => (e.target.style.borderColor = "#F28C38")}
      onBlur={(e) => (e.target.style.borderColor = "rgba(28,37,38,0.12)")}
    />
  );
}

function ManageLink({
  href, emoji, title, subtitle, last = false, external = false,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  last?: boolean;
  external?: boolean;
}) {
  const inner = (
    <div
      className="flex items-center gap-3 py-3 transition-opacity hover:opacity-75"
      style={last ? {} : { borderBottom: "1px solid rgba(28,37,38,0.05)" }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
        style={{ background: "#F5F3EF" }}
      >
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: "#1C2526" }}>{title}</p>
        <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>{subtitle}</p>
      </div>
      <span className="text-[13px]" style={{ color: "rgba(28,37,38,0.25)" }}>›</span>
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }
  return <Link href={href}>{inner}</Link>;
}

// ─── Descuentos especiales (Pro) ──────────────────────────────────────────────
// Perfiles de descuento (Staff, Family & Friends…) que el dueño crea aquí y
// asigna por cliente en Clientes. El POS los aplica automáticamente al cobrar.
// Los puntos y comisiones se calculan SIEMPRE sobre lo realmente pagado
// (neto) — nadie puede "cultivar" recompensas con descuentos.

function DiscountProfilesSection({
  restaurantId,
  isPro,
  profiles,
  onProfilesChange,
}: {
  restaurantId: string;
  isPro: boolean;
  profiles: DiscountProfile[];
  onProfilesChange: (p: DiscountProfile[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [fType, setFType] = useState<"per_category" | "total">("total");
  const [fBebidas, setFBebidas] = useState<number | "">("");
  const [fAlimentos, setFAlimentos] = useState<number | "">("");
  const [fTotal, setFTotal] = useState<number | "">("");
  const [fEarnsPoints, setFEarnsPoints] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const clamp = (v: number | "") => Math.min(100, Math.max(0, Number(v || 0)));
  const highPct =
    fType === "total"
      ? clamp(fTotal) > 50
      : clamp(fBebidas) > 50 || clamp(fAlimentos) > 50;

  function openNew(seed?: {
    name: string;
    type: "per_category" | "total";
    bebidasPct?: number;
    alimentosPct?: number;
    totalPct?: number;
    earnsPoints?: boolean;
  }) {
    setEditingId("new");
    setFName(seed?.name ?? "");
    setFType(seed?.type ?? "total");
    setFBebidas(seed?.bebidasPct ?? "");
    setFAlimentos(seed?.alimentosPct ?? "");
    setFTotal(seed?.totalPct ?? "");
    setFEarnsPoints(seed?.earnsPoints ?? true);
    setErr(null);
  }

  function openEdit(p: DiscountProfile) {
    setEditingId(p.id);
    setFName(p.name);
    setFType(p.type);
    setFBebidas(p.bebidasPct || "");
    setFAlimentos(p.alimentosPct || "");
    setFTotal(p.totalPct || "");
    setFEarnsPoints(p.earnsPoints !== false);
    setErr(null);
  }

  async function persist(next: DiscountProfile[]) {
    const db = getFirebaseDb();
    await updateDoc(doc(db, "restaurants", restaurantId), {
      discountProfiles: next,
      lastUpdated: serverTimestamp(),
    });
    onProfilesChange(next);
  }

  async function handleSaveProfile() {
    const name = fName.trim();
    if (!name) { setErr("Ponle un nombre (ej. Staff)."); return; }
    if (fType === "total" && clamp(fTotal) === 0) {
      setErr("El porcentaje debe ser mayor a 0."); return;
    }
    if (fType === "per_category" && clamp(fBebidas) === 0 && clamp(fAlimentos) === 0) {
      setErr("Pon al menos un porcentaje mayor a 0."); return;
    }
    setBusy(true);
    setErr(null);
    try {
      const id =
        editingId && editingId !== "new"
          ? editingId
          : `dp_${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
      const profile: DiscountProfile =
        fType === "total"
          ? { id, name, type: "total", totalPct: clamp(fTotal), earnsPoints: fEarnsPoints }
          : { id, name, type: "per_category", bebidasPct: clamp(fBebidas), alimentosPct: clamp(fAlimentos), earnsPoints: fEarnsPoints };
      const next =
        editingId === "new"
          ? [...profiles, profile]
          : profiles.map((p) => (p.id === id ? profile : p));
      await persist(next);
      setEditingId(null);
    } catch (e) {
      console.error("[discountProfiles/save]", e);
      setErr("No pudimos guardar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProfile(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await persist(profiles.filter((p) => p.id !== id));
      setConfirmDeleteId(null);
      if (editingId === id) setEditingId(null);
    } catch (e) {
      console.error("[discountProfiles/delete]", e);
      setErr("No pudimos eliminar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function pctLabel(p: DiscountProfile): string {
    const base =
      p.type === "total"
        ? `${p.totalPct ?? 0}% en toda la cuenta`
        : `${p.bebidasPct ?? 0}% bebidas · ${p.alimentosPct ?? 0}% alimentos`;
    return p.earnsPoints === false ? `${base} · sin puntos` : base;
  }

  if (!isPro) {
    return (
      <SectionCard label="Descuentos especiales 🏷️">
        <div
          className="rounded-xl p-3.5"
          style={{ background: "rgba(242,140,56,0.07)", border: "1px solid rgba(242,140,56,0.25)" }}
        >
          <p className="text-[12px] font-bold" style={{ color: "#1C2526" }}>
            ⭐ Incluido en Pro
          </p>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(28,37,38,0.55)" }}>
            Crea descuentos para tu staff o familia (ej. 50% en bebidas) y asígnalos
            por cliente. El POS los aplica solo al cobrar, automáticamente.
          </p>
          <Link
            href="/vendor/plan"
            className="mt-2 inline-block text-[11px] font-bold underline underline-offset-2"
            style={{ color: "#F28C38" }}
          >
            Ver el plan Pro →
          </Link>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard label="Descuentos especiales 🏷️">
      <p className="text-[11px] leading-relaxed" style={{ color: "rgba(28,37,38,0.45)" }}>
        Crea perfiles (Staff, Familia…) y asígnalos por cliente en{" "}
        <Link href="/vendor/clientes" className="font-semibold underline" style={{ color: "#F28C38" }}>
          Clientes
        </Link>
        . El POS los aplica automáticamente al cobrar; los puntos se calculan
        sobre lo realmente pagado.
      </p>

      {profiles.length === 0 && editingId === null && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold" style={{ color: "rgba(28,37,38,0.5)" }}>
            Empieza con una plantilla:
          </p>
          <button
            type="button"
            onClick={() => openNew({ name: "Staff", type: "per_category", bebidasPct: 50, alimentosPct: 30, earnsPoints: false })}
            className="w-full rounded-xl px-3.5 py-3 text-left text-[12px] font-semibold transition hover:opacity-80"
            style={{ background: "#F5F3EF", border: "1px dashed rgba(28,37,38,0.2)", color: "#1C2526" }}
          >
            ⚡ Staff — 50% bebidas · 30% alimentos
          </button>
          <button
            type="button"
            onClick={() => openNew({ name: "Family & Friends", type: "total", totalPct: 15 })}
            className="w-full rounded-xl px-3.5 py-3 text-left text-[12px] font-semibold transition hover:opacity-80"
            style={{ background: "#F5F3EF", border: "1px dashed rgba(28,37,38,0.2)", color: "#1C2526" }}
          >
            ⚡ Family &amp; Friends — 15% en toda la cuenta
          </button>
        </div>
      )}

      {profiles.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 rounded-xl px-3.5 py-3"
          style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.08)" }}
        >
          <span className="text-base">🏷️</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold" style={{ color: "#1C2526" }}>{p.name}</p>
            <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>{pctLabel(p)}</p>
          </div>
          {confirmDeleteId === p.id ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleDeleteProfile(p.id)}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                style={{ background: "#EF4444" }}
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                style={{ background: "rgba(28,37,38,0.07)", color: "rgba(28,37,38,0.6)" }}
              >
                No
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => openEdit(p)}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.12)", color: "#1C2526" }}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(p.id)}
                aria-label={`Eliminar ${p.name}`}
                className="rounded-lg px-2 py-1.5 text-[12px]"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.12)" }}
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      ))}

      {err && editingId === null && (
        <p className="text-[11px] font-semibold" style={{ color: "#dc2626" }}>{err}</p>
      )}

      {editingId !== null ? (
        <div
          className="space-y-3 rounded-xl p-3.5"
          style={{ background: "#FFF7ED", border: "1px solid rgba(242,140,56,0.3)" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(154,52,18,0.6)" }}>
            {editingId === "new" ? "Nuevo descuento" : "Editar descuento"}
          </p>
          <Field label="Nombre">
            <TextInput value={fName} onChange={(v) => setFName(v)} placeholder="Ej. Staff, Familia" />
          </Field>
          <Field label="Tipo de descuento">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFType("total")}
                className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all"
                style={
                  fType === "total"
                    ? { background: "#F28C38", color: "#fff", border: "1.5px solid #F28C38" }
                    : { background: "#ffffff", color: "rgba(28,37,38,0.55)", border: "1.5px solid rgba(28,37,38,0.14)" }
                }
              >
                % en toda la cuenta
              </button>
              <button
                type="button"
                onClick={() => setFType("per_category")}
                className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all"
                style={
                  fType === "per_category"
                    ? { background: "#F28C38", color: "#fff", border: "1.5px solid #F28C38" }
                    : { background: "#ffffff", color: "rgba(28,37,38,0.55)", border: "1.5px solid rgba(28,37,38,0.14)" }
                }
              >
                Por categoría
              </button>
            </div>
          </Field>
          {fType === "total" ? (
            <PctInput label="Descuento en toda la cuenta" value={fTotal} onChange={setFTotal} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <PctInput label="🥤 Bebidas" value={fBebidas} onChange={setFBebidas} />
              <PctInput label="🍽️ Alimentos" value={fAlimentos} onChange={setFAlimentos} />
            </div>
          )}
          <Field label="¿Junta puntos de lealtad?">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFEarnsPoints(true)}
                className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all"
                style={
                  fEarnsPoints
                    ? { background: "#F28C38", color: "#fff", border: "1.5px solid #F28C38" }
                    : { background: "#ffffff", color: "rgba(28,37,38,0.55)", border: "1.5px solid rgba(28,37,38,0.14)" }
                }
              >
                Sí — sobre lo pagado
              </button>
              <button
                type="button"
                onClick={() => setFEarnsPoints(false)}
                className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all"
                style={
                  !fEarnsPoints
                    ? { background: "#1C2526", color: "#fff", border: "1.5px solid #1C2526" }
                    : { background: "#ffffff", color: "rgba(28,37,38,0.55)", border: "1.5px solid rgba(28,37,38,0.14)" }
                }
              >
                No — su beneficio es el descuento
              </button>
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
              Con &quot;No&quot;, sus compras no acumulan puntos ni premio de
              bienvenida (y no gastan tus visitas de lealtad del mes). Su visita
              y gasto sí quedan registrados en Clientes.
            </p>
          </Field>
          {highPct && (
            <p
              className="rounded-lg px-3 py-2 text-[11px] font-semibold"
              style={{ background: "rgba(234,88,12,0.1)", color: "#9A3412" }}
            >
              ⚠️ Más de 50% de descuento — asegúrate de que sea intencional.
            </p>
          )}
          {err && (
            <p className="text-[11px] font-semibold" style={{ color: "#dc2626" }}>{err}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={busy}
              className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-bold text-[#1C2526] transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#F28C38" }}
            >
              {busy ? "Guardando…" : "Guardar descuento"}
            </button>
            <button
              type="button"
              onClick={() => { setEditingId(null); setErr(null); }}
              disabled={busy}
              className="rounded-xl px-4 py-2.5 text-[12px] font-semibold"
              style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.12)", color: "rgba(28,37,38,0.6)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openNew()}
          className="w-full rounded-xl px-3.5 py-3 text-[12px] font-bold transition hover:opacity-80"
          style={{ background: "#ffffff", border: "1.5px dashed rgba(242,140,56,0.5)", color: "#F28C38" }}
        >
          + Nuevo descuento
        </button>
      )}
    </SectionCard>
  );
}

// ─── Equipo de la caja (PIN roster, estilo Square) ────────────────────────────
// Perfiles de staff SIN cuenta: nombre + PIN de 4 dígitos + rol. La caja (web
// y app) muestra "¿Quién cobra?" y cada venta queda estampada con soldBy —
// eso alimenta ventas por empleado en Reportes y la auditoría de descuentos.
// Esto NO es login: para acceso con cuenta propia (manager/empleado en su
// teléfono), se invita desde la app y entran a comeleal.com con su cuenta.

type TeamAccountRow = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "employee";
  status: string;
};

const TEAM_ROLE_LABEL: Record<TeamAccountRow["role"], string> = {
  owner: "Dueño",
  manager: "Manager",
  employee: "Empleado",
};

function PosStaffSection({
  restaurantId,
  staff,
  onStaffChange,
  accounts,
  isPro,
}: {
  restaurantId: string;
  staff: PosStaffMember[];
  onStaffChange: (s: PosStaffMember[]) => void;
  /** Cuentas del equipo (members) — solo lectura en web; invitaciones desde la app. */
  accounts: TeamAccountRow[];
  isPro: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [fName, setFName] = useState("");
  const [fPin, setFPin] = useState("");
  const [fRole, setFRole] = useState<PosStaffRole>("cajero");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPins, setShowPins] = useState(false);

  async function handleAdd() {
    const name = fName.trim();
    const pin = fPin.replace(/\D/g, "");
    if (!name) { setErr("Ponle nombre (ej. Juan)."); return; }
    if (pin.length !== 4) { setErr("El PIN debe ser de 4 dígitos."); return; }
    if (staff.some((m) => m.pin === pin)) { setErr("Ese PIN ya lo usa alguien más."); return; }
    setBusy(true);
    setErr(null);
    try {
      const db = getFirebaseDb();
      const ref = await addDoc(collection(db, "restaurants", restaurantId, "posStaff"), {
        name,
        pin,
        role: fRole,
        active: true,
        createdAt: serverTimestamp(),
      });
      onStaffChange(
        [...staff, { id: ref.id, name, pin, role: fRole, active: true }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setFName("");
      setFPin("");
      setFRole("cajero");
      setFormOpen(false);
    } catch (e) {
      console.error("[posStaff/add]", e);
      setErr("No pudimos guardar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await deleteDoc(doc(getFirebaseDb(), "restaurants", restaurantId, "posStaff", id));
      onStaffChange(staff.filter((m) => m.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error("[posStaff/delete]", e);
      setErr("No pudimos eliminar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard label="Equipo 👥">
      <p
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "rgba(28,37,38,0.35)" }}
      >
        PINs de la caja · gratis
      </p>
      <p className="text-[11px] leading-relaxed" style={{ color: "rgba(28,37,38,0.45)" }}>
        Agrega a tu equipo con un PIN de 4 dígitos. En la caja eligen quién
        cobra con su PIN — cada venta queda registrada a su nombre (sin
        necesidad de cuenta ni email).
      </p>

      {staff.length > 0 && (
        <div className="space-y-2">
          {staff.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl px-3.5 py-3"
              style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.08)" }}
            >
              <span className="text-base">👤</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                  {m.name}
                </p>
                <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                  {m.role === "gerente" ? "Gerente" : "Cajero"} · PIN{" "}
                  <span className="font-mono font-bold">{showPins ? m.pin : "••••"}</span>
                </p>
              </div>
              {confirmDeleteId === m.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(m.id)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                    style={{ background: "#EF4444" }}
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                    style={{ background: "rgba(28,37,38,0.07)", color: "rgba(28,37,38,0.6)" }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(m.id)}
                  aria-label={`Eliminar ${m.name}`}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-[12px]"
                  style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.12)" }}
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setShowPins((v) => !v)}
            className="text-[11px] font-semibold underline underline-offset-2"
            style={{ color: "rgba(28,37,38,0.45)" }}
          >
            {showPins ? "Ocultar PINs" : "Mostrar PINs"}
          </button>
        </div>
      )}

      {err && !formOpen && (
        <p className="text-[11px] font-semibold" style={{ color: "#dc2626" }}>{err}</p>
      )}

      {formOpen ? (
        <div
          className="space-y-3 rounded-xl p-3.5"
          style={{ background: "#FFF7ED", border: "1px solid rgba(242,140,56,0.3)" }}
        >
          <Field label="Nombre">
            <TextInput value={fName} onChange={(v) => setFName(v)} placeholder="Ej. Juan" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PIN (4 dígitos)">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={fPin}
                onChange={(e) => setFPin(e.target.value.replace(/\D/g, ""))}
                placeholder="0000"
                className="w-full rounded-xl px-3 py-2.5 text-center font-mono text-[15px] font-bold tracking-[0.3em] outline-none"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.12)", color: "#1C2526" }}
              />
            </Field>
            <Field label="Rol">
              <div className="flex gap-2">
                {(["cajero", "gerente"] as PosStaffRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFRole(r)}
                    className="flex-1 rounded-xl px-2 py-2.5 text-[12px] font-semibold transition-all"
                    style={
                      fRole === r
                        ? { background: "#F28C38", color: "#fff", border: "1.5px solid #F28C38" }
                        : { background: "#ffffff", color: "rgba(28,37,38,0.55)", border: "1.5px solid rgba(28,37,38,0.14)" }
                    }
                  >
                    {r === "cajero" ? "Cajero" : "Gerente"}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          {err && (
            <p className="text-[11px] font-semibold" style={{ color: "#dc2626" }}>{err}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-bold text-[#1C2526] transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#F28C38" }}
            >
              {busy ? "Guardando…" : "Agregar al equipo"}
            </button>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setErr(null); }}
              disabled={busy}
              className="rounded-xl px-4 py-2.5 text-[12px] font-semibold"
              style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.12)", color: "rgba(28,37,38,0.6)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setFormOpen(true); setErr(null); }}
          className="w-full rounded-xl px-3.5 py-3 text-[12px] font-bold transition hover:opacity-80"
          style={{ background: "#ffffff", border: "1.5px dashed rgba(242,140,56,0.5)", color: "#F28C38" }}
        >
          + Agregar persona
        </button>
      )}

      {/* ── Cuentas con acceso propio (Pro) — espejo del hub Equipo de la app ── */}
      <div className="mt-1 border-t pt-4" style={{ borderColor: "rgba(28,37,38,0.07)" }}>
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "rgba(28,37,38,0.35)" }}
        >
          Cuentas con acceso propio · Pro
        </p>
        {isPro ? (
          <>
            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "rgba(28,37,38,0.45)" }}>
              Cada quien entra con su propia cuenta y su rol desde su teléfono o
              computadora — empleado ve solo la operación; manager también
              clientes y reportes. Las invitaciones se envían desde la app
              (Configuración → Equipo).
            </p>
            {accounts.length > 0 ? (
              <div className="mt-2 space-y-2">
                {accounts.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                    style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.08)" }}
                  >
                    <span className="text-base">🔐</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                        {m.name || m.email || m.id.slice(0, 8)}
                      </p>
                      {m.email && m.name && (
                        <p className="truncate text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                          {m.email}
                        </p>
                      )}
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={
                        m.role === "owner"
                          ? { background: "rgba(242,140,56,0.15)", color: "#F28C38" }
                          : m.status === "active"
                            ? { background: "rgba(28,37,38,0.07)", color: "rgba(28,37,38,0.55)" }
                            : { background: "rgba(234,88,12,0.1)", color: "#9A3412" }
                      }
                    >
                      {TEAM_ROLE_LABEL[m.role]}
                      {m.status !== "active" ? " · pendiente" : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                Aún no has invitado a nadie — invita a tu equipo desde la app.
              </p>
            )}
          </>
        ) : (
          <div
            className="mt-2 rounded-xl p-3.5"
            style={{ background: "rgba(242,140,56,0.07)", border: "1px solid rgba(242,140,56,0.25)" }}
          >
            <p className="text-[12px] font-bold" style={{ color: "#1C2526" }}>
              ⭐ Incluido en Pro
            </p>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(28,37,38,0.55)" }}>
              Cuentas con acceso propio para tu equipo: cada quien entra con su
              cuenta y su rol desde su propio teléfono — empleado ve solo la
              caja; manager también clientes y reportes. Todo tu equipo,
              incluido.
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function PctInput({
  label, value, onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step={5}
          value={value}
          placeholder="0"
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Math.min(100, Math.max(0, Number(e.target.value))))
          }
          className="w-24 rounded-xl px-3 py-2.5 text-[13px] outline-none"
          style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.12)", color: "#1C2526" }}
        />
        <span className="text-[13px] font-semibold" style={{ color: "rgba(28,37,38,0.45)" }}>%</span>
      </div>
    </Field>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

function Spin() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}
