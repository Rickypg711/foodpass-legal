"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext, type VendorRole } from "@/lib/vendorContext";
import { parsePosStaff, findStaffByPin, type PosStaffMember, type SoldBy } from "@/lib/posStaff";
import { isCajaModeLocked, setCajaModeLocked } from "@/lib/cajaMode";
import { creditPhonePointsForOrder } from "@/lib/loyalty/phonePoints";
import {
  PosRedemption,
  type PosRedemptionSelection,
} from "@/components/loyalty/PosRedemption";
import {
  computeDiscount,
  type DiscountProfile,
} from "@/lib/loyalty/discountProfiles";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

type PaymentMethod = "cash" | "card";
type CheckoutMode = "now" | "tab";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      style={{ width: size, height: size, color: "#F28C38" }}
      className="animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

function MenuCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="group relative flex flex-col overflow-hidden rounded-2xl text-left transition-all duration-150 active:scale-[0.97] hover:shadow-md"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(28,37,38,0.07)",
        boxShadow: "0 1px 3px rgba(28,37,38,0.06)",
      }}
    >
      {/* Image or color block */}
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.name}
          className="h-24 w-full object-cover"
        />
      ) : (
        <div
          className="flex h-20 w-full items-center justify-center text-3xl"
          style={{ background: "rgba(217,119,87,0.06)" }}
        >
          🍽️
        </div>
      )}

      <div className="flex flex-1 flex-col p-3">
        <p
          className="text-[13px] font-semibold leading-tight line-clamp-2"
          style={{ color: "#1C2526" }}
        >
          {item.name}
        </p>
        {item.description && (
          <p
            className="mt-0.5 text-[11px] leading-snug line-clamp-1"
            style={{ color: "rgba(28,37,38,0.45)" }}
          >
            {item.description}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between pt-2">
          <p className="text-[14px] font-bold" style={{ color: "#F28C38" }}>
            {fmt(item.price)}
          </p>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-xl text-[18px] font-bold text-white transition-transform group-hover:scale-110"
            style={{ background: "#F28C38", lineHeight: 1 }}
          >
            +
          </span>
        </div>
      </div>
    </button>
  );
}

function CartRow({
  cartItem,
  index,
  onIncrement,
  onDecrement,
}: {
  cartItem: CartItem;
  index: number;
  onIncrement: (i: number) => void;
  onDecrement: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(28,37,38,0.05)" }}>
      <div className="flex-1 min-w-0">
        <p className="truncate text-[13px] font-semibold" style={{ color: "#1C2526" }}>
          {cartItem.menuItem.name}
        </p>
        <p className="text-[12px]" style={{ color: "rgba(28,37,38,0.45)" }}>
          {fmt(cartItem.menuItem.price)} c/u
        </p>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onDecrement(index)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px] font-bold transition-colors hover:bg-red-50"
          style={{ background: "rgba(28,37,38,0.06)", color: "#1C2526" }}
        >
          −
        </button>
        <span className="w-5 text-center text-[13px] font-bold" style={{ color: "#1C2526" }}>
          {cartItem.quantity}
        </span>
        <button
          onClick={() => onIncrement(index)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px] font-bold transition-colors"
          style={{ background: "rgba(217,119,87,0.12)", color: "#F28C38" }}
        >
          +
        </button>
      </div>

      <p className="w-16 text-right text-[13px] font-bold" style={{ color: "#1C2526" }}>
        {fmt(cartItem.menuItem.price * cartItem.quantity)}
      </p>
    </div>
  );
}

// ─── Checkout Dialog ───────────────────────────────────────────────────────────

// ─── ¿Quién cobra? — switcher del equipo de la caja (PIN, estilo Square) ─────
// El dispositivo queda logueado como el venue; cada persona teclea su PIN de
// 4 dígitos para "tomar la caja". Cada venta se estampa con soldBy.

