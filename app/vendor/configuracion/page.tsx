"use client";

import { MercadoPagoConnectCard } from "@/components/vendor/MercadoPagoConnectCard";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, deleteField, collection, getDocs, addDoc, deleteDoc, query, where, limit } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import CambiarContrasenaCard from "../_components/CambiarContrasenaCard";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";
import { POS_PAYMENT_OPTIONS, acceptedPaymentMethods, type PaymentMethod } from "@/lib/pos/paidOrderFields";
import { deliveryFeeOf, deliveryZoneOf, restaurantOffersDelivery } from "@/lib/order/deliveryOptions";
import { TICKET_SAMPLE_ID, autoPrintTickets, ticketPaperMm } from "@/lib/pos/ticketPaper";
import {
  entitlementOf,
  entitlementsOf,
  FREE_ENTITLEMENTS,
  PRO_ENTITLEMENTS,
  type Entitlement,
  type Entitlements,
} from "@/lib/subscription/entitlement";
import { fetchWithBilling } from "@/lib/subscription/billingDoc";
import { PRO_PRICE_LABEL } from "@/lib/subscription/pricing";
import { ProWall } from "@/components/vendor/ProWall";
import { parseLocationLink, cityFieldsFromVerdict } from "@/lib/geocodeRestaurant";
import { waitForAuthReady } from "@/lib/auth";
import { requestPasswordReset } from "@/lib/passwordReset";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import { persistReadiness, stepGroupFromReasons } from "@/lib/vendorReadiness";
import { parseDiscountProfiles, isFounderTestRestaurant, type DiscountProfile } from "@/lib/loyalty/discountProfiles";
import { isGoogleReviewUrl } from "@/lib/googleReviewUrl";
import { TAGLINE_MAX, normalizeTaglineInput, taglineFromRestaurant } from "@/lib/brand/brandColor";
import { canAddPosStaff, parsePosStaff, type PosStaffMember, type PosStaffRole } from "@/lib/posStaff";
import { PUBLIC_WHATSAPP_WA_ME_VENDOR_HELP } from "@/lib/contactEmail";
import { isUsableSlug, slugFromRestaurantData, slugify } from "@/lib/slug";
import type { User } from "firebase/auth";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, isoCountryOf, phoneCountryOf } from "@/lib/phone/phoneCountry";
import { PhoneCountrySelect } from "@/components/phone/PhoneCountrySelect";
import { defaultSpendStepForCurrency, earnRuleLine, newVenueEarnPolicy } from "@/lib/loyalty/earnPolicy";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_CATEGORIES = [
  "Tacos","Café","Hamburguesas","Pizza","Sushi",
  "Mariscos","Antojitos","Carnes","Postres","Otro",
] as const;

// ─── Opción A (23-sep-2026, lienzo "Sistema Comeleal") ────────────────────────
// Los mismos tokens que Panel, Pedidos, Caja y Clientes: crema + tinta, UNA
// serif (Lora) solo en el título de pantalla y los de sección, naranja solo
// en el botón principal ("Guardar cambios") con tinta encima. Sin emojis,
// sin sombras, sin degradados.
const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const INK_SOFT = "#5B6366";
const CREAM = "#FAF9F5";
const HAIRLINE = "#E9E3D7";
const BORDER = "#D9D2C5";
const TILE = "#F0EBE1";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const WARN = "#B45309";
const WARN_SURFACE = "#FFFBEB";
const SUCCESS = "#15803D";
const DANGER = "#B91C1C";

/** Campo de texto: 48px, blanco, borde, radio 12, letra 16 (evita el zoom del
 *  iPhone), foco con borde tinta. Lo comparten TextInput, textarea y números. */
const INPUT_CLS =
  "h-12 w-full rounded-xl border border-[#D9D2C5] bg-white px-3.5 text-[16px] text-[#1C2526] outline-none transition-colors placeholder:text-[#5B6366] focus:border-[#1C2526] disabled:opacity-50";

/** Botones: uno principal (naranja) por formulario; secundarios en blanco con
 *  borde; el "fuerte" con borde tinta; el terciario es texto link. */
