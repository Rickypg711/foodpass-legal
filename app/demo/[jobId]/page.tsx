"use client";

// El momento mágico del embudo (§6): el prospecto ve SU menú — sus
// platillos, sus precios, sus tamaños — funcionando como carta digital.
// Se JUEGA completo (demo simulado §6.4: carrito y "pedido" de teatro que
// no escribe nada en ningún lado) y tiene UN solo CTA (§6.7): quedárselo.

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ItemOptionsSheet } from "@/components/menu/ItemOptionsSheet";
import { ActivarModal } from "@/components/home/ActivarModal";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemOptionGroup } from "@/lib/menu/optionGroups";
import type { SelectedOptionGroup } from "@/lib/cart/types";
import {
  daysLeft,
  demoExpired,
  forgetDemoJob,
  stampClaimStarted,
  stampPlayed,
  stampViewed,
  watchDemoJob,
  type DemoItem,
  type DemoJob,
} from "@/lib/demo/demoJobs";
import { ensureAnonymousUser } from "@/lib/auth";

type CartLine = {
  name: string;
  detail: string | null;
  unit: number;
  qty: number;
};

/** "en 3 días" / "mañana" / "HOY" — jamás "en 0 días". */
function borradoLabel(dias: number | null): string | null {
  if (dias === null) return null;
  if (dias <= 0) return "se borra HOY";
  if (dias === 1) return "se borra mañana";
  return `se borra en ${dias} días`;
}

const PROCESSING_LINES = [
  "Leyendo tus platillos…",
  "Anotando tus precios…",
  "Buscando salsas y tamaños…",
  "Acomodando las categorías…",
  "Puliendo tu menú…",
];

