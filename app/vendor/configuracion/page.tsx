"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { persistReadiness, stepGroupFromReasons } from "@/lib/vendorReadiness";
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
  const [signingOut, setSigningOut] = useState(false);
  const [activatingPro, setActivatingPro] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [dailyRevenueGoal, setDailyRevenueGoal] = useState<number | "">("");
  /** "Pagar al recoger" en el menú web — el cliente ordena sin pago en línea
   * y paga en el local; el pedido llega a Pedidos y se cobra ahí. */
  const [payAtPickup, setPayAtPickup] = useState(false);
  /** Saving re-runs the readiness check; incomplete → restaurant demoted to
   * "setup" and web Mercado Pago pauses. Surface it — never fail silently. */
  const [setupReasons, setSetupReasons] = useState<string[]>([]);

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
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }

      const [rSnap, subSnap] = await Promise.all([
        getDoc(doc(db, "restaurants", rid)),
        getDoc(doc(db, "restaurants", rid, "subscriptions", "current")).catch(() => null),
      ]);

      const data = rSnap.data() ?? {};
      setRestaurantId(rid);
      setName((data.name as string) ?? "");
      setAddress((data.address as string) ?? "");
      setPhone((data.phone as string) ?? "");
      setCategories((data.categories as string[]) ?? []);
      const goal = data.dailyRevenueGoal as number | undefined;
      setDailyRevenueGoal(goal && goal > 0 ? goal : "");
      setPayAtPickup(data.payAtPickupEnabled === true);
      if (data.isSetupComplete === false) {
        setSetupReasons((data.setupIncompleteReasons as string[]) ?? []);
      }

      const logo = (data.logoUrl as string) || (data.imageUrl as string) || "";
      const cover = (data.coverImageUrl as string) || (data.menuBannerUrl as string) || "";
      setLogoUrl(logo);
      setCoverUrl(cover);

      // Detect plan — canonical fields first (what the app IAP + MP webhook write),
      // then legacy subscription doc / top-level field.
      const accessStatus = data.subscriptionAccessStatus as string | undefined;
      const expiresAtRaw = data.subscriptionAccessExpiresAt as
        | { toMillis?: () => number }
        | undefined;
      const expiresMs = expiresAtRaw?.toMillis?.() ?? null;
      const canonicalPro =
        data.subscriptionPlan === "pro" &&
        (accessStatus === "active" || accessStatus === "trialing") &&
        expiresMs != null &&
        expiresMs > Date.now();
      const subData = subSnap?.data();
      const isPro =
        canonicalPro ||
        (subData?.status === "active" && subData?.plan === "pro") ||
        data.plan === "pro";
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
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
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
    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: Record<string, any> = {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        categories,
        payAtPickupEnabled: payAtPickup,
        lastUpdated: serverTimestamp(),
      };
      if (dailyRevenueGoal !== "" && Number(dailyRevenueGoal) > 0) {
        update.dailyRevenueGoal = Number(dailyRevenueGoal);
      } else {
        update.dailyRevenueGoal = 0;
      }
      await updateDoc(doc(db, "restaurants", restaurantId), update);
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
            <SectionCard label="Tu plan">
              {plan === "pro" ? (
                <div className="py-1">
                  <p className="text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                    Plan Pro activo ⭐
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>
                    Lealtad ilimitada, recuperación por WhatsApp, Comeleal AI y soporte directo
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
                      Pro · $299/mes — la máquina de que regresen
                    </p>
                    <ul className="mt-1.5 space-y-1 text-[11px]" style={{ color: "rgba(28,37,38,0.6)" }}>
                      <li>✓ Lealtad ilimitada (sin tope de 50 visitas)</li>
                      <li>✓ Recuperación automática por WhatsApp sin límite</li>
                      <li>✓ Comeleal AI sin límite</li>
                      <li>✓ Soporte directo — te contesta una persona</li>
                    </ul>
                    <button
                      type="button"
                      onClick={handleActivatePro}
                      disabled={activatingPro}
                      className="mt-3 w-full rounded-xl px-3 py-2.5 text-[12px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                      style={{ background: "#F28C38" }}
                    >
                      {activatingPro ? "Abriendo pago…" : "Activar Pro →"}
                    </button>
                    <p className="mt-1.5 text-center text-[10px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                      Pago seguro con Mercado Pago · cancela cuando quieras
                    </p>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* ── Soporte ── */}
            <SectionCard label="Soporte">
              <ManageLink
                href="https://apps.apple.com/mx/app/foodpass/id6745301069"
                emoji="📱"
                title="App cliente (iOS)"
                subtitle="Descarga la app para los clientes"
                external
              />
              <ManageLink
                href="/para-restaurantes"
                emoji="❓"
                title="Centro de ayuda"
                subtitle="Documentación y tutoriales"
                last
              />
            </SectionCard>

            {/* ── Cerrar sesión ── */}
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
            </SectionCard>

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
            <SectionCard label="Tipo de restaurante">
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
          </div>
        )}
        </div>
      </main>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