function SellerPinDialog({
  open,
  roster,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  roster: PosStaffMember[];
  current: SoldBy | null;
  onClose: () => void;
  onPick: (seller: SoldBy | null) => void;
}) {
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);

  useEffect(() => {
    if (open) { setPin(""); setBad(false); }
  }, [open]);

  useEffect(() => {
    if (pin.length !== 4) return;
    const m = findStaffByPin(roster, pin);
    if (m) {
      onPick({ staffId: m.id, name: m.name });
    } else {
      setBad(true);
      setPin("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(28,37,38,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[16px] font-extrabold" style={{ color: "#1C2526" }}>
          👤 ¿Quién cobra?
        </p>
        <p className="mt-1 text-[12px]" style={{ color: "rgba(28,37,38,0.45)" }}>
          Teclea tu PIN de 4 dígitos — las ventas quedan a tu nombre.
        </p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ""));
            if (bad) setBad(false);
          }}
          placeholder="••••"
          className="mt-4 w-full rounded-2xl px-4 py-3.5 text-center font-mono text-[24px] font-black tracking-[0.5em] outline-none"
          style={{
            background: "#F5F3EF",
            border: bad ? "2px solid #EF4444" : "2px solid rgba(28,37,38,0.12)",
            color: "#1C2526",
          }}
        />
        {bad && (
          <p className="mt-2 text-center text-[12px] font-semibold" style={{ color: "#dc2626" }}>
            PIN incorrecto — intenta de nuevo
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {roster.filter((m) => m.active).map((m) => (
            <span
              key={m.id}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={
                current?.staffId === m.id
                  ? { background: "rgba(242,140,56,0.15)", color: "#F28C38" }
                  : { background: "rgba(28,37,38,0.06)", color: "rgba(28,37,38,0.55)" }
              }
            >
              {current?.staffId === m.id ? "✓ " : ""}{m.name}
            </span>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {current && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-bold"
              style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}
            >
              Quitar vendedor
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-semibold"
            style={{ background: "rgba(28,37,38,0.06)", color: "rgba(28,37,38,0.6)" }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutDialog({
  total,
  restaurantId,
  onClose,
  cartLines,
  onConfirm,
  processing,
  canAssignDiscount = true,
}: {
  total: number;
  cartLines: { price: number; quantity: number; categoryName?: string }[];
  restaurantId: string;
  onClose: () => void;
  /** Owner-only: asignar descuentos especiales desde la caja. */
  canAssignDiscount?: boolean;
  onConfirm: (
    mode: CheckoutMode,
    method: PaymentMethod,
    name: string,
    phone: string,
    notes: string,
    redemption: PosRedemptionSelection | null,
    discount: DiscountProfile | null,
    tip: number,
  ) => void;
  processing: boolean;
}) {
  const [mode, setMode] = useState<CheckoutMode>("now");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [redemption, setRedemption] = useState<PosRedemptionSelection | null>(null);
  const [discountProfile, setDiscountProfile] = useState<DiscountProfile | null>(null);
  const [showNote, setShowNote] = useState(false);
  /** Propina (pedida por Pecado Escondido): % rápido sobre el total YA con
   * descuento, o monto libre. NUNCA suma puntos ni comisión — vive en
   * order.tipAmount, separada de total. */
  const [tipPct, setTipPct] = useState<number | null>(null);
  const [tipCustom, setTipCustom] = useState<number | "">("");

  // No cart total = pure reward redemption ("Canjear premio sin venta").
  // There's nothing to charge, so we hide the payment flow and speak "canje",
  // not "cobro".
  const isRedeemOnly = total <= 0;

  // Special discount (Pro): owner-assigned profile detected by phone lookup.
  // Same computeDiscount the order will use — display and charge can't drift.
  const discountRes =
    discountProfile && total > 0 ? computeDiscount(cartLines, discountProfile) : null;
  const effTotal = Math.max(0, total - (discountRes?.amount ?? 0));
  const tipAmount =
    tipCustom !== "" && Number(tipCustom) > 0
      ? Math.round(Number(tipCustom) * 100) / 100
      : tipPct
        ? Math.round(effTotal * tipPct) / 100
        : 0;
  const grandTotal = effTotal + tipAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" style={{ background: "rgba(28,37,38,0.45)", backdropFilter: "blur(4px)" }}>
      <div
        className="w-full rounded-t-3xl md:w-[440px] md:rounded-3xl overflow-hidden"
        style={{ background: "#ffffff", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(28,37,38,0.07)" }}>
          <div>
            <p className="text-[18px] font-extrabold" style={{ color: "#1C2526" }}>{isRedeemOnly ? "Canjear premio" : "Cobrar"}</p>
            <p className="text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>{isRedeemOnly ? "Sin venta — solo entregar premio" : (discountRes && discountRes.amount > 0 ? `Total: ${fmt(effTotal)} · 🏷️ desc. ${fmt(discountRes.amount)}${tipAmount > 0 ? ` · 💵 propina ${fmt(tipAmount)}` : ""}` : tipAmount > 0 ? `Total: ${fmt(total)} · 💵 propina ${fmt(tipAmount)}` : `Total: ${fmt(total)}`)}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[18px]"
            style={{ background: "rgba(28,37,38,0.06)", color: "#1C2526" }}
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mode selector — irrelevant for a $0 reward handoff */}
          {!isRedeemOnly && (
          <div>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.4)" }}>¿Cómo cobrar?</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "now", emoji: "⚡", label: "Cobrar ahora", sub: "Efectivo o tarjeta" },
                { key: "tab", emoji: "📋", label: "Cuenta abierta", sub: "Cobrar después" },
              ] as { key: CheckoutMode; emoji: string; label: string; sub: string }[]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl p-4 transition-all"
                  style={
                    mode === opt.key
                      ? { background: "rgba(217,119,87,0.1)", border: "2px solid #F28C38" }
                      : { background: "#F5F3EF", border: "2px solid transparent" }
                  }
                >
                  <span className="text-[22px]">{opt.emoji}</span>
                  <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>{opt.label}</p>
                  <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Payment method — only when actually charging money */}
          {mode === "now" && !isRedeemOnly && (
            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.4)" }}>Método de pago</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "cash", emoji: "💵", label: "Efectivo" },
                  { key: "card", emoji: "💳", label: "Tarjeta" },
                ] as { key: PaymentMethod; emoji: string; label: string }[]).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className="flex items-center gap-2.5 rounded-xl px-4 py-3 transition-all"
                    style={
                      method === m.key
                        ? { background: "rgba(217,119,87,0.1)", border: "2px solid #F28C38" }
                        : { background: "#F5F3EF", border: "2px solid transparent" }
                    }
                  >
                    <span className="text-[18px]">{m.emoji}</span>
                    <span className="text-[13px] font-bold" style={{ color: "#1C2526" }}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer phone → rewards → name → notes.
              Phone is first: it's the loyalty identifier that pulls up points. */}
          <div className="space-y-3">
            <div>
              <label className="block mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.4)" }}>
                📱 Teléfono del cliente {isRedeemOnly ? "(requerido para canjear)" : "(opcional)"}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Para sus puntos — 614 123 4567"
                maxLength={16}
                className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none"
                style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.1)", color: "#1C2526" }}
              />
              <p className="mt-1 text-[10px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                Junta puntos automáticamente — y si el número tiene descuento
                asignado (staff/familia), se aplica solo. ⭐ Al darlo acepta el{" "}
                <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline">
                  Aviso de Privacidad
                </a>.
              </p>
            </div>

            {/* Redemption: balance + unlocked rewards for the typed phone.
                Selecting one asks for the customer's código de canje. */}
            <PosRedemption
              restaurantId={restaurantId}
              phoneDigits={phone}
              onSelect={setRedemption}
              onCustomerName={(n) => setName((prev) => (prev.trim() ? prev : n))}
              onDiscount={setDiscountProfile}
              canAssignDiscount={canAssignDiscount}
            />
            <div>
              <label className="block mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.4)" }}>
                {mode === "tab" ? "Nombre de la cuenta (requerido)" : "Nombre del cliente (opcional)"}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === "tab" ? "Mesa 3, Juan..." : "Para el ticket"}
                className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none"
                style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.1)", color: "#1C2526" }}
              />
            </div>
            {/* Notes: collapsed behind a link during a $0 canje so the fast
                lane stays clean, but the kitchen note is one tap away (the free
                premio still rides to the kitchen as a $0 line). */}
            {isRedeemOnly && !showNote ? (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="text-[12px] font-semibold"
                style={{ color: "rgba(28,37,38,0.45)" }}
              >
                ➕ Nota para cocina
              </button>
            ) : (
              <div>
                <label className="block mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.4)" }}>Notas (opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Sin cebolla, extra salsa..."
                  className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none"
                  style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.1)", color: "#1C2526" }}
                  autoFocus={isRedeemOnly}
                />
              </div>
            )}
          </div>

          {/* ── Propina (opcional, solo al cobrar ahora) ── */}
          {mode === "now" && !isRedeemOnly && (
            <div>
              <label className="block mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.4)" }}>
                💵 Propina (opcional)
              </label>
              <div className="flex items-center gap-1.5">
                {[10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setTipCustom("");
                      setTipPct((cur) => (cur === pct ? null : pct));
                    }}
                    className="flex-1 rounded-xl px-2 py-2.5 text-[13px] font-bold transition-all"
                    style={
                      tipPct === pct && tipCustom === ""
                        ? { background: "#16A34A", color: "#fff", border: "1.5px solid #16A34A" }
                        : { background: "#F5F3EF", color: "rgba(28,37,38,0.6)", border: "1.5px solid rgba(28,37,38,0.1)" }
                    }
                  >
                    {pct}%
                  </button>
                ))}
                <div className="flex flex-1 items-center gap-1 rounded-xl px-2" style={{ background: "#F5F3EF", border: "1.5px solid rgba(28,37,38,0.1)" }}>
                  <span className="text-[13px] font-semibold" style={{ color: "rgba(28,37,38,0.4)" }}>$</span>
                  <input
                    type="number"
                    min={0}
                    value={tipCustom}
                    placeholder="otra"
                    onChange={(e) => {
                      setTipPct(null);
                      setTipCustom(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)));
                    }}
                    className="w-full bg-transparent py-2.5 text-[13px] font-bold outline-none"
                    style={{ color: "#1C2526" }}
                  />
                </div>
              </div>
              {tipAmount > 0 && (
                <p className="mt-1.5 text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>
                  La propina no suma puntos de lealtad — va aparte, íntegra para el equipo.
                </p>
              )}
            </div>
          )}

          {/* Confirm */}
          {redemption ? (
            <p className="text-center text-[12px] font-bold" style={{ color: "#16A34A" }}>
              🎁 Incluye: {redemption.name} GRATIS
              {redemption.points > 0 ? ` (−${redemption.points} pts)` : " (bienvenida)"}
            </p>
          ) : null}
          <button
            onClick={() => onConfirm(mode, method, name, phone, notes, redemption, discountProfile, mode === "now" ? tipAmount : 0)}
            disabled={
              processing ||
              (mode === "tab" && !name.trim()) ||
              (total <= 0 && !redemption)
            }
            className="w-full rounded-2xl py-4 text-[15px] font-extrabold text-white transition-opacity disabled:opacity-40"
            style={{ background: mode === "now" ? "linear-gradient(135deg, #F28C38 0%, #FF9A45 100%)" : "#1C2526" }}
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size={16} />
                Procesando…
              </span>
            ) : mode === "now" ? (
              isRedeemOnly
                ? (redemption ? "Entregar premio ✓" : "Elige un premio para canjear ↑")
                : `Cobrar ${fmt(grandTotal)}`
            ) : (
              `Abrir cuenta — ${fmt(effTotal)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success overlay ───────────────────────────────────────────────────────────

function SuccessOverlay({ mode, total, capReached, onDone }: { mode: CheckoutMode; total: number; capReached?: boolean; onDone: () => void }) {
  useEffect(() => {
    // Give the owner time to read the cap warning when it's shown.
    const t = setTimeout(onDone, capReached ? 5000 : 2000);
    return () => clearTimeout(t);
  }, [onDone, capReached]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(28,37,38,0.55)", backdropFilter: "blur(6px)" }}>
      <div
        className="flex max-w-sm flex-col items-center gap-4 rounded-3xl px-10 py-10 text-center"
        style={{ background: "#ffffff", boxShadow: "0 24px 64px rgba(28,37,38,0.2)" }}
      >
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-[40px]"
          style={{ background: mode === "now" ? "rgba(217,119,87,0.12)" : "rgba(28,37,38,0.07)" }}
        >
          {mode === "now" ? "✅" : "📋"}
        </div>
        <p className="text-[22px] font-extrabold" style={{ color: "#1C2526" }}>
          {mode === "now" ? "¡Cobrado!" : "Cuenta abierta"}
        </p>
        <p className="text-[15px] font-bold" style={{ color: "#F28C38" }}>{fmt(total)}</p>
        <p className="text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>
          {mode === "now" ? "Orden enviada a cocina" : "La cuenta está activa"}
        </p>
        {capReached && (
          <div
            className="rounded-2xl px-4 py-3 text-left"
            style={{ background: "rgba(242,140,56,0.1)", border: "1px solid rgba(242,140,56,0.3)" }}
          >
            <p className="text-[13px] font-bold" style={{ color: "#F28C38" }}>
              ⚠️ Guardamos a este cliente, pero ya no sumó puntos
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "rgba(28,37,38,0.6)" }}>
              Tu lealtad gratis se llenó este mes (50 visitas). Actívale Pro en
              Configuración para que ningún cliente se quede sin sus puntos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PosPage() {
  const router = useRouter();

  // Auth / restaurant
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState("POS");
  const [uid, setUid] = useState<string | null>(null);
  const [vendorRole, setVendorRole] = useState<VendorRole>("owner");
  /** Equipo de la caja (PIN roster) — switcher "¿Quién cobra?". */
  const [posStaff, setPosStaff] = useState<PosStaffMember[]>([]);
  const [currentSeller, setCurrentSeller] = useState<SoldBy | null>(null);
  const [sellerDialogOpen, setSellerDialogOpen] = useState(false);
  /** Modo Caja (kiosk): bloquea el panel a operación; salir pide PIN de gerente. */
  const [cajaLocked, setCajaLocked] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Menu
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // UI state
  const [showCheckout, setShowCheckout] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<{ mode: CheckoutMode; total: number; capReached?: boolean } | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Open tabs state
  const [activeOpenTabs, setActiveOpenTabs] = useState<any[]>([]);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [showTabsModal, setShowTabsModal] = useState(false);
  const [addingToTab, setAddingToTab] = useState<any | null>(null);
  const [checkoutTabId, setCheckoutTabId] = useState<string | null>(null);

  // Modo Caja: sync con el candado del layout (salir desde la barra lateral).
  useEffect(() => {
    function sync() {
      if (restaurantId) setCajaLocked(isCajaModeLocked(restaurantId));
    }
    window.addEventListener("cajaModeChanged", sync);
    return () => window.removeEventListener("cajaModeChanged", sync);
  }, [restaurantId]);

  // ── Auth & restaurant init ──────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }

      const db = getFirebaseDb();
      // Staff-aware: dueño, manager y empleado operan la caja (mismo matrix
      // que el app; las rules ya autorizan associates).
      const ctx = await resolveVendorContext(db, u.uid);
      if (!ctx) { router.push("/activar"); return; }
      const rid = ctx.restaurantId;
      setVendorRole(ctx.role);

      const restSnap = await getDoc(doc(db, "restaurants", rid));
      const rData = restSnap.data() ?? {};
      setRestaurantName((rData.name as string | undefined) ?? "POS");
      setRestaurantId(rid);
      setUid(u.uid);
      // Equipo de la caja: roster de PINs (associate-readable). Restaura el
      // último vendedor elegido en ESTE dispositivo (sessionStorage).
      try {
        const staffSnap = await getDocs(collection(db, "restaurants", rid, "posStaff"));
        const roster = parsePosStaff(staffSnap.docs);
        setPosStaff(roster);
        const savedRaw = typeof window !== "undefined"
          ? window.sessionStorage.getItem(`posSeller:${rid}`)
          : null;
        if (savedRaw) {
          const saved = JSON.parse(savedRaw) as SoldBy;
          if (roster.some((m) => m.id === saved.staffId && m.active)) {
            setCurrentSeller(saved);
          }
        }
      } catch { /* sin roster → la caja opera igual que siempre */ }
      setCajaLocked(isCajaModeLocked(rid));
      setAuthLoading(false);
    }
    init().catch(() => setAuthLoading(false));
  }, [router]);

  // ── Load menu ───────────────────────────────────────────────────────────────

  const loadMenu = useCallback(async (rid: string) => {
    setMenuLoading(true);
    try {
      const db = getFirebaseDb();
      const q = query(
        collection(db, "restaurants", rid, "menu"),
        where("isAvailable", "==", true)
      );
      const snap = await getDocs(q);
      const items: MenuItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MenuItem, "id">),
      }));
      items.sort((a, b) => a.name.localeCompare(b.name));
      const cats = Array.from(new Set(items.map((i) => i.category))).sort();
      setMenuItems(items);
      setCategories(cats);
    } catch {
      // silent fail — user can retry
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const loadOpenTabs = useCallback(async (rid: string) => {
    setTabsLoading(true);
    try {
      const db = getFirebaseDb();
      const q = query(
        collection(db, "restaurants", rid, "orders"),
        where("isOpenTab", "==", true)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      list.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });
      setActiveOpenTabs(list);
    } catch (err) {
      console.error("Error loading open tabs", err);
    } finally {
      setTabsLoading(false);
    }
  }, []);

  async function addItemsToTabTransaction(orderId: string, itemsToAdd: CartItem[]) {
    if (!restaurantId) return;
    setProcessing(true);
    try {
      const db = getFirebaseDb();
      const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId);
      
      await runTransaction(db, async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists()) {
          throw new Error("La cuenta no existe.");
        }
        
        const data = orderDoc.data();
        const existingItems = data.items || [];
        
        const newItems = itemsToAdd.map((c) => ({
          menuItemId: c.menuItem.id,
          name: c.menuItem.name,
          price: c.menuItem.price,
          quantity: c.quantity,
          subtotal: c.menuItem.price * c.quantity,
        }));
        
        const combinedItems = [...existingItems, ...newItems];
        const newSubtotal = combinedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        
        transaction.update(orderRef, {
          items: combinedItems,
          subtotal: newSubtotal,
          total: newSubtotal,
          updatedAt: serverTimestamp(),
        });
      });
      
      setSuccess({ mode: "tab", total: subtotal });
      setCart([]);
      setAddingToTab(null);
      loadOpenTabs(restaurantId);
    } catch (err: any) {
      console.error("Transaction failed: ", err);
      alert(`Error al actualizar la cuenta: ${err.message || err}`);
    } finally {
      setProcessing(false);
    }
  }

  async function closeOpenTab(orderId: string, method: PaymentMethod, tip = 0) {
    if (!restaurantId) return;
    try {
      const db = getFirebaseDb();
      const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId);
      
      await updateDoc(orderRef, {
        status: "completed",
        isOpenTab: false,
        paymentStatus: "paid",
        paymentMethod: method,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Propina al cerrar la cuenta — separada de total (no puntos/comisión).
        ...(tip > 0 ? { tipAmount: Math.round(tip * 100) / 100 } : {}),
      });

      // Phone Points v1: tab closed = payment confirmed → credit if the
      // order carries a customerPhone. Idempotent.
      let capMsg = "";
      try {
        const res = await creditPhonePointsForOrder({ db, restaurantId, orderId });
        if (res.credited) {
          console.log(`[phonePoints] +${res.points} pts → ${res.phone}`);
          if (res.capReached === true) {
            capMsg =
              "\n\n⚠️ Guardamos al cliente, pero ya no sumó puntos — tu lealtad gratis se llenó este mes (50 visitas). Actívale Pro en Configuración.";
          }
        }
      } catch (e) {
        console.error("[phonePoints] tab-close credit failed", e);
      }

      alert("¡Cuenta pagada y cerrada!" + capMsg);
      loadOpenTabs(restaurantId);
    } catch (err) {
      console.error("Error closing tab", err);
      alert("Error al cerrar la cuenta.");
    }
  }

  async function voidOpenTab(orderId: string) {
    if (!restaurantId) return;
    const confirmed = confirm("¿Estás seguro de que deseas cancelar esta cuenta? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      const db = getFirebaseDb();
      const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId);
      
      await updateDoc(orderRef, {
        status: "cancelled",
        isOpenTab: false,
        voidReason: "cancelled_by_vendor",
        updatedAt: serverTimestamp(),
      });
      
      alert("¡Cuenta cancelada!");
      loadOpenTabs(restaurantId);
    } catch (err) {
      console.error("Error voiding tab", err);
      alert("Error al cancelar la cuenta.");
    }
  }

  useEffect(() => {
    if (restaurantId) {
      loadMenu(restaurantId);
      loadOpenTabs(restaurantId);
    }
  }, [restaurantId, loadMenu, loadOpenTabs]);

  // ── Cart helpers ────────────────────────────────────────────────────────────

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menuItem.id === item.id);
      if (idx >= 0) {
        return prev.map((c, i) =>
          i === idx ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  }

  function increment(index: number) {
    setCart((prev) =>
      prev.map((c, i) => (i === index ? { ...c, quantity: c.quantity + 1 } : c))
    );
  }

  function decrement(index: number) {
    setCart((prev) => {
      const item = prev[index];
      if (item.quantity <= 1) return prev.filter((_, i) => i !== index);
      return prev.map((c, i) => (i === index ? { ...c, quantity: c.quantity - 1 } : c));
    });
  }

  function clearCart() {
    setCart([]);
  }

  const subtotal = cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  // ── Filtered items ──────────────────────────────────────────────────────────

  const filtered = menuItems.filter((item) => {
    const catOk = selectedCategory === null || item.category === selectedCategory;
    const q = search.toLowerCase();
    const searchOk = !q || item.name.toLowerCase().includes(q) || (item.description?.toLowerCase().includes(q) ?? false);
    return catOk && searchOk;
  });

  // ── Confirm order ───────────────────────────────────────────────────────────

  async function confirmOrder(
    mode: CheckoutMode,
    method: PaymentMethod,
    customerName: string,
    customerPhone: string,
    notes: string,
    redemption: PosRedemptionSelection | null = null,
    discount: DiscountProfile | null = null,
    tip = 0,
  ) {
    if (!restaurantId || !uid) return;
    const phoneDigits = customerPhone.replace(/\D/g, "");
    // A redemption is meaningless without the phone it belongs to.
    const effectiveRedemption =
      redemption && phoneDigits.length >= 10 ? redemption : null;
    setProcessing(true);
    try {
      const db = getFirebaseDb();
      const items: Record<string, unknown>[] = cart.map((c) => ({
        menuItemId: c.menuItem.id,
        name: c.menuItem.name,
        price: c.menuItem.price,
        quantity: c.quantity,
        subtotal: c.menuItem.price * c.quantity,
      }));

      // Redeemed reward rides the ticket as a $0 line (kitchen sees it, the
      // receipt shows it, and it never adds to total → no points earned on it).
      if (effectiveRedemption) {
        items.push({
          menuItemId: `reward_${effectiveRedemption.tierId}`,
          name: `🎁 ${effectiveRedemption.name} (canje)`,
          price: 0,
          quantity: 1,
          subtotal: 0,
          isReward: true,
        });
      }

      // Special discount (Pro): recomputed here with the same function the
      // dialog displayed — order total is saved NET so points/commission math
      // downstream needs no changes and can't be farmed.
      const discountRes =
        discount && subtotal > 0
          ? computeDiscount(
              cart.map((c) => ({
                price: c.menuItem.price,
                quantity: c.quantity,
                categoryName: c.menuItem.category,
              })),
              discount,
            )
          : null;
      const discountAmount = discountRes?.amount ?? 0;
      const netTotal = Math.max(0, subtotal - discountAmount);

      const orderData: Record<string, unknown> = {
        restaurantId,
        restaurantName,
        items,
        subtotal,
        total: netTotal,
        orderType: "in_store",
        orderSource: "pos",
        status: "pending",
        paymentMethod: mode === "now" ? method : "pending",
        paymentStatus: mode === "now" ? "paid" : "pending",
        isOpenTab: mode === "tab",
        createdAt: serverTimestamp(),
        createdByUserId: uid,
        // Atribución por empleado (equipo de la caja): quién hizo esta venta.
        ...(currentSeller ? { soldBy: currentSeller } : {}),
        // Propina: separada de total a propósito — jamás infla puntos ni
        // comisión (invariante). Íntegra, visible por empleado en Reportes.
        ...(mode === "now" && tip > 0 ? { tipAmount: Math.round(tip * 100) / 100 } : {}),
      };

      if (effectiveRedemption) {
        // Executed transactionally at cobro by creditPhonePointsForOrder
        // (live balance re-check — a stale/insufficient request fails safely).
        orderData.redemptionRequest = {
          tierId: effectiveRedemption.tierId,
          name: effectiveRedemption.name,
          points: effectiveRedemption.points,
        };
        // Owner audit trail: was the código de canje validated?
        orderData.redemptionVerified = effectiveRedemption.verified;
        orderData.redemptionVia = "pos";
      }

      if (discountRes && discountAmount > 0 && discount) {
        orderData.discountApplied = {
          profileId: discount.id,
          profileName: discount.name,
          amount: discountAmount,
          ...(discountRes.breakdown ? { breakdown: discountRes.breakdown } : {}),
        };
      }

      if (customerName.trim()) orderData.customerName = customerName.trim();
      if (phoneDigits.length >= 10) orderData.customerPhone = phoneDigits;
      if (notes.trim()) orderData.notes = notes.trim();

      const orderRef = await addDoc(
        collection(db, "restaurants", restaurantId, "orders"),
        orderData,
      );

      // Phone Points v1: "cobrar ahora" = confirmed payment → credit loyalty
      // to the phone if the cashier captured it. (Open tabs credit at close.)
      let capReached = false;
      if (mode === "now" && phoneDigits.length >= 10) {
        try {
          const res = await creditPhonePointsForOrder({
            db,
            restaurantId,
            orderId: orderRef.id,
          });
          if (res.credited) {
            console.log(`[phonePoints] +${res.points} pts → ${res.phone}`);
            capReached = res.capReached === true;
          }
        } catch (e) {
          console.error("[phonePoints] POS credit failed", e);
        }
      }

      setSuccess({ mode, total: subtotal, capReached });
      setShowCheckout(false);
      clearCart();
      loadOpenTabs(restaurantId);
    } catch (err) {
      console.error("POS order error", err);
      alert("Error al crear la orden. Intenta de nuevo.");
    } finally {
      setProcessing(false);
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <main className="flex flex-1 items-center justify-center py-20">
        <Spinner size={28} />
      </main>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <main className="flex flex-1 flex-col" style={{ minHeight: "100vh" }}>

        {/* ── Top bar ── */}
        <div
          className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 md:px-8"
          style={{ background: "#F5F3EF", borderBottom: "1px solid rgba(28,37,38,0.07)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[18px]"
              style={{ background: "#1C2526" }}
            >
              🧾
            </div>
            <div>
              <p className="text-[16px] font-extrabold leading-tight" style={{ color: "#1C2526" }}>
                Caja / POS
              </p>
              <p className="text-[12px]" style={{ color: "rgba(28,37,38,0.45)" }}>{restaurantName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Modo Caja — candado kiosk para tablet compartida */}
            {posStaff.length > 0 && vendorRole !== "employee" && !cajaLocked && (
              <button
                onClick={() => setLockDialogOpen(true)}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all hover:bg-gray-100"
                style={{ background: "rgba(28,37,38,0.07)", border: "1px solid rgba(28,37,38,0.05)" }}
                title="Modo Caja: bloquea esta pantalla a solo operación"
              >
                <span className="text-[14px]">🔓</span>
              </button>
            )}
            {cajaLocked && (
              <span
                className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[12px] font-bold"
                style={{ background: "rgba(242,140,56,0.12)", color: "#F28C38" }}
                title="Modo Caja activo — salir desde la barra lateral (PIN de gerente)"
              >
                🔒
              </span>
            )}
            {/* ¿Quién cobra? — switcher del equipo (solo si hay roster) */}
            {posStaff.length > 0 && (
              <button
                onClick={() => setSellerDialogOpen(true)}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all hover:bg-gray-100"
                style={{
                  background: currentSeller ? "rgba(242,140,56,0.1)" : "rgba(28,37,38,0.07)",
                  border: currentSeller
                    ? "1px solid rgba(242,140,56,0.4)"
                    : "1px solid rgba(28,37,38,0.05)",
                }}
              >
                <span className="text-[14px]">👤</span>
                <span
                  className="text-[12px] font-bold hidden sm:inline"
                  style={{ color: currentSeller ? "#F28C38" : "#1C2526" }}
                >
                  {currentSeller ? currentSeller.name : "¿Quién cobra?"}
                </span>
              </button>
            )}
            {/* Cuentas Abiertas button */}
            <button
              onClick={() => {
                if (restaurantId) {
                  loadOpenTabs(restaurantId);
                  setShowTabsModal(true);
                }
              }}
              className="relative flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all hover:bg-gray-100"
              style={{ background: "rgba(28,37,38,0.07)", border: "1px solid rgba(28,37,38,0.05)" }}
            >
              <span className="text-[14px]">📋</span>
              <span className="text-[12px] font-bold text-[#1C2526] hidden sm:inline">Cuentas</span>
              {activeOpenTabs.length > 0 && (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white animate-pulse"
                  style={{ background: "#F28C38" }}
                >
                  {activeOpenTabs.length}
                </span>
              )}
            </button>

            {/* Mobile cart badge */}
            <button
              className="relative flex items-center gap-2 rounded-xl px-4 py-2 md:hidden"
              style={{ background: cartCount > 0 ? "#1C2526" : "rgba(28,37,38,0.07)" }}
              onClick={() => setMobileCartOpen(true)}
            >
              <span className="text-[14px]">🛒</span>
              {cartCount > 0 && (
                <>
                  <span className="text-[13px] font-bold text-white">{cartCount}</span>
                  <span className="text-[13px] font-bold" style={{ color: "#FF9A45" }}>{fmt(subtotal)}</span>
                </>
              )}
              {cartCount === 0 && (
                <span className="text-[13px]" style={{ color: "rgba(28,37,38,0.5)" }}>Carrito</span>
              )}
            </button>
          </div>
        </div>

        {/* ── Body: menu + cart split ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Menu ── */}
          <div className="flex flex-1 flex-col overflow-hidden">

            {/* Search + category filter */}
            <div className="px-4 pt-4 pb-2 md:px-6 space-y-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar platillo..."
                className="w-full rounded-2xl px-4 py-2.5 text-[13px] outline-none"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.1)", color: "#1C2526" }}
              />

              {addingToTab && (
                <div className="p-3 rounded-xl flex items-center justify-between text-[13px] font-semibold animate-pulse" style={{ background: "rgba(217,119,87,0.12)", color: "#F28C38", border: "1px solid rgba(217,119,87,0.25)" }}>
                  <span>📝 Agregando a: {addingToTab.customerName || `Cuenta #${addingToTab.id.slice(-4)}`}</span>
                  <button
                    onClick={() => {
                      setAddingToTab(null);
                      clearCart();
                    }}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-white transition-opacity hover:opacity-95"
                    style={{ background: "#F28C38" }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {/* Category chips */}
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto px-4 pb-3 md:px-6" style={{ scrollbarWidth: "none" }}>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition-all"
                  style={
                    selectedCategory === null
                      ? { background: "#1C2526", color: "#ffffff" }
                      : { background: "rgba(28,37,38,0.08)", color: "rgba(28,37,38,0.6)" }
                  }
                >
                  Todo
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                    className="shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition-all"
                    style={
                      selectedCategory === cat
                        ? { background: "#F28C38", color: "#ffffff" }
                        : { background: "rgba(28,37,38,0.08)", color: "rgba(28,37,38,0.6)" }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Menu grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 md:px-6 md:pb-6">
              {menuLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner size={28} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-3xl text-[28px]"
                    style={{ background: "rgba(217,119,87,0.08)" }}
                  >
                    🍽️
                  </div>
                  <p className="mt-4 text-[16px] font-bold" style={{ color: "#1C2526" }}>
                    {menuItems.length === 0 ? "Sin platillos" : "Sin resultados"}
                  </p>
                  <p className="mt-1 text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                    {menuItems.length === 0
                      ? "Agrega platillos en la app para verlos aquí"
                      : "Intenta con otra búsqueda o categoría"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((item) => (
                    <MenuCard key={item.id} item={item} onAdd={() => addToCart(item)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Cart (desktop only) ── */}
          <div
            className="hidden md:flex flex-col"
            style={{
              width: 340,
              background: "#ffffff",
              borderLeft: "1px solid rgba(28,37,38,0.07)",
              flexShrink: 0,
            }}
          >
            {/* Cart header */}
            <div
              className="flex items-center justify-between px-5 pt-5 pb-3"
              style={{ borderBottom: "1px solid rgba(28,37,38,0.06)" }}
            >
              <p className="text-[15px] font-extrabold" style={{ color: "#1C2526" }}>
                Carrito {cartCount > 0 && <span style={{ color: "#F28C38" }}>({cartCount})</span>}
              </p>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}
                >
                  Vaciar
                </button>
              )}
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <p className="text-[40px]">🛒</p>
                  <p className="mt-3 text-[14px] font-semibold" style={{ color: "rgba(28,37,38,0.35)" }}>
                    Agrega platillos
                  </p>
                  {/* Pure redemption: customer came only to claim a reward. */}
                  {!addingToTab && (
                    <button
                      onClick={() => setShowCheckout(true)}
                      className="mt-4 rounded-xl px-4 py-2.5 text-[12px] font-bold transition-colors"
                      style={{ background: "rgba(22,163,74,0.1)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.3)" }}
                    >
                      🎁 Canjear premio sin venta
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {cart.map((c, i) => (
                    <CartRow
                      key={c.menuItem.id}
                      cartItem={c}
                      index={i}
                      onIncrement={increment}
                      onDecrement={decrement}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Total + CTA */}
            <div
              className="p-5 space-y-3"
              style={{ borderTop: "1px solid rgba(28,37,38,0.07)" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[13px]" style={{ color: "rgba(28,37,38,0.5)" }}>Total</p>
                <p className="text-[20px] font-extrabold" style={{ color: "#1C2526" }}>{fmt(subtotal)}</p>
              </div>
              <button
                onClick={() => {
                  if (addingToTab) {
                    addItemsToTabTransaction(addingToTab.id, cart);
                  } else {
                    setShowCheckout(true);
                  }
                }}
                disabled={cart.length === 0}
                className="w-full rounded-2xl py-4 text-[15px] font-extrabold text-white transition-all disabled:opacity-30 hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #F28C38 0%, #FF9A45 100%)", boxShadow: cart.length > 0 ? "0 4px 16px rgba(217,119,87,0.35)" : "none" }}
              >
                {addingToTab ? "Actualizar Cuenta" : "Listo →"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile sticky bottom bar */}
        {cartCount > 0 && (
          <div
            className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-4 px-4 py-3 md:hidden"
            style={{ background: "#1C2526", boxShadow: "0 -4px 20px rgba(28,37,38,0.25)" }}
          >
            <div className="flex-1">
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>{cartCount} producto{cartCount !== 1 ? "s" : ""}</p>
              <p className="text-[16px] font-extrabold text-white">{fmt(subtotal)}</p>
            </div>
            <button
              onClick={() => {
                if (addingToTab) {
                  addItemsToTabTransaction(addingToTab.id, cart);
                } else {
                  setShowCheckout(true);
                }
              }}
              className="rounded-xl px-6 py-3 text-[14px] font-extrabold"
              style={{ background: "linear-gradient(135deg, #F28C38 0%, #FF9A45 100%)", color: "#fff" }}
            >
              {addingToTab ? "Actualizar Cuenta" : "Cobrar →"}
            </button>
          </div>
        )}
      </main>

      {/* ── Mobile cart drawer ── */}
      {mobileCartOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end md:hidden"
          style={{ background: "rgba(28,37,38,0.5)" }}
          onClick={() => setMobileCartOpen(false)}
        >
          <div
            className="rounded-t-3xl overflow-hidden"
            style={{ background: "#ffffff", maxHeight: "70vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(28,37,38,0.06)" }}>
              <p className="text-[15px] font-extrabold" style={{ color: "#1C2526" }}>Carrito ({cartCount})</p>
              <button onClick={() => setMobileCartOpen(false)} className="text-[20px]" style={{ color: "rgba(28,37,38,0.4)" }}>×</button>
            </div>
            <div className="overflow-y-auto px-5" style={{ maxHeight: "calc(70vh - 60px)" }}>
              {cart.map((c, i) => (
                <CartRow key={c.menuItem.id} cartItem={c} index={i} onIncrement={increment} onDecrement={decrement} />
              ))}
              <div className="py-4">
                {cart.length > 0 && (
                  <button onClick={clearCart} className="w-full rounded-xl py-2 text-[12px] font-bold" style={{ color: "#ef4444", background: "rgba(239,68,68,0.06)" }}>
                    Vaciar carrito
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Activar Modo Caja ── */}
      {lockDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(28,37,38,0.5)" }}
          onClick={() => setLockDialogOpen(false)}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-extrabold" style={{ color: "#1C2526" }}>
              🔒 Activar Modo Caja
            </p>
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "rgba(28,37,38,0.5)" }}>
              Esta pantalla queda bloqueada a <b>Caja, Pedidos y Escanear</b> —
              ideal para la tablet del mostrador. Para salir se necesita el PIN
              de un <b>Gerente</b> de tu equipo.
            </p>
            {!posStaff.some((m) => m.active && m.role === "gerente") && (
              <p
                className="mt-2 rounded-lg px-3 py-2 text-[11px] font-semibold"
                style={{ background: "rgba(234,88,12,0.1)", color: "#9A3412" }}
              >
                ⚠️ No tienes ningún Gerente en el equipo — cualquiera podría
                salir del modo. Agrega uno en Configuración (puede ser tu
                propio PIN).
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (restaurantId) setCajaModeLocked(restaurantId, true);
                  setCajaLocked(true);
                  setLockDialogOpen(false);
                }}
                className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-bold text-white"
                style={{ background: "#F28C38" }}
              >
                Activar
              </button>
              <button
                type="button"
                onClick={() => setLockDialogOpen(false)}
                className="rounded-xl px-4 py-2.5 text-[12px] font-semibold"
                style={{ background: "rgba(28,37,38,0.06)", color: "rgba(28,37,38,0.6)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ¿Quién cobra? (equipo de la caja) ── */}
      <SellerPinDialog
        open={sellerDialogOpen}
        roster={posStaff}
        current={currentSeller}
        onClose={() => setSellerDialogOpen(false)}
        onPick={(seller) => {
          setCurrentSeller(seller);
          setSellerDialogOpen(false);
          try {
            if (restaurantId) {
              if (seller) window.sessionStorage.setItem(`posSeller:${restaurantId}`, JSON.stringify(seller));
              else window.sessionStorage.removeItem(`posSeller:${restaurantId}`);
            }
          } catch { /* storage lleno/privado — el estado en memoria basta */ }
        }}
      />

      {/* ── Checkout dialog ── */}
      {showCheckout && (
        <CheckoutDialog
          total={subtotal}
          cartLines={cart.map((c) => ({
            price: c.menuItem.price,
            quantity: c.quantity,
            categoryName: c.menuItem.category,
          }))}
          restaurantId={restaurantId ?? ""}
          onClose={() => setShowCheckout(false)}
          onConfirm={confirmOrder}
          processing={processing}
          canAssignDiscount={vendorRole === "owner"}
        />
      )}

      {/* ── Success overlay ── */}
      {success && (
        <SuccessOverlay
          mode={success.mode}
          total={success.total}
          capReached={success.capReached}
          onDone={() => setSuccess(null)}
        />
      )}

      {/* ── Open Tabs Modal ── */}
      {showTabsModal && (
        <OpenTabsModal
          tabs={activeOpenTabs}
          loading={tabsLoading}
          onClose={() => setShowTabsModal(false)}
          onCloseTab={(id) => setCheckoutTabId(id)}
          onStartAdding={(tab) => {
            setAddingToTab(tab);
            setShowTabsModal(false);
          }}
          onVoidTab={(id) => voidOpenTab(id)}
        />
      )}

      {/* ── Close Tab Payment Method Selector ── */}
      {checkoutTabId && (
        <CloseTabDialog
          tabTotal={Number(activeOpenTabs.find((t) => t.id === checkoutTabId)?.total) || 0}
          onClose={() => setCheckoutTabId(null)}
          onConfirm={(method, tip) => {
            closeOpenTab(checkoutTabId, method, tip);
            setCheckoutTabId(null);
          }}
        />
      )}
    </>
  );
}

// ─── Open Tabs Subcomponents ──────────────────────────────────────────────────

function OpenTabsModal({
  tabs,
  loading,
  onClose,
  onCloseTab,
  onStartAdding,
  onVoidTab,
}: {
  tabs: any[];
  loading: boolean;
  onClose: () => void;
  onCloseTab: (orderId: string) => void;
  onStartAdding: (tab: any) => void;
  onVoidTab: (orderId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" style={{ background: "rgba(28,37,38,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div
        className="w-full rounded-t-3xl md:w-[500px] md:rounded-3xl overflow-hidden"
        style={{ background: "#ffffff", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid rgba(28,37,38,0.07)" }}>
          <div>
            <p className="text-[18px] font-extrabold" style={{ color: "#1C2526" }}>Cuentas Abiertas</p>
            <p className="text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>{tabs.length} cuentas activas</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[18px]"
            style={{ background: "rgba(28,37,38,0.06)", color: "#1C2526" }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner size={24} /></div>
          ) : tabs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <span className="text-4xl block mb-2">📋</span>
              No hay cuentas abiertas.
            </div>
          ) : (
            tabs.map((tab) => {
              const itemCount = tab.items?.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0) || 0;
              const date = tab.createdAt?.toDate ? tab.createdAt.toDate() : new Date();
              const formattedTime = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

              return (
                <div
                  key={tab.id}
                  className="rounded-2xl p-4 bg-white space-y-3"
                  style={{ border: "1px solid rgba(28,37,38,0.07)", boxShadow: "0 1px 3px rgba(28,37,38,0.04)" }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>{tab.customerName || `Mesa/Cuenta #${tab.id.slice(-4)}`}</p>
                      <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                        Creada a las {formattedTime} · {itemCount} {itemCount === 1 ? "producto" : "productos"}
                      </p>
                    </div>
                    <p className="text-[15px] font-bold text-[#F28C38]">{fmt(tab.total || 0)}</p>
                  </div>

                  {/* Tab Items List */}
                  <div className="text-[11px] text-gray-500 max-h-24 overflow-y-auto bg-gray-50 rounded-lg p-2 space-y-1">
                    {tab.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{fmt(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => onVoidTab(tab.id)}
                      className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => onStartAdding(tab)}
                      className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Agregar productos
                    </button>
                    <button
                      onClick={() => onCloseTab(tab.id)}
                      className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white bg-[#F28C38] hover:opacity-90 transition-all"
                    >
                      Cobrar Cuenta
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CloseTabDialog({
  tabTotal,
  onClose,
  onConfirm,
}: {
  tabTotal: number;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, tip: number) => void;
}) {
  const [tipPct, setTipPct] = useState<number | null>(null);
  const [tipCustom, setTipCustom] = useState<number | "">("");
  const tip =
    tipCustom !== "" && Number(tipCustom) > 0
      ? Math.round(Number(tipCustom) * 100) / 100
      : tipPct
        ? Math.round(tabTotal * tipPct) / 100
        : 0;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-[320px] text-center space-y-4" style={{ boxShadow: "0 10px 25px rgba(28,37,38,0.15)" }} onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-extrabold text-[#1C2526]">Cobrar Cuenta</p>
        <p className="text-[13px] text-gray-400">
          {tip > 0
            ? `Total ${fmt(tabTotal)} + 💵 propina ${fmt(tip)} = ${fmt(tabTotal + tip)}`
            : "Selecciona el método de pago del cliente"}
        </p>
        <div>
          <p className="mb-1.5 text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">💵 Propina (opcional)</p>
          <div className="flex items-center gap-1.5">
            {[10, 15, 20].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => { setTipCustom(""); setTipPct((c) => (c === pct ? null : pct)); }}
                className="flex-1 rounded-xl px-2 py-2 text-[13px] font-bold transition-all"
                style={
                  tipPct === pct && tipCustom === ""
                    ? { background: "#16A34A", color: "#fff", border: "1.5px solid #16A34A" }
                    : { background: "#F5F3EF", color: "rgba(28,37,38,0.6)", border: "1.5px solid rgba(28,37,38,0.1)" }
                }
              >
                {pct}%
              </button>
            ))}
            <div className="flex flex-1 items-center gap-1 rounded-xl px-2" style={{ background: "#F5F3EF", border: "1.5px solid rgba(28,37,38,0.1)" }}>
              <span className="text-[13px] font-semibold text-gray-400">$</span>
              <input
                type="number"
                min={0}
                value={tipCustom}
                placeholder="otra"
                onChange={(e) => { setTipPct(null); setTipCustom(e.target.value === "" ? "" : Math.max(0, Number(e.target.value))); }}
                className="w-full bg-transparent py-2 text-left text-[13px] font-bold outline-none text-[#1C2526]"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onConfirm("cash", tip)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-orange-50 hover:border-[#F28C38] transition-all"
          >
            <span className="text-2xl mb-1">💵</span>
            <span className="text-[12px] font-bold text-[#1C2526]">Efectivo</span>
          </button>
          <button
            onClick={() => onConfirm("card", tip)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-orange-50 hover:border-[#F28C38] transition-all"
          >
            <span className="text-2xl mb-1">💳</span>
            <span className="text-[12px] font-bold text-[#1C2526]">Tarjeta</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-[12px] font-bold bg-gray-100 text-[#1C2526] hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
