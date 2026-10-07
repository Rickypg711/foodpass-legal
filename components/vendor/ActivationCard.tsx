"use client";

/**
 * Activación en tres toques (6-oct-2026).
 *
 * Vive arriba del panel y en la pantalla "listo" que sigue al claim. Un
 * paso visible a la vez, un botón primario que HACE el trabajo (abre
 * WhatsApp con el mensaje escrito, copia el link, abre su menú). Los pasos
 * hechos se colapsan en una línea con palomita. "Lo hago después" es texto,
 * no botón. Cuando los tres están hechos, la tarjeta dice una línea y
 * desaparece sola en la siguiente visita.
 *
 * Señales reales, no palomitas a mano: el paso 3 se marca cuando LLEGA un
 * pedido por el menú (onSnapshot a orders) y suena el mismo ding de Pedidos.
 * Los pasos 1 y 2 se guardan en restaurants.activation.* al tocar (el dueño
 * escribe su propio doc; las reglas lo permiten).
 *
 * Opción A: crema + tinta, Lora solo en el título, naranja solo en el botón
 * principal con tinta encima, sin emojis, sin sombras, sin "¡".
 * Espec y canon: FOODPASS/docs/ACTIVACION_TRES_TOQUES.md.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { buildWhatsappShareUrl } from "@/lib/order/formatWhatsappMessage";
import { slugFromRestaurantData } from "@/lib/slug";
import { flashTabTitle, playNewOrderChime, primeChime } from "@/lib/vendor/newOrderChime";
import {
  activationCurrent, activationLaterActive, activationLaterKey, activationProgressLabel,
  activationPublicLink, activationShareMessage, activationSignalsFromRestaurant, activationSteps,
  isActivationMenuOrder, type ActivationSignals, type ActivationStepKey, type ActivationUtmSource,
} from "@/lib/vendor/activation";

const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_SOFT = "#5B6366";
const HAIRLINE = "#E9E3D7";
const BORDER = "#D9D2C5";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const SUCCESS = "#15803D";

const BTN_PRIMARY =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold text-[#1C2526] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60";
const BTN_SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9D2C5] bg-white px-4 text-[14px] font-semibold text-[#1C2526] transition hover:bg-[#FAF9F5] disabled:opacity-50";

type Props = {
  restaurantId: string;
  /** "done" = pantalla que sigue al claim (siempre se ve, sin "después").
   *  "panel" = arriba del Panel (respeta "Lo hago después" 24 h). */
  variant?: "done" | "panel";
};

type OrderLite = { id: string; orderSource?: unknown; status?: unknown; createdAtMs: number };