export default function DemoPreviewPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params.jobId;

  const [job, setJob] = useState<DemoJob | null | undefined>(undefined);
  const [procLine, setProcLine] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheetItem, setSheetItem] = useState<DemoItem | null>(null);
  const [theater, setTheater] = useState(false);
  const [claiming, setClaiming] = useState(false);
  /** 'on' → 'fading' (600ms de adiós) → 'off'. El hint cumple y se va. */
  const [hint, setHint] = useState<"on" | "fading" | "off">("on");
  const stamped = useRef({ viewed: false, played: false });

  // Auth anónima primero (las reglas piden dueño) y luego observar el job.
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    ensureAnonymousUser()
      .then(() => {
        if (cancelled) return;
        unsub = watchDemoJob(jobId, setJob);
      })
      .catch(() => setJob(null));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [jobId]);

  // Teatro de espera (~60s): líneas rotando.
  useEffect(() => {
    if (job?.status !== "processing" && job !== undefined) return;
    const t = setInterval(
      () => setProcLine((i) => (i + 1) % PROCESSING_LINES.length),
      2400,
    );
    return () => clearInterval(t);
  }, [job]);

  // Escalera (§6.2), first-touch: la PRIMERA vista es la que mide el
  // embudo — si el doc ya trae viewedAt, no se pisa.
  useEffect(() => {
    if (job?.status === "ready" && !stamped.current.viewed) {
      stamped.current.viewed = true;
      if (!(job as unknown as { viewedAt?: unknown }).viewedAt) stampViewed(jobId);
    }
  }, [job, jobId]);

  // Un demo muerto no merece botón de "continúa": si falló, expiró o ya se
  // convirtió, el localStorage lo suelta y /demo vuelve a ofrecer subir.
  useEffect(() => {
    if (!job) return;
    const exp = job.expiresAt ? demoExpired(job.expiresAt.toMillis(), Date.now()) : false;
    if (job.status === "failed" || exp) forgetDemoJob();
  }, [job]);

  const expiresMs = job?.expiresAt ? job.expiresAt.toMillis() : null;
  const expired = demoExpired(expiresMs, Date.now());
  const dias = daysLeft(expiresMs, Date.now());

  const categories = useMemo(() => {
    const items = job?.items ?? [];
    const by = new Map<string, DemoItem[]>();
    for (const it of items) {
      const c = (it.category || "Platillos").trim() || "Platillos";
      if (!by.has(c)) by.set(c, []);
      by.get(c)!.push(it);
    }
    return Array.from(by.entries());
  }, [job]);

  const total = cart.reduce((s, l) => s + l.unit * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  function addLine(item: DemoItem, selected: SelectedOptionGroup[] | null) {
    if (hint === "on") {
      setHint("fading");
      setTimeout(() => setHint("off"), 650);
    }
    if (!stamped.current.played) {
      stamped.current.played = true;
      if (!(job as unknown as { playedDemoAt?: unknown })?.playedDemoAt) stampPlayed(jobId);
    }
    const delta = (selected ?? []).reduce(
      (s, g) => s + g.options.reduce((x, o) => x + o.priceDelta, 0),
      0,
    );
    const detail = (selected ?? [])
      .map((g) => g.options.map((o) => o.name).join(", "))
      .filter(Boolean)
      .join(" · ") || null;
    const key = `${item.name}|${detail ?? ""}`;
    setCart((prev) => {
      const i = prev.findIndex((l) => `${l.name}|${l.detail ?? ""}` === key);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { name: item.name, detail, unit: item.price + delta, qty: 1 }];
    });
  }

  // El teatro sin líneas no tiene función: se cierra solo.
  useEffect(() => {
    if (theater && cart.length === 0) setTheater(false);
  }, [theater, cart.length]);

  function qtyFor(name: string): number {
    return cart.reduce((s, l) => (l.name === name ? s + l.qty : s), 0);
  }

  function removeOneOf(name: string) {
    setCart((prev) => {
      const i = [...prev].map((l) => l.name).lastIndexOf(name);
      if (i < 0) return prev;
      const next = [...prev];
      if (next[i].qty > 1) {
        next[i] = { ...next[i], qty: next[i].qty - 1 };
      } else {
        next.splice(i, 1);
      }
      return next;
    });
  }

  function removeLine(index: number) {
    setCart((prev) => {
      const next = [...prev];
      if (next[index].qty > 1) {
        next[index] = { ...next[index], qty: next[index].qty - 1 };
        return next;
      }
      next.splice(index, 1);
      return next;
    });
  }

  function openClaim() {
    stampClaimStarted(jobId);
    setClaiming(true);
  }

  // ── Estados no-listos ────────────────────────────────────────────────────
  if (job === undefined) {
    return <Shell><p className="text-center text-[14px] opacity-60">Cargando…</p></Shell>;
  }
  if (job === null) {
    return (
      <Shell>
        <p className="text-4xl text-center">🤷</p>
        <h1 className="mt-3 text-center text-[20px] font-extrabold" style={{ color: "#1C2526" }}>
          Este demo no está disponible aquí
        </h1>
        <p className="mt-2 text-center text-[13px]" style={{ color: "rgba(28,37,38,0.55)" }}>
          Los demos viven en el dispositivo donde se crearon. Sube tu menú de
          nuevo — toma 1 minuto.
        </p>
        <CtaButton onClick={() => router.push("/demo")}>📸 Subir mi menú</CtaButton>
      </Shell>
    );
  }
  if (job.convertedToRestaurantId) {
    return (
      <Shell>
        <p className="text-4xl text-center">🎉</p>
        <h1 className="mt-3 text-center text-[20px] font-extrabold" style={{ color: "#1C2526" }}>
          Este menú ya está ACTIVO
        </h1>
        <p className="mt-2 text-center text-[13px]" style={{ color: "rgba(28,37,38,0.55)" }}>
          Ya no es un demo — es tu menú de verdad.
        </p>
        <CtaButton onClick={() => router.push("/vendor")}>Ir a mi panel →</CtaButton>
      </Shell>
    );
  }
  if (expired) {
    return (
      <Shell>
        <p className="text-4xl text-center">⏳</p>
        <h1 className="mt-3 text-center text-[20px] font-extrabold" style={{ color: "#1C2526" }}>
          Tu vista previa expiró
        </h1>
        <p className="mt-2 text-center text-[13px]" style={{ color: "rgba(28,37,38,0.55)" }}>
          Los demos viven 7 días. Tu menú sigue ahí — súbelo de nuevo en 1 minuto.
        </p>
        <CtaButton onClick={() => router.push("/demo")}>📸 Subirlo de nuevo</CtaButton>
      </Shell>
    );
  }
  if (job.status === "failed") {
    return (
      <Shell>
        <p className="text-4xl text-center">😵</p>
        <h1 className="mt-3 text-center text-[20px] font-extrabold" style={{ color: "#1C2526" }}>
          No pude leer esa foto
        </h1>
        <p className="mt-2 text-center text-[13px]" style={{ color: "rgba(28,37,38,0.55)" }}>
          {job.errorMessage === "rate_limited"
            ? "Ya usaste tus 3 demos de hoy — vuelve mañana."
            : "Prueba con una foto más clara, donde se lean los precios."}
        </p>
        <CtaButton onClick={() => router.push("/demo")}>📸 Intentar de nuevo</CtaButton>
      </Shell>
    );
  }
  if (job.status === "processing") {
    // Rescate: si el pipeline se colgó sin marcar error, a los ~4 min se le
    // ofrece la salida en vez de un spinner eterno.
    const createdMs = (job as unknown as { createdAt?: { toMillis?: () => number } })
      .createdAt?.toMillis?.() ?? Date.now();
    const stuck = Date.now() - createdMs > 4 * 60 * 1000;
    return (
      <Shell>
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-[#F28C38]/25 border-t-[#F28C38]" />
        <h1 className="mt-5 text-center text-[20px] font-extrabold" style={{ color: "#1C2526" }}>
          Armando tu menú digital…
        </h1>
        <p className="mt-2 text-center text-[14px]" style={{ color: "#B45309" }}>
          {PROCESSING_LINES[procLine]}
        </p>
        <p className="mt-4 text-center text-[12px]" style={{ color: "rgba(28,37,38,0.4)" }}>
          ~1 minuto · no cierres esta página
        </p>
        {stuck && (
          <>
            <p className="mt-6 text-center text-[13px] font-semibold" style={{ color: "#B45309" }}>
              Esto está tardando más de lo normal…
            </p>
            <CtaButton onClick={() => { forgetDemoJob(); router.push("/demo"); }}>
              📸 Intentar de nuevo
            </CtaButton>
          </>
        )}
      </Shell>
    );
  }

  // ── LISTO: el aparador ───────────────────────────────────────────────────
  const nombre = job.info?.restaurantName || "Tu restaurante";
  return (
    <main className="min-h-screen pb-44" style={{ background: "#faf9f5" }}>
      {/* Banner de vista previa — §6.7: el demo se ve, no opera. */}
      <div className="sticky top-0 z-40 px-4 py-2 text-center text-[12px] font-bold"
        style={{ background: "#1C2526", color: "#fff" }}>
        ⏳ VISTA PREVIA — aún no activo
        {borradoLabel(dias) && <span style={{ color: "#F8B26A" }}> · {borradoLabel(dias)}</span>}
      </div>

      <header className="px-5 pt-6 pb-4" style={{ background: "#1C2526" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.4)" }}>
          Así se vería tu menú
        </p>
        <h1 className="mt-1 text-[26px] font-extrabold text-white">{nombre}</h1>
        {job.stats && (
          <p className="mt-1.5 text-[12px] font-semibold" style={{ color: "rgba(248,178,106,0.9)" }}>
            ✨ {job.stats.itemCount} platillo{job.stats.itemCount === 1 ? "" : "s"}
            {job.stats.sizeFamilies > 0 &&
              ` y ${job.stats.sizeFamilies} con tamaños`} — leídos de tu foto{" "}
            <span style={{ color: "rgba(255,255,255,0.35)" }}>
              (esta nota es solo para ti, no sale en tu menú)
            </span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {job.info?.hoursText && (
            <span className="rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
              📆 {job.info.hoursText}
            </span>
          )}
          {job.info?.address && (
            <span className="rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
              📍 {job.info.address}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4">
        {hint !== "off" && (
          <p className={`mt-4 rounded-xl px-4 py-2.5 text-center text-[13px] font-bold transition-opacity duration-500 ${hint === "fading" ? "opacity-0" : "opacity-100"}`}
            style={{ background: "rgba(242,140,56,0.1)", color: "#B45309" }}>
            👆 Pruébalo como lo vería tu cliente — toca un ➕
          </p>
        )}
        {categories.map(([cat, items]) => (
          <section key={cat} className="mt-6">
            <h2 className="border-l-4 pl-2 text-[15px] font-extrabold"
              style={{ borderColor: "#F28C38", color: "#1C2526" }}>
              {cat}
            </h2>
            <div className="mt-2 flex flex-col gap-2.5">
              {items.map((it, i) => (
                <div key={`${it.name}-${i}`}
                  className="rounded-2xl bg-white p-4 shadow-sm"
                  style={{ border: "1px solid rgba(28,37,38,0.06)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold" style={{ color: "#1C2526" }}>{it.name}</p>
                      {(it.optionGroups?.length ?? 0) > 0 && (
                        <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: "rgba(242,140,56,0.12)", color: "#B45309" }}>
                          Elige {it.optionGroups![0].name.toLowerCase()}
                        </span>
                      )}
                      {it.description && (
                        <p className="mt-1 text-[12px] leading-snug" style={{ color: "rgba(28,37,38,0.5)" }}>
                          {it.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p className="text-[15px] font-extrabold" style={{ color: "#1C2526" }}>
                        {formatPrice(it.price)}
                      </p>
                      {qtyFor(it.name) > 0 ? (
                        <div className="flex items-center gap-0.5 rounded-xl"
                          style={{ background: "rgba(28,37,38,0.06)" }}>
                          <button
                            type="button"
                            aria-label={`Quitar uno de ${it.name}`}
                            onClick={() => removeOneOf(it.name)}
                            className="flex h-9 w-8 items-center justify-center rounded-l-xl text-lg font-bold transition-transform duration-150 active:scale-90"
                            style={{ color: "#1C2526" }}
                          >
                            −
                          </button>
                          <span className="min-w-[1.25rem] text-center text-[14px] font-extrabold"
                            style={{ color: "#1C2526" }}>
                            {qtyFor(it.name)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Agregar ${it.name}`}
                            onClick={() =>
                              (it.optionGroups?.length ?? 0) > 0 ? setSheetItem(it) : addLine(it, null)
                            }
                            className="flex h-9 w-8 items-center justify-center rounded-r-xl text-lg font-bold transition-transform duration-150 active:scale-90"
                            style={{ background: "#F28C38", color: "#1C2526" }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Agregar ${it.name}`}
                          onClick={() =>
                            (it.optionGroups?.length ?? 0) > 0 ? setSheetItem(it) : addLine(it, null)
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold transition-transform duration-150 active:scale-90"
                          style={{ background: "#F28C38", color: "#1C2526" }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-8 text-center text-[12px] font-semibold" style={{ color: "rgba(28,37,38,0.55)" }}>
          ✏️ ¿Un precio mal leído, un platillo que falta, o quieres fotos de
          tus platillos? Todo se edita y se agrega desde tu panel — gratis.
        </p>
        <p className="mt-2 text-center text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
          Vista previa generada de tu foto · los pedidos de aquí son de mentira 🎭
        </p>
      </div>

      {/* Hoja de opciones — LA MISMA del menú real. */}
      {sheetItem && (
        <ItemOptionsSheet
          open
          itemName={sheetItem.name}
          basePrice={sheetItem.price}
          groups={(sheetItem.optionGroups ?? []) as MenuItemOptionGroup[]}
          onCancel={() => setSheetItem(null)}
          onConfirm={(selected) => {
            addLine(sheetItem, selected);
            setSheetItem(null);
          }}
        />
      )}

      {/* Barra inferior: carrito de teatro + EL CTA (§6.7: uno solo). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 pb-4 pt-3"
        style={{ borderColor: "rgba(28,37,38,0.08)" }}>
        <div className="mx-auto w-full max-w-md">
          {count > 0 && (
            <button
              key={count}
              type="button"
              onClick={() => setTheater(true)}
              className="animate-cart-pop mb-2 flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-bold"
              style={{ background: "rgba(28,37,38,0.05)", color: "#1C2526" }}
            >
              <span>🛒 {count} artículo{count > 1 ? "s" : ""} · {formatPrice(total)}</span>
              <span style={{ color: "#B45309" }}>Ordenar (demo) ›</span>
            </button>
          )}
          <button
            type="button"
            onClick={openClaim}
            className="w-full rounded-2xl px-5 py-4 text-[16px] font-extrabold"
            style={{ background: "#F28C38", color: "#1C2526" }}
          >
            💛 Es tuyo. Quédatelo gratis →
          </button>
          <p className="mt-1.5 text-center text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
            {borradoLabel(dias) ? `Tu vista previa ${borradoLabel(dias)} · ` : ""}
            Gratis · Sin tarjeta · Sin contrato
          </p>
        </div>
      </div>

      {/* 🎭 El teatro (§6.4): la experiencia del cliente Y la pantalla del
          dueño — doble venta. Nada se escribe en ningún lado. */}
      {theater && cart.length > 0 && (
        <div className="animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setTheater(false)}>
          <div className="animate-sheet-up relative w-full max-w-md rounded-3xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setTheater(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-bold transition-transform duration-150 active:scale-90"
              style={{ background: "rgba(28,37,38,0.06)", color: "rgba(28,37,38,0.55)" }}
            >
              ✕
            </button>
            <p className="text-center text-[22px]">🎭</p>
            <h3 className="mt-1 text-center text-[17px] font-extrabold" style={{ color: "#1C2526" }}>
              Así ordenaría tu cliente
            </h3>
            <div className="mt-3 rounded-2xl p-4" style={{ background: "rgba(28,37,38,0.04)" }}>
              {cart.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[13px]" style={{ color: "#1C2526" }}>
                  <span className="min-w-0">{l.qty}× {l.name}{l.detail ? ` · ${l.detail}` : ""}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-bold">{formatPrice(l.unit * l.qty)}</span>
                    <button type="button" aria-label={`Quitar ${l.name}`}
                      onClick={() => removeLine(i)}
                      className="rounded-md px-1.5 text-[12px] font-bold"
                      style={{ color: "rgba(28,37,38,0.4)" }}>
                      ✕
                    </button>
                  </span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t pt-2 text-[14px] font-extrabold"
                style={{ borderColor: "rgba(28,37,38,0.1)", color: "#1C2526" }}>
                <span>Total</span><span>{formatPrice(total)}</span>
              </div>
              <p className="mt-2 text-center text-[12px] font-bold" style={{ color: "#16A34A" }}>
                ✓ Pedido enviado a la cocina — sin filas, sin gritar al mesero
              </p>
              <p className="mt-1 text-center text-[12px] font-bold" style={{ color: "#B45309" }}>
                ⭐ Y con este pedido tu cliente ya sumó puntos — su razón
                para volver
              </p>
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: "rgba(28,37,38,0.4)" }}>
              Y así lo verías TÚ:
            </p>
            <div className="mt-1.5 rounded-2xl border p-3"
              style={{ borderColor: "rgba(242,140,56,0.4)", background: "#fff8f2" }}>
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-extrabold" style={{ color: "#1C2526" }}>
                  🔔 Pedido nuevo · #DEMO
                </p>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: "rgba(242,140,56,0.15)", color: "#B45309" }}>
                  Pendiente
                </span>
              </div>
              <p className="mt-1 text-[12px]" style={{ color: "rgba(28,37,38,0.6)" }}>
                {cart.map((l) => `${l.qty}× ${l.name}`).join(" · ")} — {formatPrice(total)}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                En tu menú real esto te suena en tu panel — y tu cliente te lo
                puede confirmar a tu WhatsApp 📲
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setTheater(false); openClaim(); }}
              className="mt-4 w-full rounded-2xl px-5 py-3.5 text-[15px] font-extrabold transition-transform duration-150 active:scale-[0.98]"
              style={{ background: "#F28C38", color: "#1C2526" }}
            >
              Quiero esto en mi restaurante →
            </button>
            <button
              type="button"
              onClick={() => setTheater(false)}
              className="mt-2 w-full text-center text-[13px] font-semibold underline-offset-2 hover:underline"
              style={{ color: "rgba(28,37,38,0.45)" }}
            >
              Seguir viendo mi menú
            </button>
          </div>
        </div>
      )}

      {/* El quiero (§6.5): Google 2 taps o correo — la cuenta nace vestida. */}
      {claiming && (
        <ActivarModal
          onClose={() => setClaiming(false)}
          demo={{
            jobId,
            items: job.items ?? [],
            info: job.info ?? null,
            whatsapp: job.whatsapp ?? null,
          }}
        />
      )}
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6" style={{ background: "#faf9f5" }}>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

function CtaButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 w-full rounded-2xl px-5 py-3.5 text-[15px] font-extrabold"
      style={{ background: "#F28C38", color: "#1C2526" }}
    >
      {children}
    </button>
  );
}