const BTN_PRIMARY =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold text-[#1C2526] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60";
const BTN_SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9D2C5] bg-white px-4 text-[14px] font-semibold text-[#1C2526] transition hover:bg-[#FAF9F5] disabled:opacity-50";
const BTN_SECONDARY_STRONG =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#1C2526] bg-white px-4 text-[14px] font-semibold text-[#1C2526] transition hover:bg-[#FAF9F5] disabled:opacity-50";
const BTN_DANGER =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9D2C5] bg-white px-4 text-[14px] font-semibold text-[#B91C1C] transition hover:bg-[#FAF9F5] disabled:opacity-50";
const BTN_TERTIARY = "text-[14px] font-semibold text-[#8A4B12] hover:underline disabled:opacity-50";

const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconChevron() { return <svg {...ICON} stroke={INK_SOFT} aria-hidden><path d="M9 6l6 6-6 6" /></svg>; }
function IconLock() { return <svg {...ICON} stroke={INK} aria-hidden><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>; }
/** Platillo: el hueco del logo cuando el local aún no sube uno. */
function IconDish() { return <svg {...ICON} width={26} height={26} stroke={INK_SOFT} aria-hidden><path d="M3 15h18" /><path d="M5 15a7 7 0 0 1 14 0" /><path d="M12 8V6" /><path d="M4 19h16" /></svg>; }
/** Foto: el hueco de la portada. */
function IconPhoto() { return <svg {...ICON} width={26} height={26} stroke={INK_SOFT} aria-hidden><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M20 15l-4.5-4.5L8 18" /></svg>; }
function IconCheck() { return <svg {...ICON} width={16} height={16} stroke={INK} aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>; }

/** Pastilla de estado: 24px, 12/600, fondo tile (o tinta para "Pro"). */
function Pill({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[24px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

/** Interruptor: pista tinta cuando está prendido, línea fina cuando no. */
function Switch({ on }: { on: boolean }) {
  return (
    <span className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: on ? INK : HAIRLINE }} aria-hidden>
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
        style={{ left: on ? "22px" : "2px", border: on ? "none" : `1px solid ${BORDER}` }}
      />
    </span>
  );
}

/** Fila con interruptor: título 15 tinta, caption 13, y el switch a la derecha. */
function ToggleRow({
  on, onToggle, title, caption, disabled = false, note,
}: {
  on: boolean;
  onToggle: () => void;
  title: string;
  caption?: React.ReactNode;
  disabled?: boolean;
  note?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={on}
      className="flex min-h-12 w-full items-center justify-between gap-4 py-1 text-left disabled:cursor-default"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-5" style={{ color: INK }}>{title}</span>
        {caption ? <span className="mt-0.5 block text-[13px] leading-[18px]" style={{ color: INK_MUTED }}>{caption}</span> : null}
        {note ? <span className="mt-0.5 block text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>{note}</span> : null}
      </span>
      <Switch on={on} />
    </button>
  );
}

/** Chip de opción: 36px, borde; activo = fondo tinta, texto crema. */
function Chip({ active, onClick, children, className = "", disabled = false }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-[14px] font-medium transition disabled:opacity-50 ${className}`}
      style={active ? { background: INK, color: CREAM, border: `1px solid ${INK}` } : { background: "#ffffff", color: INK, border: `1px solid ${BORDER}` }}
    >
      {children}
    </button>
  );
}

/** Aviso ámbar: fila #FFFBEB con texto #B45309, sin ícono grande. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3 text-[14px] leading-5" style={{ background: WARN_SURFACE, color: WARN }}>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  // Pared 2 de la Caja (8-sep): el 2° PIN del equipo es Pro. Entitlements
  // sobre el doc fundido con private/billing (fetchWithBilling).
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [ents, setEnts] = useState<Entitlements>(FREE_ENTITLEMENTS);
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
    // Resend desde ricardo@comeleal.com, con plan B a Firebase (lib/passwordReset).
    const r = await requestPasswordReset(correo);
    if (r === "wait") {
      setError("Ya te mandamos varios correos. Revisa spam o espera una hora.");
      return;
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
  /** Link de ubicación pegado por el dueño (WhatsApp/Google Maps) — la vía
   * para un puesto sin ficha de Google. Ver parseLocationLink. */
  const [pinLink, setPinLink] = useState("");
  const [pinLinkError, setPinLinkError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);
  const [phone, setPhone] = useState("");
  /** País del teléfono (5-sep): wa.me y SMS del local marcan con este código. */
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY);
  /** Moneda del local; el paso de puntos ("1 extra por cada $X") sale de ella. */
  const [currency, setCurrency] = useState("MXN");
  /** Moneda tal como se cargó: sólo si cambia se reescribe la política de puntos. */
  const [loadedCurrency, setLoadedCurrency] = useState("MXN");
  /** "Nuestra historia" (patrón Our Story de Owner/Metro Pizza) — se pinta
   * en la página pública /r/{id} cuando el dueño la escribe. Opcional. */
  const [story, setStory] = useState("");
  // El lema bajo el nombre. La IA lo saca de la foto del menú; el dueño lo
  // puede cambiar aquí (10-sep-2026).
  const [tagline, setTagline] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  /** Slug público (comeleal.com/r/{slug}) — se auto-reclama al guardar. */
  const [slug, setSlug] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [dailyRevenueGoal, setDailyRevenueGoal] = useState<number | "">("");
  /** "Pagar al recoger" en el menú web — el cliente ordena sin pago en línea
   * y paga en el local; el pedido llega a Pedidos y se cobra ahí. */
  const [payAtPickup, setPayAtPickup] = useState(false);
  // 🎚️ Formas de pago que acepta el local (Caja + lo que ve el cliente).
  const [acceptedMethods, setAcceptedMethods] = useState<PaymentMethod[]>(
    POS_PAYMENT_OPTIONS.map((o) => o.key),
  );
  const [birthdayEnabled, setBirthdayEnabled] = useState(false);
  const [birthdayPoints, setBirthdayPoints] = useState(10);
  /** 🛵 Entrega a domicilio (9-sep): el comensal elige "A domicilio" en el
   * checkout y escribe su dirección; el pedido llega a Pedidos con ella. */
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  /** 🛵 Costo de envío fijo (vacío = no cobra). Se suma al total del pedido. */
  const [deliveryFee, setDeliveryFee] = useState<number | "">("");
  /** 🛵 "¿Hasta dónde entregas?" — texto que ve el comensal al elegir A domicilio. */
  const [deliveryZone, setDeliveryZone] = useState("");
  /** 🖨️ Ancho del papel de la impresora térmica (10-sep): 80 o 58 mm. */
  const [paperMm, setPaperMm] = useState<58 | 80>(80);
  /** 🖨️ Sale solo (23-sep, Pro): cada pedido que entra se imprime desde Pedidos. */
  const [autoPrintOn, setAutoPrintOn] = useState(false);
  /** Pared 4 (ticket de cocina e impresora): prender "sale solo" o imprimir
   * la prueba con la reja cerrada abre LA pared; si se abre, repite. */
  const [printWallOpen, setPrintWallOpen] = useState(false);
  const printPending = useRef<(() => void) | null>(null);
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
      if (!u || u.isAnonymous) { router.push("/activar?modo=entrar"); return; }
      setUser(u);
      const db = getFirebaseDb();
      // Staff-aware: configuración/billing es SOLO del dueño (matrix del app:
      // manager canManageSettings=false). Staff cae a su home, no a /activar.
      const ctx = await resolveVendorContext(db, u.uid);
      if (!ctx) { router.push("/activar?modo=entrar"); return; }
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
      setPhoneCountry(phoneCountryOf(data));
      {
        const cur = typeof data.currencyCode === "string" && data.currencyCode.trim()
          ? data.currencyCode.trim().toUpperCase()
          : "MXN";
        setCurrency(cur);
        setLoadedCurrency(cur);
      }
      setStory((data.story as string) ?? "");
      setTagline(taglineFromRestaurant(data) ?? "");
      setGoogleReviewUrl((data.googleReviewUrl as string) ?? "");
      setSlug(slugFromRestaurantData(data));
      setCategories((data.categories as string[]) ?? []);
      const goal = data.dailyRevenueGoal as number | undefined;
      setDailyRevenueGoal(goal && goal > 0 ? goal : "");
      setPayAtPickup(data.payAtPickupEnabled === true);
      setAcceptedMethods(acceptedPaymentMethods(data));
      setDeliveryEnabled(restaurantOffersDelivery(data));
      const fee = deliveryFeeOf(data);
      setDeliveryFee(fee > 0 ? fee : "");
      setDeliveryZone(deliveryZoneOf(data));
      setPaperMm(ticketPaperMm(data));
      setAutoPrintOn(autoPrintTickets(data));
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
      // La verdad canónica vive en private/billing (migración 24-ago).
      const merged = await fetchWithBilling(db, rid, data);
      const entNow = entitlementOf(merged);
      const legacySub = subData?.status === "active" && subData?.plan === "pro";
      const isPro = entNow.isPro || legacySub;
      setPlan(isPro ? "pro" : "free");
      setEnt(entNow);
      // entitlementsOf ya trae el bypass de fundador (Luzz); el doc viejo de
      // subscriptions (legado) también abre todo.
      setEnts(legacySub ? PRO_ENTITLEMENTS : entitlementsOf(merged, rid));

      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  /** Pro checkout: create MP preapproval (PRO_AMOUNT_MXN/mes) and redirect to its init_point.
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

  /** El pin desde un link pegado (WhatsApp/Google Maps) — cierra el caso
   * "puesto sin ficha de Google" sin construir un mapa: el GPS del dueño es
   * la mejor verdad de ubicación que existe. parseLocationLink rechaza
   * Null Island y links sin coordenadas — jamás se adivina un pin. */
  async function handlePinLink() {
    if (!restaurantId || savingPin) return;
    const coords = parseLocationLink(pinLink);
    if (!coords) {
      setPinLinkError(
        "No encontré la ubicación en ese link. Comparte la ubicación desde " +
          "Google Maps o WhatsApp y pega el link completo.",
      );
      return;
    }
    setSavingPin(true);
    try {
      const db = getFirebaseDb();
      // El pin lo puso el dueño a mano: Google nos dice la ciudad de ese
      // punto (reverse). Si falla, el pin se guarda igual; la ciudad la
      // deriva el servidor después (functions/restaurant_city_from_pin.js).
      let cityFields: Record<string, unknown> = {};
      try {
        const rev = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
        });
        const loc = await rev.json();
        if (loc?.ok) cityFields = cityFieldsFromVerdict(loc, coords.lat, coords.lng, "reverse_geocode");
      } catch {
        /* la ciudad la deriva el servidor */
      }
      await updateDoc(doc(db, "restaurants", restaurantId), {
        lat: coords.lat,
        lng: coords.lng,
        ...cityFields,
        locationSource: "owner_confirmed",
        locationUpdatedAt: serverTimestamp(),
        locationNeedsReview: deleteField(),
      });
      setLocationUnresolved(false);
      setPinSaved(true);
      setPinLink("");
    } catch {
      setPinLinkError("No pudimos guardar tu ubicación. Intenta de nuevo.");
    } finally {
      setSavingPin(false);
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
        phoneCountryCode: phoneCountry,
        currencyCode: currency,
        story: story.trim(),
        // Vacío = borrar el campo (así la IA no se pelea con una cadena "").
        tagline: normalizeTaglineInput(tagline) || deleteField(),
        googleReviewUrl: googleReviewUrl.trim(),
        categories,
        payAtPickupEnabled: payAtPickup,
        paymentMethods: acceptedMethods,
        // 🛵 Mismos nombres que ya lee la app (deliveryFee en OrderDetailScreen).
        deliveryEnabled,
        deliveryFee: deliveryFee !== "" && Number(deliveryFee) > 0 ? Number(deliveryFee) : 0,
        deliveryZone: deliveryZone.trim(),
        ticketPaperMm: paperMm,
        autoPrintTickets: autoPrintOn,
        birthdayReward: { enabled: birthdayEnabled, points: birthdayPoints },
        lastUpdated: serverTimestamp(),
      };
      // Cambió de moneda (5-sep): la regla de puntos se recalibra a su
      // moneda (MXN 30 · USD 2 · DOP 100 · COP 8,000). Misma moneda = no se
      // toca lo que ya tenía.
      if (currency !== loadedCurrency) {
        update.loyaltyEarnPolicy = newVenueEarnPolicy(currency);
      }
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
      // Y TAMBIÉN cuando el pin sigue sin resolverse (12-sep-2026): el aviso
      // amarillo le dice al dueño "guarda otra vez", pero si su dirección ya
      // estaba bien escrita el texto no cambia, así que no se reintentaba nada
      // y el consejo era mentira. Zahir guardó tres veces con la dirección
      // correcta y su pin siguió en 0,0.
      const addressChanged = address.trim() !== (initialAddressRef.current ?? "").trim();
      if (addressChanged || locationUnresolved) {
        try {
          const geoRes = await fetch("/api/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: address.trim(),
              phone: phone.trim(),
              // El país que eligió el dueño, no el que adivine su número.
              country: isoCountryOf({ phoneCountryCode: phoneCountry, currencyCode: currency }),
            }),
          });
          const verdict = await geoRes.json();
          setLocationUnresolved(!verdict?.ok);
          if (verdict?.ok) {
            update.lat = verdict.lat;
            update.lng = verdict.lng;
            Object.assign(update, cityFieldsFromVerdict(verdict, verdict.lat, verdict.lng, "geocode"));
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
      router.push("/activar?modo=entrar");
    } catch {
      setSigningOut(false);
    }
  }

  // Estas dos tarjetas viven en la columna izquierda en desktop y al FINAL
  // de la página en móvil (el formulario del negocio va primero en teléfono).
  const planCard = (
            <SectionCard label="Tu plan" plain>
              {plan === "pro" ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>
                      Plan Pro activo
                    </p>
                    <p className="mt-0.5 text-[13px] leading-[18px]" style={{ color: INK_MUTED }}>
                      Todo tu historial, tu equipo con su PIN, mesas, descuentos especiales y Pregúntale a Comeleal sin límite
                    </p>
                  </div>
                  <Pill bg={INK} color={CREAM}>Pro</Pill>
                </div>
              ) : (
                <div>
                  <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>
                    Plan Gratis — para operar
                  </p>
                  <p className="mt-0.5 text-[13px] leading-[18px]" style={{ color: INK_MUTED }}>
                    Menú QR, Caja, pedidos, puntos sin tope, tus clientes y reportes: gratis siempre.
                  </p>
                  {/* Lo que trae Pro es una LISTA: por eso sí va en tarjeta. */}
                  <div className="mt-4 rounded-xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
                    <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>
                      Pro · {PRO_PRICE_LABEL}/mes — para cuando tu Caja crece
                    </p>
                    <ul className="mt-2">
                      {[
                        "Todo tu historial de ventas (más de 30 días)",
                        "Tu equipo cobra con su PIN",
                        "Cuentas por mesa",
                        "Cuentas con acceso propio para tu equipo, cada quien con su rol",
                        "Pregúntale a Comeleal sin límite",
                        "Descuentos especiales (staff y familia) — la Caja los aplica sola",
                      ].map((line, i) => (
                        <li
                          key={line}
                          className="flex items-start gap-2 py-2 text-[14px] leading-5"
                          style={{ color: INK, borderTop: i > 0 ? `1px solid ${HAIRLINE}` : undefined }}
                        >
                          <span className="mt-0.5 shrink-0"><IconCheck /></span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={handleActivatePro}
                      disabled={activatingPro}
                      className={`${BTN_PRIMARY} mt-3`}
                      style={{ background: INK, color: CREAM }}
                    >
                      {activatingPro ? "Abriendo pago…" : "Activar Pro"}
                    </button>
                    <p className="mt-2 text-center text-[13px] leading-4" style={{ color: INK_SOFT }}>
                      Pago seguro con Mercado Pago · cancela cuando quieras
                    </p>
                    <Link href="/vendor/plan" className={`${BTN_TERTIARY} mt-2 block text-center`}>
                      Ver la comparación completa →
                    </Link>
                  </div>
                </div>
              )}
            </SectionCard>
  );

  const soporteCard = (
            <SectionCard label="Soporte" plain>
              <ManageLink
                href="https://apps.apple.com/mx/app/foodpass/id6745301069"
                title="App cliente (iOS)"
                subtitle="Descarga la app para los clientes"
                external
              />
              <ManageLink
                href={PUBLIC_WHATSAPP_WA_ME_VENDOR_HELP}
                title="Ayuda por WhatsApp"
                subtitle="Te contesta una persona"
                external
                last
              />
            </SectionCard>
  );

  return (
    <>
      <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7">
        {/* Título de pantalla (Lora) + caption. */}
        <div className="mb-6 flex flex-col gap-0.5">
          <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>Configuración</h1>
          <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>
            Tu negocio, tu plan y tu cuenta
          </p>
        </div>

        <div className="max-w-6xl">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          {/* ── Left column: cuenta ── */}
          <div className="space-y-7">

            {/* ── Quién está adentro: inicial en tile, nombre, correo y plan ── */}
            <div>
              <div className="flex min-h-12 items-center gap-3 py-2" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
                  style={{ background: TILE, color: INK }}
                >
                  {(user?.displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[15px] font-semibold leading-5" style={{ color: INK }}>
                    {user?.displayName ?? user?.email ?? "Propietario"}
                  </p>
                  <p className="truncate text-[13px] leading-4" style={{ color: INK_SOFT }}>
                    {user?.email ?? ""}
                  </p>
                </div>
                {plan === "pro"
                  ? <Pill bg={INK} color={CREAM}>Pro</Pill>
                  : <Pill bg={TILE} color={INK_MUTED}>Gratis</Pill>}
              </div>

              {/* Cambiar contraseña — NO existía en el panel, y el dueño vive
                  AQUÍ: aquí está su Caja, sus pedidos y sus reportes. Sin esto
                  tenía que bajarse la app solo para cambiarla.
                  Se manda link por correo en vez de pedir la actual: quien la
                  quiere cambiar suele ser justo quien no la recuerda, y pedirle
                  la vieja lo deja trabado. Solo se ofrece a cuentas que DE VERDAD
                  tienen contraseña — una de Google no la tiene. */}
              {tienePassword && (
                <button
                  type="button"
                  onClick={handleCambiarPassword}
                  disabled={resetEnviado}
                  className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left transition-opacity hover:opacity-75 disabled:cursor-default"
                >
                  <IconLock />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold leading-5" style={{ color: INK }}>
                      {resetEnviado ? "Correo enviado" : "Cambiar mi contraseña"}
                    </span>
                    <span className="block text-[13px] leading-4" style={{ color: INK_SOFT }}>
                      {resetEnviado
                        ? "Revisa tu correo y sigue el link."
                        : "Te mandamos un link a tu correo."}
                    </span>
                  </span>
                  {!resetEnviado && <IconChevron />}
                </button>
              )}
            </div>

            {locationUnresolved && (
              <Notice>
                <p className="font-semibold">
                  No pudimos ubicar tu dirección en el mapa
                </p>
                <p className="mt-1">
                  Tu restaurante <strong>no aparece</strong> en &ldquo;Cerca de ti&rdquo; ni
                  en Recompensas dentro de la app hasta que lo ubiquemos.
                  Escribe la <strong>calle y número, colonia y ciudad</strong> —
                  con &ldquo;{address.trim() || "el centro"}&rdquo; no alcanza — y
                  guarda otra vez.
                </p>
                {/* La vía para un puesto sin ficha de Google (27-ago): el
                    dueño comparte su ubicación de WhatsApp/Google Maps y
                    pega el link aquí — el GPS trae el pin exacto. */}
                <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: TILE }}>
                  <p className="text-[14px] leading-5" style={{ color: INK_MUTED }}>
                    O más fácil: párate en tu local, abre Google Maps, mantén
                    presionado sobre tu puesto y comparte el link aquí:
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={pinLink}
                      onChange={(e) => { setPinLink(e.target.value); setPinLinkError(null); }}
                      placeholder="https://maps.google.com/?q=28.63,-106.08"
                      className={`${INPUT_CLS} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={handlePinLink}
                      disabled={!pinLink.trim() || savingPin}
                      className={`${BTN_SECONDARY_STRONG} h-12 shrink-0`}
                    >
                      {savingPin ? "Guardando…" : "Ponerme en el mapa"}
                    </button>
                  </div>
                  {pinLinkError && (
                    <p className="mt-2 text-[14px] font-semibold leading-5" style={{ color: DANGER }}>{pinLinkError}</p>
                  )}
                </div>
              </Notice>
            )}
            {pinSaved && (
              <p className="text-[14px] font-semibold leading-5" style={{ color: SUCCESS }}>
                Listo. Tu negocio ya tiene ubicación y ya puede aparecer
                en &ldquo;Cerca de ti&rdquo;.
              </p>
            )}

            {error && (
              <p className="text-[14px] font-semibold leading-5" style={{ color: DANGER }} role="alert">
                {error}
              </p>
            )}

            {/* ── Horario ── (9-sep: Menú y Recompensas ya tienen botón propio
                en la barra lateral; una sola puerta por tarea. Aquí queda solo
                lo que ES configuración y no tiene otra casa: el horario.) */}
            <SectionCard label="Horario" plain>
              <ManageLink
                href="/vendor/setup/horario"
                title="Horarios"
                subtitle="Días y horas de atención"
                last
              />
            </SectionCard>

            {/* ── Tu cuenta: cambiar contraseña adentro, sin correo (9-sep) ── */}
            <SectionCard label="Tu cuenta" plain>
              <CambiarContrasenaCard />
            </SectionCard>

            {/* ── Suscripción (docs/PRICING.md) ── */}
            <div className="hidden lg:block">{planCard}</div>

            {/* ── Soporte ── */}
            <div className="hidden lg:block">{soporteCard}</div>

            {/* ── Cerrar sesión (desktop: al final de la columna izquierda) ── */}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className={`${BTN_DANGER} hidden h-12 w-full lg:inline-flex`}
            >
              {signingOut ? <><Spin /> Cerrando sesión…</> : "Cerrar sesión"}
            </button>

            <p className="hidden pb-4 text-center text-[13px] lg:block" style={{ color: INK_SOFT }}>
              Comeleal · v{new Date().getFullYear()}
            </p>

          </div>

          {/* ── Right column: negocio ── */}
          <div className="space-y-7">

            {/* ── Datos del restaurante ── */}
            <SectionCard label="Información del negocio">
              <Field label="Nombre *">
                <TextInput value={name} onChange={(v) => { setName(v); setSaved(false); }} placeholder="Ej. Tacos El Güero" />
              </Field>
              <Field label="Dirección *">
                <TextInput value={address} onChange={(v) => { setAddress(v); setSaved(false); }} placeholder="Calle, colonia, ciudad" />
              </Field>
              <Field label="Teléfono">
                <div className="flex gap-2">
                  <PhoneCountrySelect
                    value={phoneCountry}
                    currency={currency}
                    onChange={(c) => { setPhoneCountry(c.code); setCurrency(c.currency); setSaved(false); }}
                    className="h-12 max-w-[46%] shrink-0"
                  />
                  <TextInput
                    value={phone}
                    onChange={(v) => { setPhone(v); setSaved(false); }}
                    placeholder={PHONE_COUNTRIES.find((c) => c.code === phoneCountry)?.example ?? "614 123 4567"}
                    type="tel"
                  />
                </div>
                <Hint>
                  Si tu local no está en México, cambia el país aquí. Así tu botón de WhatsApp y los códigos por SMS de tus clientes marcan bien.
                  {" "}Tus precios quedan en {currency} y tus clientes ganan {earnRuleLine({ base: 1, step: defaultSpendStepForCurrency(currency) })}.
                  {currency !== loadedCurrency ? " Al guardar, la regla de puntos se ajusta a la nueva moneda." : ""}
                </Hint>
              </Field>
              <Field label="Tu frase (opcional)">
                <TextInput
                  value={tagline}
                  onChange={(v) => { setTagline(v); setSaved(false); }}
                  placeholder="Ej. Desde 1998, el mismo sazón"
                  maxLength={TAGLINE_MAX}
                />
                <Hint>
                  Una línea corta, con tu voz. Sale debajo de tu nombre en tu menú y en tu página.
                  {" "}<span className="tabular-nums">{tagline.length}/{TAGLINE_MAX}</span>
                </Hint>
              </Field>
              <Field label="Tu historia (opcional)">
                <textarea
                  value={story}
                  onChange={(e) => { setStory(e.target.value); setSaved(false); }}
                  placeholder="¿Cómo empezó tu restaurante? Los negocios con historia venden más — sale en tu página pública."
                  rows={4}
                  maxLength={1200}
                  className={`${INPUT_CLS} h-auto resize-y py-3 leading-6`}
                />
                <Hint>
                  Se muestra como &quot;Nuestra historia&quot; en tu página comeleal.com/r/…
                </Hint>
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
                <Hint>
                  Cópialo del botón &quot;Pedir reseñas&quot; en tu Perfil de Negocio de
                  Google. Con el link puesto, Comeleal invita a tus clientes a dejarte
                  reseña justo después de ganar puntos — reseñas de visitas reales.
                </Hint>
              </Field>
            </SectionCard>

            {/* ── Tu página en internet ── */}
            {restaurantId ? <PublicLinksCard restaurantId={restaurantId} slug={slug} /> : null}

            {/* ── Imágenes del restaurante ── */}
            <SectionCard label="Imágenes del negocio">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Logo */}
                <div className="flex flex-col items-center">
                  <span className="mb-2 block text-[13px] font-medium leading-4" style={{ color: INK_MUTED }}>Logo</span>
                  <div className="relative h-24 w-24 overflow-hidden rounded-full" style={{ background: TILE, border: `1px solid ${BORDER}` }}>
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><IconDish /></div>
                    )}
                    {logoUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Spinner />
                      </div>
                    )}
                  </div>
                  <label className={`${BTN_SECONDARY} mt-3 cursor-pointer`}>
                    {logoUrl ? "Cambiar logo" : "Subir logo"}
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

                {/* Portada */}
                <div className="flex flex-col items-center">
                  <span className="mb-2 block text-[13px] font-medium leading-4" style={{ color: INK_MUTED }}>Portada</span>
                  <div className="relative h-24 w-full overflow-hidden rounded-xl" style={{ background: TILE, border: `1px solid ${BORDER}` }}>
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt="Portada" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><IconPhoto /></div>
                    )}
                    {coverUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Spinner />
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <label className={`${BTN_SECONDARY} cursor-pointer`}>
                      {coverUrl ? "Cambiar portada" : "Subir portada"}
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
                        className={BTN_DANGER}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* ── Categorías ── */}
            <SectionCard label="Tipo de comida" caption="hasta 3">
              <div className="flex flex-wrap gap-2">
                {RESTAURANT_CATEGORIES.map((cat) => (
                  <Chip key={cat} active={categories.includes(cat)} onClick={() => toggleCategory(cat)}>
                    {cat}
                  </Chip>
                ))}
              </div>
            </SectionCard>

            {/* NOTE: "Puntos por visita" intentionally NOT editable — the app fixes
                pointsPerVisit to 1 and earning is governed by loyaltyEarnPolicy.
                Exposing it here would desync web from app reward math. */}

            {/* ── Meta de ingresos ── */}
            <SectionCard label="Meta de ingresos diaria">
              <Field label={`Meta en ${currency} (opcional)`}>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold" style={{ color: INK_MUTED }}>$</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={dailyRevenueGoal}
                    placeholder="0"
                    onChange={(e) => { setDailyRevenueGoal(e.target.value === "" ? "" : Number(e.target.value)); setSaved(false); }}
                    className={`${INPUT_CLS} w-40 tabular-nums`}
                  />
                  <span className="text-[13px]" style={{ color: INK_SOFT }}>{currency} / día</span>
                </div>
                <Hint>
                  Tu Panel usa esta meta para enseñarte cuánto llevas del día.
                </Hint>
              </Field>
            </SectionCard>

            {/* ── Formas de pago ── */}
            <SectionCard label="Formas de pago">
              <p className="text-[14px] leading-5" style={{ color: INK_MUTED }}>
                Lo que aceptas en el mostrador. Solo estas salen como botones en
                tu Caja y se las decimos a tus clientes.
              </p>
              <div>
                {POS_PAYMENT_OPTIONS.map((opt, i) => {
                  const on = acceptedMethods.includes(opt.key);
                  // Al menos una prendida: una Caja sin botones no cobra nada.
                  const lastOne = on && acceptedMethods.length === 1;
                  return (
                    <div key={opt.key} style={i > 0 ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}>
                      <ToggleRow
                        on={on}
                        disabled={lastOne}
                        title={opt.label}
                        note={lastOne ? "Tiene que quedar al menos una." : undefined}
                        onToggle={() => {
                          setAcceptedMethods((prev) =>
                            prev.includes(opt.key)
                              ? prev.filter((k) => k !== opt.key)
                              : POS_PAYMENT_OPTIONS.map((o) => o.key).filter(
                                  (k) => k === opt.key || prev.includes(k),
                                ),
                          );
                          setSaved(false);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* ── Pedidos en línea ── */}
            <SectionCard label="Pedidos en línea">
              <ToggleRow
                on={payAtPickup}
                onToggle={() => { setPayAtPickup((v) => !v); setSaved(false); }}
                title='Aceptar "Pagar al recoger"'
                caption="Tus clientes ordenan desde el menú sin pagar en línea y pagan al recoger. El pedido llega a Pedidos y lo cobras ahí con las formas de pago que aceptas."
              />
              <Hint>
                Con Mercado Pago conectado, el cliente elige entre pagar en línea
                o al recoger. Sin Mercado Pago, esta opción es la única forma de
                recibir pedidos en línea.
              </Hint>
            </SectionCard>

            {/* ── Entrega a domicilio (9-sep-2026) ──
                Pedido por Central Fast Food (RD): entrega él mismo y todo le
                caía como "para recoger". Default APAGADO: es trabajo del dueño.
                Sin mapa ni zonas: una caja de texto para la dirección y un
                costo fijo opcional que se suma al total. */}
            <SectionCard label="Entrega a domicilio">
              <ToggleRow
                on={deliveryEnabled}
                onToggle={() => { setDeliveryEnabled((v) => !v); setSaved(false); }}
                title="Entrego a domicilio"
                caption='Tus clientes eligen "A domicilio" al ordenar y escriben su dirección. Te llega en Pedidos con la dirección para que lo lleves tú.'
              />
              {deliveryEnabled ? (
                <div className="space-y-4 pt-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                  <Field label="Costo de envío (opcional)">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold" style={{ color: INK_MUTED }}>$</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={deliveryFee}
                        placeholder="0"
                        onChange={(e) => { setDeliveryFee(e.target.value === "" ? "" : Number(e.target.value)); setSaved(false); }}
                        className={`${INPUT_CLS} w-40 tabular-nums`}
                      />
                      <span className="text-[13px]" style={{ color: INK_SOFT }}>{currency} por pedido</span>
                    </div>
                    <Hint>
                      Se suma al total del pedido. Vacío = no cobras envío.
                    </Hint>
                  </Field>
                  <Field label="¿Hasta dónde entregas? (opcional)">
                    <input
                      type="text"
                      maxLength={120}
                      value={deliveryZone}
                      placeholder="Ej. Solo dentro de la ciudad"
                      onChange={(e) => { setDeliveryZone(e.target.value); setSaved(false); }}
                      className={INPUT_CLS}
                    />
                    <Hint>
                      Tu cliente lo lee al elegir &quot;A domicilio&quot;, para que no te pida de más lejos.
                    </Hint>
                  </Field>
                  {!payAtPickup && !mpConnected ? (
                    <Notice>
                      Para recibir pedidos necesitas prender &quot;Pagar al recoger&quot; o conectar Mercado Pago.
                    </Notice>
                  ) : null}
                </div>
              ) : null}
            </SectionCard>

            {/* ── Impresora de tickets (10-sep-2026) ──
                Zahir (RD) tiene una AOKIA AK-3280 de 80 mm (USB + red, SIN
                Bluetooth — lo confirmó su foto el 12-sep). No hay nada
                que "conectar" aquí: el celular empareja la impresora y una app
                puente la presta a Chrome. Comeleal solo imprime una hoja
                limpia. Esta sección: ancho del papel, los pasos y una prueba. */}
            <SectionCard label="Impresora de tickets" caption={<Pill bg={TILE} color={INK_MUTED}>Incluido en Pro</Pill>}>
              <p className="text-[14px] leading-5" style={{ color: INK_MUTED }}>
                El ticket de cocina de cada pedido, en grande: desde Pedidos,
                al cobrar en la Caja, o solo en cuanto entra el pedido. Sirve con
                impresoras térmicas de 80 y 58 mm.
              </p>
              {/* Sale solo (23-sep, Pro): el interruptor abre la pared si la
                  reja está cerrada; con Pro (o la prueba) se prende y se guarda. */}
              <div style={{ borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
                <ToggleRow
                  on={autoPrintOn}
                  onToggle={() => {
                    if (!autoPrintOn && !ents.kitchenPrintAccess) {
                      printPending.current = () => { setAutoPrintOn(true); setSaved(false); };
                      setPrintWallOpen(true);
                      return;
                    }
                    setAutoPrintOn((v) => !v);
                    setSaved(false);
                  }}
                  title="Sale solo cuando entra un pedido"
                  caption="Con Pedidos abierto en la compu de la impresora, cada pedido nuevo se imprime sin que nadie toque nada."
                />
              </div>
              <Field label="Ancho del papel">
                <div className="flex gap-2">
                  {([80, 58] as const).map((mm) => (
                    <Chip key={mm} active={paperMm === mm} onClick={() => { setPaperMm(mm); setSaved(false); }}>
                      {mm} mm
                    </Chip>
                  ))}
                </div>
              </Field>
              <div className="rounded-xl px-3.5 py-3 text-[14px] leading-5" style={{ background: TILE, color: INK_MUTED }}>
                <p className="font-semibold" style={{ color: INK }}>En una computadora (lo más fácil):</p>
                <p className="mt-1">1. Conecta la impresora por USB y déjala como impresora predeterminada.</p>
                <p>2. Abre comeleal.com/vendor/pedidos en Chrome y déjalo abierto todo el turno.</p>
                <p>3. Para que salga sin preguntar: clic derecho al acceso directo de Chrome → Propiedades → al final de &quot;Destino&quot; escribe un espacio y <code>--kiosk-printing</code>. Abre Chrome desde ese acceso directo.</p>
                <p className="mt-2 font-semibold" style={{ color: INK }}>Desde un celular Android:</p>
                <p className="mt-1">Por Bluetooth: empareja la impresora en los ajustes del celular e instala la app gratis &quot;ESCPOS Bluetooth Print Service&quot;. Por cable de red: instala &quot;RawBT&quot; y pon ahí la IP de la impresora. Al tocar Imprimir, escoge esa impresora en la ventana de Chrome.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const go = () => window.open(`/vendor/ticket/${TICKET_SAMPLE_ID}?w=${paperMm}`, "_blank", "noopener,noreferrer");
                  if (!ents.kitchenPrintAccess) {
                    printPending.current = go;
                    setPrintWallOpen(true);
                    return;
                  }
                  go();
                }}
                className={`${BTN_SECONDARY_STRONG} h-12 w-full`}
              >
                Imprimir ticket de prueba
              </button>
            </SectionCard>

            {/* ── Premio de cumpleaños ──
                Espejo del BirthdayRewardToggle de la app. Puntos y no platillo
                a propósito (viajan por todas las superficies sin estados
                nuevos). Default OFF: es dinero del dueño. El depósito lo hace
                functions/birthday_reward_sweep.js (dormido tras
                BIRTHDAY_REWARD_ENABLED). */}
            <SectionCard label="Premio de cumpleaños">
              <ToggleRow
                on={birthdayEnabled}
                onToggle={() => { setBirthdayEnabled((v) => !v); setSaved(false); }}
                title="Regalar puntos de cumpleaños"
                caption="El día de su cumpleaños, tus clientes reciben puntos de regalo y un aviso para venir a celebrar contigo. Comeleal lo hace solo."
              />
              {birthdayEnabled ? (
                <div className="flex flex-wrap items-center gap-2 pt-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                  <span className="text-[13px]" style={{ color: INK_MUTED }}>
                    Puntos de regalo:
                  </span>
                  {[5, 10, 20].map((opt) => (
                    <Chip key={opt} active={birthdayPoints === opt} onClick={() => { setBirthdayPoints(opt); setSaved(false); }} className="tabular-nums">
                      {opt}
                    </Chip>
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
                entitlement={ent}
                entitlements={ents}
                onUnlocked={(next, nextEnt) => {
                  setEnts(next);
                  setEnt(nextEnt);
                  setPlan("pro");
                }}
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
                <Notice>
                  <p className="font-semibold">Tu configuración está incompleta</p>
                  <p className="mt-1">
                    Falta: {labels.join(", ")}. Mientras tanto, los pagos en línea
                    con Mercado Pago están pausados en tu menú
                    {payAtPickup ? " (Pagar al recoger sigue funcionando)" : ""}.
                  </p>
                  <Link href="/vendor/setup" className="mt-2 inline-block font-semibold underline underline-offset-2" style={{ color: WARN }}>
                    Completar configuración →
                  </Link>
                </Notice>
              );
            })()}

            {/* ── Guardar: EL botón principal de la pantalla ── */}
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={BTN_PRIMARY}
              style={saved ? { background: "#ffffff", color: SUCCESS, border: `1px solid ${BORDER}` } : { background: BRAND, color: INK }}
            >
              {saved ? "Cambios guardados" : saving ? <><Spin /> Guardando…</> : "Guardar cambios"}
            </button>

          </div>

          {/* ── Móvil: plan, soporte y cerrar sesión al FINAL de la página ── */}
          <div className="space-y-7 lg:hidden">
            {planCard}
            {soporteCard}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className={`${BTN_DANGER} h-12 w-full`}
            >
              {signingOut ? <><Spin /> Cerrando sesión…</> : "Cerrar sesión"}
            </button>
            <p className="pb-4 text-center text-[13px]" style={{ color: INK_SOFT }}>
              Comeleal · v{new Date().getFullYear()}
            </p>
          </div>
          </div>
        )}
        </div>
      </main>

      {/* ── Pared 4: ticket de cocina e impresora (23-sep-2026) ── */}
      {printWallOpen && ent && restaurantId && (
        <ProWall
          wall="kitchenPrint"
          restaurantId={restaurantId}
          entitlement={ent}
          onClose={() => {
            setPrintWallOpen(false);
            printPending.current = null;
          }}
          onUnlocked={(next, nextEnt) => {
            setEnts(next);
            setEnt(nextEnt);
            setPlan("pro");
            setPrintWallOpen(false);
            const again = printPending.current;
            printPending.current = null;
            again?.();
          }}
        />
      )}
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
      label: "Tu página",
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
      label: "Tu menú",
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
      <div>
        {links.map((l, i) => (
          <div
            key={l.key}
            className="py-3"
            style={i > 0 ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-5" style={{ color: INK }}>
                  {l.label}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[13px] leading-4" style={{ color: INK_MUTED }}>
                  {l.url.replace("https://", "")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${BTN_SECONDARY} h-10`}
                >
                  Ver
                </a>
                <button
                  type="button"
                  onClick={() => copyLink(l.key, l.url)}
                  className={`${BTN_SECONDARY_STRONG} h-10`}
                  style={copied === l.key ? { color: SUCCESS, borderColor: BORDER } : undefined}
                >
                  {copied === l.key ? "Copiado" : "Copiar"}
                </button>
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>
              {l.hint}
            </p>
          </div>
        ))}
      </div>
      <p className="rounded-xl px-3.5 py-3 text-[14px] leading-5" style={{ background: TILE, color: INK_MUTED }}>
        <strong style={{ color: INK }}>Pon tu página en la bio de Instagram y como sitio web en tu
        perfil de Google Maps.</strong> Así te encuentran en Google, ven tu menú
        y te piden por WhatsApp — sin pagarle a nadie más.
      </p>
    </SectionCard>
  );
}

/** Sección: título en Lora 17 (+ caption opcional a la derecha). El contenido
 *  va en tarjeta blanca con borde SOLO cuando es un formulario o una lista
 *  (`plain` = filas sueltas, como Horario o Soporte). `id` sirve de ancla
 *  (#equipo desde el Panel). */
function SectionCard({
  label, caption, children, id, plain = false,
}: {
  label: string;
  caption?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  plain?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
          {label}
        </h2>
        {caption ? <span className="shrink-0 text-[13px] leading-4" style={{ color: INK_SOFT }}>{caption}</span> : null}
      </div>
      {plain ? (
        <div>{children}</div>
      ) : (
        <div className="space-y-4 rounded-xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          {children}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium leading-4" style={{ color: INK_MUTED }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Nota bajo un campo: 13px, tinta suave. */
function Hint({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mt-1.5 text-[13px] leading-[18px] ${className}`} style={{ color: INK_SOFT }}>
      {children}
    </p>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text", maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      maxLength={maxLength}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={INPUT_CLS}
    />
  );
}

/** Fila de 48px: título 15 tinta, caption 13, chevron a la derecha y línea
 *  fina entre filas (sin tarjeta por fila). */
function ManageLink({
  href, title, subtitle, last = false, external = false,
}: {
  href: string;
  title: string;
  subtitle: string;
  last?: boolean;
  external?: boolean;
}) {
  const inner = (
    <div
      className="flex min-h-12 items-center gap-3 py-2.5 transition-opacity hover:opacity-75"
      style={last ? {} : { borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>{title}</p>
        <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>{subtitle}</p>
      </div>
      <IconChevron />
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
      <SectionCard label="Descuentos especiales" caption={<Pill bg={TILE} color={INK_MUTED}>Incluido en Pro</Pill>} plain>
        <p className="text-[14px] leading-5" style={{ color: INK_MUTED }}>
          Crea descuentos para tu staff o familia (ej. 50% en bebidas) y asígnalos
          por cliente. La Caja los aplica sola al cobrar.
        </p>
        <Link href="/vendor/plan" className={`${BTN_TERTIARY} mt-2 inline-block`}>
          Ver el plan Pro →
        </Link>
      </SectionCard>
    );
  }

  return (
    <SectionCard label="Descuentos especiales">
      <p className="text-[14px] leading-5" style={{ color: INK_MUTED }}>
        Crea perfiles (Staff, Familia…) y asígnalos por cliente en{" "}
        <Link href="/vendor/clientes" className="font-semibold underline underline-offset-2" style={{ color: LINK }}>
          Clientes
        </Link>
        . La Caja los aplica sola al cobrar; los puntos se calculan
        sobre lo realmente pagado.
      </p>

      {profiles.length === 0 && editingId === null && (
        <div>
          <p className="text-[13px] font-medium leading-4" style={{ color: INK_MUTED }}>
            Empieza con una plantilla:
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => openNew({ name: "Staff", type: "per_category", bebidasPct: 50, alimentosPct: 30, earnsPoints: false })}
              className={`${BTN_SECONDARY} h-12 w-full justify-start`}
            >
              Staff — 50% bebidas · 30% alimentos
            </button>
            <button
              type="button"
              onClick={() => openNew({ name: "Family & Friends", type: "total", totalPct: 15 })}
              className={`${BTN_SECONDARY} h-12 w-full justify-start`}
            >
              Family &amp; Friends — 15% en toda la cuenta
            </button>
          </div>
        </div>
      )}

      {profiles.length > 0 && (
        <div>
          {profiles.map((p, i) => (
            <div
              key={p.id}
              className="flex min-h-12 flex-wrap items-center gap-3 py-2.5"
              style={i > 0 ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-5" style={{ color: INK }}>{p.name}</p>
                <p className="text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>{pctLabel(p)}</p>
              </div>
              {confirmDeleteId === p.id ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDeleteProfile(p.id)}
                    className={`${BTN_DANGER} h-10`}
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className={`${BTN_SECONDARY} h-10`}
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className={`${BTN_SECONDARY} h-10`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(p.id)}
                    aria-label={`Eliminar ${p.name}`}
                    className={`${BTN_TERTIARY} h-10 px-2`}
                    style={{ color: DANGER }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {err && editingId === null && (
        <p className="text-[14px] font-semibold leading-5" style={{ color: DANGER }}>{err}</p>
      )}

      {editingId !== null ? (
        <div className="space-y-4 pt-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>
            {editingId === "new" ? "Nuevo descuento" : "Editar descuento"}
          </p>
          <Field label="Nombre">
            <TextInput value={fName} onChange={(v) => setFName(v)} placeholder="Ej. Staff, Familia" />
          </Field>
          <Field label="Tipo de descuento">
            <div className="flex flex-wrap gap-2">
              <Chip active={fType === "total"} onClick={() => setFType("total")}>
                % en toda la cuenta
              </Chip>
              <Chip active={fType === "per_category"} onClick={() => setFType("per_category")}>
                Por categoría
              </Chip>
            </div>
          </Field>
          {fType === "total" ? (
            <PctInput label="Descuento en toda la cuenta" value={fTotal} onChange={setFTotal} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PctInput label="Bebidas" value={fBebidas} onChange={setFBebidas} />
              <PctInput label="Alimentos" value={fAlimentos} onChange={setFAlimentos} />
            </div>
          )}
          <Field label="¿Junta puntos de lealtad?">
            <div className="flex flex-wrap gap-2">
              <Chip active={fEarnsPoints} onClick={() => setFEarnsPoints(true)}>
                Sí — sobre lo pagado
              </Chip>
              <Chip active={!fEarnsPoints} onClick={() => setFEarnsPoints(false)}>
                No — su beneficio es el descuento
              </Chip>
            </div>
            <Hint>
              Con &quot;No&quot;, sus compras no acumulan puntos ni premio de
              bienvenida (y no gastan tus visitas de lealtad del mes). Su visita
              y gasto sí quedan registrados en Clientes.
            </Hint>
          </Field>
          {highPct && (
            <Notice>
              Más de 50% de descuento — asegúrate de que sea intencional.
            </Notice>
          )}
          {err && (
            <p className="text-[14px] font-semibold leading-5" style={{ color: DANGER }}>{err}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={busy}
              className={`${BTN_PRIMARY} sm:flex-1`}
              style={{ background: INK, color: CREAM }}
            >
              {busy ? "Guardando…" : "Guardar descuento"}
            </button>
            <button
              type="button"
              onClick={() => { setEditingId(null); setErr(null); }}
              disabled={busy}
              className={`${BTN_SECONDARY} h-12`}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openNew()}
          className={`${BTN_SECONDARY_STRONG} h-12 w-full`}
        >
          Nuevo descuento
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
  entitlement,
  entitlements,
  onUnlocked,
}: {
  restaurantId: string;
  staff: PosStaffMember[];
  onStaffChange: (s: PosStaffMember[]) => void;
  /** Cuentas del equipo (members) — solo lectura en web; invitaciones desde la app. */
  accounts: TeamAccountRow[];
  isPro: boolean;
  /** Pared 2 (8-sep): gratis = 1 PIN (el dueño); el 2° es Pro. */
  entitlement: Entitlement | null;
  entitlements: Entitlements;
  onUnlocked: (next: Entitlements, ent: Entitlement) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const canAdd = canAddPosStaff(entitlements, staff.length);

  /** El botón "+ Agregar persona": dentro del plan abre el formulario; fuera,
   * la pared (que arranca la prueba sola si todavía se puede). */
  function requestAdd() {
    setErr(null);
    if (!canAdd) {
      setWallOpen(true);
      return;
    }
    setFormOpen(true);
  }
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
    // Cinturón: el formulario nunca debería estar abierto sin permiso, pero un
    // segundo PIN jamás se guarda desde free (paridad con las rules de la app).
    if (!canAdd) { setWallOpen(true); return; }
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
    <SectionCard label="Equipo" id="equipo">
      <div>
        <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>
          PINs de la Caja
        </p>
        <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>
          Agrega a tu equipo con un PIN de 4 dígitos. En la Caja eligen quién
          cobra con su PIN — cada venta queda registrada a su nombre (sin
          necesidad de cuenta ni correo).
          {entitlements.posStaffAccess
            ? ""
            : " El primer PIN es gratis; el segundo y los que siguen son Pro."}
        </p>
      </div>

      {staff.length > 0 && (
        <div>
          {staff.map((m, i) => (
            <div
              key={m.id}
              className="flex min-h-12 items-center gap-3 py-2.5"
              style={i > 0 ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-5" style={{ color: INK }}>
                  {m.name}
                </p>
                <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>
                  {m.role === "gerente" ? "Gerente" : "Cajero"} · PIN{" "}
                  <span className="font-mono font-bold tabular-nums" style={{ color: INK }}>{showPins ? m.pin : "••••"}</span>
                </p>
              </div>
              {confirmDeleteId === m.id ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(m.id)}
                    className={`${BTN_DANGER} h-10`}
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className={`${BTN_SECONDARY} h-10`}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(m.id)}
                  aria-label={`Eliminar ${m.name}`}
                  className={`${BTN_TERTIARY} h-10 shrink-0 px-2`}
                  style={{ color: DANGER }}
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setShowPins((v) => !v)}
            className={`${BTN_TERTIARY} mt-1`}
          >
            {showPins ? "Ocultar PINs" : "Mostrar PINs"}
          </button>
        </div>
      )}

      {err && !formOpen && (
        <p className="text-[14px] font-semibold leading-5" style={{ color: DANGER }}>{err}</p>
      )}

      {formOpen ? (
        <div className="space-y-4 pt-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>Nueva persona</p>
          <Field label="Nombre">
            <TextInput value={fName} onChange={(v) => setFName(v)} placeholder="Ej. Juan" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="PIN (4 dígitos)">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={fPin}
                onChange={(e) => setFPin(e.target.value.replace(/\D/g, ""))}
                placeholder="0000"
                className={`${INPUT_CLS} text-center font-mono font-bold tracking-[0.3em] tabular-nums`}
              />
            </Field>
            <Field label="Rol">
              <div className="flex gap-2">
                {(["cajero", "gerente"] as PosStaffRole[]).map((r) => (
                  <Chip key={r} active={fRole === r} onClick={() => setFRole(r)} className="flex-1">
                    {r === "cajero" ? "Cajero" : "Gerente"}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
          {err && (
            <p className="text-[14px] font-semibold leading-5" style={{ color: DANGER }}>{err}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              className={`${BTN_PRIMARY} sm:flex-1`}
              style={{ background: INK, color: CREAM }}
            >
              {busy ? "Guardando…" : "Agregar al equipo"}
            </button>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setErr(null); }}
              disabled={busy}
              className={`${BTN_SECONDARY} h-12`}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={requestAdd}
          className={`${BTN_SECONDARY_STRONG} h-12 w-full`}
        >
          {canAdd ? "Agregar persona" : "Agregar persona · Pro"}
        </button>
      )}

      {/* ── Pared 2: el 2° PIN es Pro ── */}
      {wallOpen && entitlement && (
        <ProWall
          wall="posStaff"
          restaurantId={restaurantId}
          entitlement={entitlement}
          onClose={() => setWallOpen(false)}
          onUnlocked={(next, nextEnt) => {
            onUnlocked(next, nextEnt);
            setWallOpen(false);
            setFormOpen(true);
          }}
        />
      )}

      {/* ── Cuentas con acceso propio (Pro) — espejo del hub Equipo de la app ── */}
      <div className="pt-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>
            Cuentas con acceso propio
          </p>
          <Pill bg={TILE} color={INK_MUTED}>Incluido en Pro</Pill>
        </div>
        {isPro ? (
          <>
            <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>
              Cada quien entra con su propia cuenta y su rol desde su teléfono o
              computadora — empleado ve solo la operación; manager también
              clientes y reportes. Las invitaciones se envían desde la app
              (Configuración → Equipo).
            </p>
            {accounts.length > 0 ? (
              <div className="mt-2">
                {accounts.map((m, i) => (
                  <div
                    key={m.id}
                    className="flex min-h-12 items-center gap-3 py-2.5"
                    style={i > 0 ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold leading-5" style={{ color: INK }}>
                        {m.name || m.email || m.id.slice(0, 8)}
                      </p>
                      {m.email && m.name && (
                        <p className="truncate text-[13px] leading-4" style={{ color: INK_SOFT }}>
                          {m.email}
                        </p>
                      )}
                    </div>
                    {m.role === "owner" ? (
                      <Pill bg={INK} color={CREAM}>{TEAM_ROLE_LABEL[m.role]}</Pill>
                    ) : m.status === "active" ? (
                      <Pill bg={TILE} color={INK_MUTED}>{TEAM_ROLE_LABEL[m.role]}</Pill>
                    ) : (
                      <Pill bg={WARN_SURFACE} color={WARN}>{TEAM_ROLE_LABEL[m.role]} · pendiente</Pill>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>
                Aún no has invitado a nadie — invita a tu equipo desde la app.
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>
            Cuentas con acceso propio para tu equipo: cada quien entra con su
            cuenta y su rol desde su propio teléfono — empleado ve solo la
            Caja; manager también clientes y reportes. Todo tu equipo,
            incluido.
          </p>
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
          className={`${INPUT_CLS} w-28 tabular-nums`}
        />
        <span className="text-[15px] font-semibold" style={{ color: INK_MUTED }}>%</span>
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