export function ActivationCard({ restaurantId, variant = "panel" }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [signals, setSignals] = useState<ActivationSignals>({});
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [linkVisits, setLinkVisits] = useState<{ total: number; whatsapp: number; pegado: number } | null>(null);
  const mountedAt = useRef(0);
  const sawFirstSnapshot = useRef(false);

  // Doc del restaurante: nombre, slug y lo que ya tocó.
  useEffect(() => {
    let alive = true;
    mountedAt.current = Date.now();
    (async () => {
      try {
        if (variant === "panel") {
          const stored = Number(localStorage.getItem(activationLaterKey(restaurantId)) || 0);
          if (activationLaterActive(stored, Date.now())) { if (alive) setHidden(true); return; }
        }
      } catch { /* sin localStorage: se muestra */ }
      const snap = await getDoc(doc(getFirebaseDb(), "restaurants", restaurantId)).catch(() => null);
      if (!alive) return;
      const data = (snap?.data() ?? null) as Record<string, unknown> | null;
      setName(String(data?.name ?? "").trim());
      setSlug(slugFromRestaurantData(data));
      setSignals((prev) => ({ ...activationSignalsFromRestaurant(data, prev.hasMenuOrder === true) }));
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [restaurantId, variant]);

  // La recompensa (6-oct-2026): cuántos abrieron el link que compartió.
  // Lo suma el servidor en private/stats (ver /api/landing-visit); aquí
  // solo se lee, en vivo, para que el dueño vea el número crecer.
  useEffect(() => {
    const ref = doc(getFirebaseDb(), "restaurants", restaurantId, "private", "stats");
    const unsub = onSnapshot(ref, (snap) => {
      const lv = (snap.data()?.linkVisits ?? null) as Record<string, unknown> | null;
      if (!lv) { setLinkVisits(null); return; }
      const n = (k: string) => (typeof lv[k] === "number" ? (lv[k] as number) : 0);
      // "pegado" = lo que copió y pegó en sus redes/Google (perfil + los dos
      // rastros viejos por canal; un link no sabe en cuál red cayó).
      setLinkVisits({ total: n("total"), whatsapp: n("whatsapp"), pegado: n("perfil") + n("instagram") + n("google") });
    }, () => { /* sin permiso: sin número, sin drama */ });
    return () => unsub();
  }, [restaurantId]);

  // ¿Ya existe un pedido por el menú? Se busca por fuente, no por fecha: en
  // un local que cobra mucho en Caja (Suadero, 150 ventas) los últimos
  // pedidos son todos de Caja y el pedido web de hace días no aparecía
  // (cazado el 6-oct con datos reales).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(getFirebaseDb(), "restaurants", restaurantId, "orders"),
          where("orderSource", "in", ["customer_web", "customer_app"]),
          limit(20),
        ));
        const has = snap.docs.some((d) => isActivationMenuOrder(d.data() as Record<string, unknown>));
        if (alive && has) setSignals((prev) => (prev.hasMenuOrder ? prev : { ...prev, hasMenuOrder: true }));
      } catch { /* sin permiso o sin red: se queda como esté */ }
    })();
    return () => { alive = false; };
  }, [restaurantId]);

  // Pedidos recientes: si llega uno nuevo mientras esperamos, marca el paso 3
  // y suena el ding (la misma campana de Pedidos).
  useEffect(() => {
    const q = query(
      collection(getFirebaseDb(), "restaurants", restaurantId, "orders"),
      orderBy("createdAt", "desc"),
      limit(10),
    );
    const unsub = onSnapshot(q, (snap) => {
      const orders: OrderLite[] = snap.docs.map((d) => {
        const o = d.data() as Record<string, unknown>;
        const c = o.createdAt as { toMillis?: () => number } | undefined;
        return { id: d.id, orderSource: o.orderSource, status: o.status, createdAtMs: c?.toMillis?.() ?? 0 };
      });
      const menuOrders = orders.filter(isActivationMenuOrder);
      const fresh = menuOrders.some((o) => o.createdAtMs >= mountedAt.current - 60_000);
      if (menuOrders.length > 0) setSignals((prev) => (prev.hasMenuOrder ? prev : { ...prev, hasMenuOrder: true }));
      if (sawFirstSnapshot.current && fresh) {
        setArrived(true);
        playNewOrderChime();
        flashTabTitle();
      }
      sawFirstSnapshot.current = true;
    }, () => { /* sin permiso o sin red: el paso 3 se queda pendiente */ });
    return () => unsub();
  }, [restaurantId]);

  // El audio se destraba con el primer gesto (política del navegador).
  useEffect(() => {
    if (!waiting) return;
    return primeChime();
  }, [waiting]);

  const steps = useMemo(() => activationSteps(signals), [signals]);
  const current = activationCurrent(steps);
  const allDone = current === null;

  if (hidden || !loaded) return null;
  if (allDone && !arrived) return null;

  const link = (utm: ActivationUtmSource) => activationPublicLink(restaurantId, slug, utm);

  async function stamp(field: "shareTappedAt" | "linkCopiedAt") {
    const key = field;
    setSignals((prev) => ({ ...prev, [key]: Date.now() }));
    try {
      await updateDoc(doc(getFirebaseDb(), "restaurants", restaurantId), { [`activation.${field}`]: serverTimestamp() });
    } catch { /* la señal local ya avanzó; el doc se reintenta en la próxima visita */ }
  }

  function onShare() {
    const url = buildWhatsappShareUrl(activationShareMessage(name, link("whatsapp")));
    window.open(url, "_blank", "noopener,noreferrer");
    void stamp("shareTappedAt");
  }

  async function onCopy() {
    const url = link("perfil");
    try { await navigator.clipboard.writeText(url); } catch { /* el campo de abajo lo deja seleccionar */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    void stamp("linkCopiedAt");
  }

  function onOpenMenu() {
    setWaiting(true);
    window.open(`/menu/${encodeURIComponent(restaurantId)}`, "_blank", "noopener,noreferrer");
  }

  function onLater() {
    try { localStorage.setItem(activationLaterKey(restaurantId), String(Date.now())); } catch { /* nada */ }
    setHidden(true);
  }

  return (
    <section
      aria-label="Para que te pidan"
      className="mb-7 rounded-xl bg-white p-4 md:p-5"
      style={{ border: `1px solid ${BORDER}` }}
      data-activation-card
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
          {allDone ? "Ya te pueden pedir" : "Para que te pidan"}
        </h2>
        <span className="shrink-0 text-[13px] leading-4" style={{ color: INK_SOFT }}>
          {activationProgressLabel(steps)}
        </span>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full" style={{ background: HAIRLINE }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(steps.filter((s) => s.done).length / steps.length) * 100}%`, background: BRAND }} />
      </div>

      <ol className="m-0 list-none p-0">
        {steps.map((st, i) => {
          const isCurrent = st.key === current;
          return (
            <li key={st.key} className={i < steps.length - 1 ? "pb-3" : ""} style={i < steps.length - 1 ? { borderBottom: `1px solid ${HAIRLINE}`, marginBottom: 12 } : undefined}>
              <div className="flex items-start gap-3">
                <StepMark done={st.done} current={isCurrent} index={i} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-5" style={{ color: st.done && !isCurrent ? INK_SOFT : INK }}>
                    {st.title}
                  </p>
                  {isCurrent && (
                    <StepBody
                      step={st.key}
                      copied={copied}
                      waiting={waiting}
                      linkShown={link("perfil")}
                      onShare={onShare}
                      onCopy={onCopy}
                      onOpenMenu={onOpenMenu}
                    />
                  )}
                  {st.key === "share" && st.done && linkVisits && linkVisits.whatsapp > 0 && (
                    <p className="mt-1 text-[14px] leading-5" style={{ color: SUCCESS }}>
                      {visitsLine(linkVisits.whatsapp, "por tu WhatsApp")}
                    </p>
                  )}
                  {st.key === "place" && st.done && linkVisits && linkVisits.pegado > 0 && (
                    <p className="mt-1 text-[14px] leading-5" style={{ color: SUCCESS }}>
                      {visitsLine(linkVisits.pegado, "desde donde lo pegaste")}
                    </p>
                  )}
                  {st.key === "test" && st.done && arrived && (
                    <p className="mt-1 text-[14px] leading-5" style={{ color: SUCCESS }}>
                      Te llegó. Así te va a sonar cada vez que alguien te pida.
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {variant === "panel" && !allDone && (
        <div className="mt-4 text-right">
          <button type="button" onClick={onLater} className="text-[14px] font-semibold hover:underline" style={{ color: LINK }}>
            Lo hago después
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Abre su WhatsApp (ahí pega el link en la info del perfil o en un estado).
 * No hay link directo a ese campo: en el cel abre la app; en escritorio,
 * WhatsApp Web.
 */
function whatsappAppUrl(): string {
  if (typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return "whatsapp://";
  return "https://web.whatsapp.com/";
}

/** "1 persona abrió tu link por tu WhatsApp" / "4 personas abrieron…" */
function visitsLine(n: number, where: string): string {
  return n === 1 ? `1 persona abrió tu link ${where}.` : `${n} personas abrieron tu link ${where}.`;
}

function StepMark({ done, current, index }: { done: boolean; current: boolean; index: number }) {
  if (done) {
    return (
      <span aria-hidden="true" className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: INK, color: "#FAF9F5" }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
      style={current ? { border: `1.5px solid ${INK}`, color: INK } : { border: `1.5px solid ${BORDER}`, color: INK_SOFT }}
    >
      {index}
    </span>
  );
}

function StepBody(p: {
  step: ActivationStepKey;
  copied: boolean;
  waiting: boolean;
  linkShown: string;
  onShare: () => void;
  onCopy: () => void;
  onOpenMenu: () => void;
}) {
  if (p.step === "share") {
    return (
      <div className="mt-2">
        <p className="text-[14px] leading-5" style={{ color: INK_SOFT }}>
          Se abre tu WhatsApp con el mensaje ya escrito y tu link. Tú nada más eliges a quién.
        </p>
        <button type="button" onClick={p.onShare} className={`${BTN_PRIMARY} mt-3`} style={{ background: BRAND }}>
          Mandar por WhatsApp
        </button>
      </div>
    );
  }
  if (p.step === "place") {
    return (
      <div className="mt-2">
        <p className="text-[14px] leading-5" style={{ color: INK_SOFT }}>
          Tu link va en tu Facebook, tu Instagram, tu WhatsApp y tu ficha de Google. Cópialo y pégalo en los cuatro.
        </p>
        <p className="mt-2 truncate rounded-lg px-3 py-2 text-[13px]" style={{ background: "#FAF9F5", color: INK, border: `1px solid ${HAIRLINE}` }}>
          {p.linkShown}
        </p>
        <button type="button" onClick={p.onCopy} className={`${BTN_PRIMARY} mt-3`} style={{ background: BRAND }}>
          {p.copied ? "Copiado" : "Copiar mi link"}
        </button>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href="https://www.facebook.com/pages/?category=your_pages" target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
            Abrir mi Facebook
          </a>
          <a href="https://www.instagram.com/accounts/edit/" target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
            Abrir mi Instagram
          </a>
          <a href={whatsappAppUrl()} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
            Abrir mi WhatsApp
          </a>
          <a href="https://business.google.com/" target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
            Abrir mi ficha de Google
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <p className="text-[14px] leading-5" style={{ color: INK_SOFT }}>
        Abre tu menú, pide algo como si fueras cliente y mira cómo te llega aquí.
      </p>
      <button type="button" onClick={p.onOpenMenu} className={`${BTN_PRIMARY} mt-3`} style={{ background: BRAND }}>
        {p.waiting ? "Abrir mi menú otra vez" : "Abrir mi menú"}
      </button>
      {p.waiting && (
        <p className="mt-2 text-[13px] leading-4" style={{ color: INK_SOFT }}>
          Esperando tu pedido. Deja esta pestaña abierta.
        </p>
      )}
    </div>
  );
}
