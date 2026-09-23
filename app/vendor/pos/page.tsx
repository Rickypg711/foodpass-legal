"use client";

import { restaurantPromisesPoints } from "@/lib/readiness/evaluate";
import { buildEarnPreview, cashierEarnLine, cashierWelcomeLine } from "@/lib/loyalty/earnPreview";
import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
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
  deleteField,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { fetchWithBilling } from "@/lib/subscription/billingDoc";
import {
  entitlementOf,
  entitlementsOf,
  type CajaWall,
  FREE_ENTITLEMENTS,
  type Entitlement,
  type Entitlements,
} from "@/lib/subscription/entitlement";
import { ProWall } from "@/components/vendor/ProWall";
import ReferralNotifyButton from "@/components/loyalty/ReferralNotifyButton";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext, type VendorRole } from "@/lib/vendorContext";
import { parsePosStaff, findStaffByPin, type PosStaffMember, type SoldBy } from "@/lib/posStaff";
import { isCajaModeLocked, setCajaModeLocked } from "@/lib/cajaMode";
import { creditPhonePointsForOrder } from "@/lib/loyalty/phonePoints";
import { groupOpenTabs, type TabGroup } from "@/lib/pos/tabGroups";
import { registerTabGroupPayment } from "@/lib/pos/registerPayment";
import {
  POS_PAYMENT_OPTIONS,
  acceptedPaymentOptions,
  paymentMethodsSentence,
  type PaymentMethod,
} from "@/lib/pos/paidOrderFields";
import { receiptWhatsappUrl } from "@/lib/receiptWhatsapp";
import { markReceiptTapped } from "@/lib/order/receiptStamps";
// Opciones por platillo (salsas/extras) — mismo motor que el menú del cliente.
// Ver docs/OPCIONES_POR_PLATILLO.md: lo guardado en optionGroups manda, y si
// no hay, el parser lee la descripción.
import {
  resolveOptionGroups,
  setOptionAvailability,
  applyOptionAvailabilityToMenu,
  type MenuItemOptionGroup,
} from "@/lib/menu/optionGroups";
import { buildLineId, optionsPriceDelta, describeSelectedOptions } from "@/lib/cart/lineId";
import type { SelectedOptionGroup } from "@/lib/cart/types";
import { ItemOptionsSheet } from "@/components/menu/ItemOptionsSheet";
import {
  PosRedemption,
  type PosRedemptionSelection,
} from "@/components/loyalty/PosRedemption";
import {
  computeDiscount,
  discountsEnabled,
  parseDiscountProfiles,
  type DiscountProfile,
} from "@/lib/loyalty/discountProfiles";
import {
  recalcTabDiscount,
  tabLinesFromItems,
  type TabDiscountRecalc,
} from "@/lib/loyalty/tabDiscountRecalc";
import { phoneCountryOf } from "@/lib/phone/phoneCountry";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  optionGroups?: MenuItemOptionGroup[] | null;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  /** Llave de la línea: unas alitas búfalo y unas BBQ NO son la misma línea. */
  lineId: string;
  /** Precio base + sobreprecio de lo elegido. Unitario, multiplica por cantidad. */
  unitPrice: number;
  selectedOptions?: SelectedOptionGroup[];
}

/** Una línea del carrito tal como se guarda en el pedido. */
function cartLineToOrderItem(c: CartItem): Record<string, unknown> {
  return {
    menuItemId: c.menuItem.id,
    name: c.menuItem.name,
    price: c.unitPrice,
    quantity: c.quantity,
    subtotal: c.unitPrice * c.quantity,
    // Snapshot de la categoría: sin esto el recálculo del descuento al
    // cerrar no puede distinguir bebidas de alimentos (per_category).
    ...(c.menuItem.category ? { categoryName: c.menuItem.category } : {}),
    // Misma forma que ya renderiza /vendor/pedidos y manda el WhatsApp.
    ...(c.selectedOptions?.length
      ? {
          selectedModifiers: c.selectedOptions.map((g) => ({
            modifierName: g.groupName,
            selectedOptions: g.options.map((o) => o.name),
          })),
        }
      : {}),
  };
}

type CheckoutMode = "now" | "tab";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
}

// Opción A (23-sep-2026, lienzo "Sistema Comeleal"): mismos tokens que el
// Panel y Pedidos. Crema + tinta, naranja solo en la acción principal.
const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const INK_SOFT = "#5B6366";
const HAIRLINE = "#E9E3D7";
const BORDER = "#D9D2C5";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const TILE = "#F0EBE1";
const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconLock({ open = false }: { open?: boolean }) {
  return <svg {...ICON}><rect x="4" y="11" width="16" height="10" rx="2" /><path d={open ? "M8 11V7a4 4 0 0 1 7.5-2" : "M8 11V7a4 4 0 0 1 8 0v4"} /></svg>;
}
function IconPerson() { return <svg {...ICON}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>; }
function IconTabs() { return <svg {...ICON}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M8 15h4" /></svg>; }
function IconCart() { return <svg {...ICON}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6" /></svg>; }
function IconSearch() { return <svg {...ICON} stroke="#5B6366"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>; }
function IconPlus({ size = 20 }: { size?: number }) { return <svg {...ICON} width={size} height={size} strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>; }
function IconMinus({ size = 18 }: { size?: number }) { return <svg {...ICON} width={size} height={size} strokeWidth={2}><path d="M5 12h14" /></svg>; }
function IconDish() { return <svg {...ICON} width={22} height={22} stroke="#5B6366"><path d="M5 3v7a3 3 0 0 0 6 0V3M8 3v18M18 3c-2 1-3 4-3 7v1h3v10" /></svg>; }
function IconGift() { return <svg {...ICON}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8c-2 0-4-1-4-3s3-2 4 3c1-5 4-5 4-3s-2 3-4 3" /></svg>; }

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
      className="group relative flex flex-col overflow-hidden rounded-xl bg-white text-left transition-all duration-150 active:scale-[0.97] hover:opacity-90"
      style={{ border: `1px solid ${BORDER}` }}
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.name} className="h-24 w-full object-cover" />
      ) : (
        <div className="flex h-20 w-full items-center justify-center" style={{ background: TILE }}>
          <IconDish />
        </div>
      )}
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[14px] font-semibold leading-[18px] line-clamp-2" style={{ color: INK }}>{item.name}</p>
        {item.description && (
          <p className="mt-0.5 text-[12px] leading-4 line-clamp-1" style={{ color: INK_SOFT }}>{item.description}</p>
        )}
        <div className="mt-auto flex items-end justify-between pt-2">
          <p className="text-[15px] font-semibold tabular-nums" style={{ color: INK }}>{fmt(item.price)}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white transition-transform group-hover:scale-105" style={{ border: `1px solid ${INK}`, color: INK }} aria-hidden>
            <IconPlus size={16} />
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
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-5" style={{ color: INK }}>{cartItem.menuItem.name}</p>
        {cartItem.selectedOptions && cartItem.selectedOptions.length > 0 && (
          <p className="truncate text-[13px] leading-4" style={{ color: INK_MUTED }}>{describeSelectedOptions(cartItem.selectedOptions)}</p>
        )}
        <p className="text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>{fmt(cartItem.unitPrice)} c/u</p>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onDecrement(index)} aria-label="Quitar uno" className="flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ border: `1px solid ${BORDER}`, color: INK }}>
          <IconMinus size={16} />
        </button>
        <span className="w-6 text-center text-[15px] font-bold tabular-nums" style={{ color: INK }}>{cartItem.quantity}</span>
        <button type="button" onClick={() => onIncrement(index)} aria-label="Agregar otro" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: INK, color: "#FAF9F5" }}>
          <IconPlus size={16} />
        </button>
      </div>
      <p className="w-16 text-right text-[15px] font-semibold tabular-nums" style={{ color: INK }}>{fmt(cartItem.unitPrice * cartItem.quantity)}</p>
    </div>
  );
}

// ─── Checkout Dialog ───────────────────────────────────────────────────────────

// ─── ¿Quién cobra? — switcher del equipo de la caja (PIN, estilo Square) ─────
// El dispositivo queda logueado como el venue; cada persona teclea su PIN de
// 4 dígitos para "tomar la caja". Cada venta se estampa con soldBy.

// Opción A (23-sep-2026): piezas compartidas por los diálogos de la Caja.
// Mismos tokens que la cáscara; nada de verdes/rojos de fondo ni emojis.
const CREAM = "#FAF9F5";
const WARN = "#B45309";
const SUCCESS = "#15803D";
const DANGER = "#B91C1C";
const INPUT_CLS = "h-12 w-full rounded-xl bg-white px-4 text-[16px] outline-none placeholder:text-[#5B6366]";
const INPUT_STYLE = { border: `1px solid ${BORDER}`, color: INK } as const;

function IconClose() { return <svg {...ICON} width={20} height={20}><path d="M6 6l12 12M18 6L6 18" /></svg>; }
function IconCheck() { return <svg {...ICON} width={26} height={26} strokeWidth={2}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>; }
function IconBackspace() { return <svg {...ICON} width={22} height={22}><path d="M21 6H8l-5 6 5 6h13a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z" /><path d="M12 9l6 6M18 9l-6 6" /></svg>; }

/** Marco de todo diálogo: hoja desde abajo en móvil (radio 16 arriba) y
 *  tarjeta centrada en escritorio (radio 12). Sin sombra: borde `#D9D2C5`. */
function ModalFrame({
  onBackdrop,
  widthClass = "md:w-[440px]",
  maxHeight = "90vh",
  z = "z-50",
  children,
}: {
  onBackdrop?: () => void;
  widthClass?: string;
  maxHeight?: string;
  z?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 ${z} flex items-end justify-center md:items-center md:p-4`}
      style={{ background: "rgba(28,37,38,0.5)" }}
      onClick={onBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex w-full flex-col overflow-hidden rounded-t-2xl bg-white md:rounded-xl ${widthClass}`}
        style={{ maxHeight, border: `1px solid ${BORDER}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ title, caption, onClose }: { title: string; caption?: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <div className="min-w-0">
        <p className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>{title}</p>
        {caption ? <p className="mt-0.5 text-[13px] leading-[18px]" style={{ color: INK_MUTED }}>{caption}</p> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ color: INK }}
        >
          <IconClose />
        </button>
      ) : null}
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium leading-[18px]" style={{ color: INK_MUTED }}>
      {children}
    </label>
  );
}

/** Chip/segmento de 44px: activo = fondo tinta, texto crema. */
function Seg({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-11 items-center justify-center rounded-xl px-3 text-[14px] font-semibold transition active:scale-[0.98] ${className}`}
      style={
        active
          ? { background: INK, color: CREAM, border: `1px solid ${INK}` }
          : { background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }
      }
    >
      {children}
    </button>
  );
}

function PinKey({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-[20px] font-semibold tabular-nums transition active:scale-[0.96]"
      style={{ border: `1px solid ${BORDER}`, color: INK }}
    >
      {label}
    </button>
  );
}

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
  const padRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setPin(""); setBad(false); }
  }, [open]);

  // El teclado físico también sirve (tablet con teclado, escritorio).
  useEffect(() => {
    if (open) padRef.current?.focus();
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

  const pressDigit = (d: string) => {
    if (bad) setBad(false);
    setPin((p) => (p.length < 4 ? p + d : p));
  };
  const erase = () => {
    if (bad) setBad(false);
    setPin((p) => p.slice(0, -1));
  };
  const activos = roster.filter((m) => m.active);

  return (
    <ModalFrame onBackdrop={onClose} widthClass="md:w-[360px]">
      <div
        ref={padRef}
        tabIndex={-1}
        className="px-5 pb-5 pt-4 outline-none"
        onKeyDown={(e) => {
          if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pressDigit(e.key); }
          else if (e.key === "Backspace") { e.preventDefault(); erase(); }
          else if (e.key === "Escape") onClose();
        }}
      >
        <p className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>¿Quién cobra?</p>
        <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>
          Teclea tu PIN de 4 dígitos. Las ventas quedan a tu nombre.
        </p>

        {/* Puntos del PIN */}
        <div className="mt-5 flex items-center justify-center gap-3" aria-label={`${pin.length} de 4 dígitos`}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-full"
              style={{ background: i < pin.length ? INK : "transparent", border: `1.5px solid ${bad ? DANGER : INK}` }}
            />
          ))}
        </div>
        <p className="mt-2 h-[18px] text-center text-[13px] leading-[18px]" style={{ color: DANGER }} role="alert">
          {bad ? "PIN incorrecto. Intenta de nuevo." : ""}
        </p>

        {/* Teclado: teclas de 56px, blancas con borde */}
        <div className="mx-auto mt-3 grid grid-cols-3 gap-2" style={{ width: 184 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PinKey key={d} label={d} onClick={() => pressDigit(d)} />
          ))}
          <span aria-hidden />
          <PinKey label="0" onClick={() => pressDigit("0")} />
          <button
            type="button"
            onClick={erase}
            aria-label="Borrar"
            className="flex h-14 w-14 items-center justify-center rounded-xl transition active:scale-[0.96]"
            style={{ color: INK }}
          >
            <IconBackspace />
          </button>
        </div>

        {activos.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {activos.map((m) => {
              const on = current?.staffId === m.id;
              return (
                <span
                  key={m.id}
                  className="inline-flex h-[24px] items-center rounded-full px-2.5 text-[12px] font-semibold"
                  style={on ? { background: INK, color: CREAM } : { background: TILE, color: INK_MUTED }}
                >
                  {m.name}
                </span>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {current && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-white text-[14px] font-semibold transition hover:opacity-90"
              style={{ border: `1px solid ${BORDER}`, color: INK }}
            >
              Quitar vendedor
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center text-[14px] font-semibold hover:underline"
            style={{ color: LINK }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </ModalFrame>
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
  paymentOptions,
  loyaltyLive = true,
  restaurantData = null,
  tableTabsLocked = false,
  onTabsLocked,
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
    tipMethod: PaymentMethod,
  ) => void;
  processing: boolean;
  /** 🎚️ Solo las formas de pago que este restaurante acepta (Configuración). */
  paymentOptions: typeof POS_PAYMENT_OPTIONS;
  /** Premios apagados (5-sep): sin nada que ganar, no se prometen puntos. */
  loyaltyLive?: boolean;
  /** Doc del local, para decir ANTES cuántos puntos junta ESTA venta
   *  (robo 5-sep: Fluxsales "Acumulas 37 Boras con este pedido"). */
  restaurantData?: Record<string, unknown> | null;
  /** Pared 3 (8-sep): abrir cuentas de mesa es Pro — el botón lo dice antes. */
  tableTabsLocked?: boolean;
  /**
   * Pared 3 (10-sep): con la reja cerrada, tocar "Cuenta abierta" abre la pared
   * AL MOMENTO. Antes el modo se elegía, el botón pedía nombre y quedaba gris sin
   * decir por qué: la pared solo salía después de teclear un nombre, así que el
   * dueño free nunca la veía ("la puerta no abre", La Familia). Espejo de la app,
   * donde "Cobrar después" pide la pared al tocarlo.
   */
  onTabsLocked?: () => void;
}) {
  const [mode, setMode] = useState<CheckoutMode>("now");
  /** Tocó "Cuenta abierta" con la reja cerrada: si la abre (prueba/Pro), se pasa sola a ese modo. */
  const [quiereCuenta, setQuiereCuenta] = useState(false);
  // Ajuste DURANTE el render (el patrón de React para "cuando cambia una prop"),
  // no un efecto: setState dentro de useEffect provoca renders en cascada.
  const [lockedAntes, setLockedAntes] = useState(tableTabsLocked);
  if (lockedAntes !== tableTabsLocked) {
    setLockedAntes(tableTabsLocked);
    if (!tableTabsLocked && quiereCuenta) {
      setQuiereCuenta(false);
      setMode("tab");
    }
  }
  const [method, setMethod] = useState<PaymentMethod>(paymentOptions[0]?.key ?? "cash");
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
  /** Cash o tarjeta para la PROPINA — puede diferir del pago de la cuenta
   * (pedido por Pecado Escondido: "a veces pagan en tarjeta y dejan la propina
   * en cash"). null = todavia no lo tocan, sigue al metodo de pago. */
  const [tipMethod, setTipMethod] = useState<PaymentMethod | null>(null);

  // No cart total = pure reward redemption ("Canjear premio sin venta").
  // There's nothing to charge, so we hide the payment flow and speak "canje",
  // not "cobro".
  const isRedeemOnly = total <= 0;

  // Special discount (Pro): owner-assigned profile detected by phone lookup.
  // Same computeDiscount the order will use — display and charge can't drift.
  const discountRes =
    discountProfile && total > 0 ? computeDiscount(cartLines, discountProfile) : null;
  const effTotal = Math.max(0, total - (discountRes?.amount ?? 0));
  /** Lo que GANA el cliente con esta venta, dicho antes de pedirle el número. */
  const earnPreview = loyaltyLive ? buildEarnPreview(restaurantData, effTotal) : { points: null, welcomeRewardName: null };
  const phoneDigitsTyped = phone.replace(/\D/g, "");
  const tipAmount =
    tipCustom !== "" && Number(tipCustom) > 0
      ? Math.round(Number(tipCustom) * 100) / 100
      : tipPct
        ? Math.round(effTotal * tipPct) / 100
        : 0;
  const grandTotal = effTotal + tipAmount;
  /** Por defecto la propina sigue al pago; un toque la separa. */
  const effTipMethod: PaymentMethod = tipMethod ?? method;

  return (
    <ModalFrame widthClass="md:w-[440px]">
      <DialogHeader
        title={isRedeemOnly ? "Canjear premio" : "Cobrar"}
        caption={
          isRedeemOnly ? (
            "Sin venta, solo entregar premio"
          ) : discountRes && discountRes.amount > 0 ? (
            <>
              {/* Original TACHADO junto al neto (mismo patrón que la app):
                  el cajero ve qué era, cuánto se fue y qué se cobra. */}
              Total:{" "}
              <span className="tabular-nums" style={{ textDecoration: "line-through", color: INK_SOFT }}>
                {fmt(total)}
              </span>{" "}
              <span className="font-bold tabular-nums" style={{ color: INK }}>{fmt(effTotal)}</span>
              {` · descuento ${fmt(discountRes.amount)}`}
              {tipAmount > 0 ? ` · propina ${fmt(tipAmount)}` : ""}
            </>
          ) : tipAmount > 0 ? (
            `Total: ${fmt(total)} · propina ${fmt(tipAmount)}`
          ) : (
            `Total: ${fmt(total)}`
          )
        }
        onClose={onClose}
      />

      <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5">
        {/* Mode selector — irrelevant for a $0 reward handoff */}
        {!isRedeemOnly && (
          <div>
            <FieldLabel>¿Cómo cobrar?</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "now", label: "Cobrar ahora" },
                { key: "tab", label: tableTabsLocked ? "Cuenta abierta · Pro" : "Cuenta abierta" },
              ] as { key: CheckoutMode; label: string }[]).map((opt) => (
                <Seg
                  key={opt.key}
                  active={mode === opt.key}
                  onClick={() => {
                    // Reja cerrada: la pared sale AL TOCAR, no después de teclear un nombre.
                    if (opt.key === "tab" && tableTabsLocked && onTabsLocked) {
                      setQuiereCuenta(true);
                      onTabsLocked();
                      return;
                    }
                    setMode(opt.key);
                  }}
                >
                  {opt.label}
                </Seg>
              ))}
            </div>
            <p className="mt-1.5 text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>
              {mode === "now"
                ? paymentMethodsSentence(paymentOptions.map((o) => o.key))
                : "Se cobra después, cuando cierres la cuenta."}
            </p>
          </div>
        )}

        {/* Payment method — only when actually charging money */}
        {mode === "now" && !isRedeemOnly && (
          <div>
            <FieldLabel>Método de pago</FieldLabel>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${paymentOptions.length}, minmax(0, 1fr))` }}>
              {paymentOptions.map((m) => (
                <Seg key={m.key} active={method === m.key} onClick={() => setMethod(m.key)} className="px-2">
                  {m.label}
                </Seg>
              ))}
            </div>
          </div>
        )}

        {/* Customer phone → rewards → name → notes.
            Phone is first: it's the loyalty identifier that pulls up points. */}
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="pos-phone">
              Teléfono del cliente {isRedeemOnly ? "(requerido para canjear)" : "(opcional)"}
            </FieldLabel>
            <input
              id="pos-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={loyaltyLive ? "Para sus puntos — 614 123 4567" : "Para su ticket y promos — 614 123 4567"}
              maxLength={16}
              className={INPUT_CLS}
              style={INPUT_STYLE}
            />
            <p className="mt-1.5 text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>
              {/* Con el número de ESTA venta, no "junta puntos" a secas. */}
              {loyaltyLive
                ? `${cashierEarnLine(earnPreview) ?? "Junta puntos automáticamente"}. Si el número tiene descuento asignado (staff o familia), se aplica solo.`
                : "Le mandas su ticket y le avisas de promos. Si el número tiene descuento asignado (staff o familia), se aplica solo."}{" "}
              Al darlo acepta el{" "}
              <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: LINK }}>
                Aviso de Privacidad
              </a>.
            </p>
          </div>

          {/* La bienvenida es la razón para pedir el número aunque sea su
              primera vez. Solo mientras faltan dígitos: con 10 manda
              PosRedemption (su estado real). */}
          {loyaltyLive && phoneDigitsTyped.length < 10 && cashierWelcomeLine(earnPreview) ? (
            <p className="text-[13px] font-semibold leading-[18px]" style={{ color: WARN }}>
              {cashierWelcomeLine(earnPreview)}.
            </p>
          ) : null}

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
            <FieldLabel htmlFor="pos-name">
              {mode === "tab" ? "Nombre de la cuenta (requerido)" : "Nombre del cliente (opcional)"}
            </FieldLabel>
            <input
              id="pos-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === "tab" ? "Mesa 3, Juan..." : "Para el ticket"}
              className={INPUT_CLS}
              style={INPUT_STYLE}
            />
          </div>
          {/* Notes: collapsed behind a link during a $0 canje so the fast
              lane stays clean, but the kitchen note is one tap away (the free
              premio still rides to the kitchen as a $0 line). */}
          {isRedeemOnly && !showNote ? (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="text-[14px] font-semibold hover:underline"
              style={{ color: LINK }}
            >
              Agregar nota para cocina
            </button>
          ) : (
            <div>
              <FieldLabel htmlFor="pos-notes">Notas (opcional)</FieldLabel>
              <input
                id="pos-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sin cebolla, extra salsa..."
                className={INPUT_CLS}
                style={INPUT_STYLE}
                autoFocus={isRedeemOnly}
              />
            </div>
          )}
        </div>

        {/* ── Propina (opcional, solo al cobrar ahora) ── */}
        {mode === "now" && !isRedeemOnly && (
          <div>
            <FieldLabel>Propina (opcional)</FieldLabel>
            <div className="flex items-center gap-2">
              {[10, 15, 20].map((pct) => (
                <Seg
                  key={pct}
                  active={tipPct === pct && tipCustom === ""}
                  onClick={() => {
                    setTipCustom("");
                    setTipPct((cur) => (cur === pct ? null : pct));
                  }}
                  className="flex-1 px-2 tabular-nums"
                >
                  {pct}%
                </Seg>
              ))}
              <div className="flex h-11 flex-1 items-center gap-1 rounded-xl bg-white px-3" style={{ border: `1px solid ${BORDER}` }}>
                <span className="text-[14px]" style={{ color: INK_SOFT }}>$</span>
                <input
                  type="number"
                  min={0}
                  value={tipCustom}
                  placeholder="otra"
                  aria-label="Otra propina"
                  onChange={(e) => {
                    setTipPct(null);
                    setTipCustom(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)));
                  }}
                  className="w-full min-w-0 bg-transparent text-[16px] font-semibold tabular-nums outline-none placeholder:text-[#5B6366]"
                  style={{ color: INK }}
                />
              </div>
            </div>
            {tipAmount > 0 && (
              <>
                <div className="mt-3">
                  <FieldLabel>¿Cómo dejó la propina?</FieldLabel>
                  <div className="flex items-center gap-2">
                    {paymentOptions.map((t) => (
                      <Seg key={t.key} active={effTipMethod === t.key} onClick={() => setTipMethod(t.key)} className="flex-1 px-1">
                        {t.label}
                      </Seg>
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>
                  La propina no suma puntos de lealtad. Va aparte, íntegra para el equipo.
                  {/* Solo se dice algo del EFECTIVO, que es el dato accionable
                      ("no se la vuelvas a pagar"). De la tarjeta no se dice
                      nada a proposito: cuando el dueno le paga a su equipo es
                      decision suya — diario, semanal o quincenal — y el copy
                      no tiene por que inventarlo. */}
                  {effTipMethod === "cash"
                    ? " En efectivo el mesero ya la tiene en la mano."
                    : ""}
                </p>
              </>
            )}
          </div>
        )}

        {/* Confirm */}
        {redemption ? (
          <p className="text-center text-[14px] font-semibold leading-5" style={{ color: SUCCESS }}>
            Incluye: {redemption.name} gratis
            {redemption.points > 0
              ? ` (−${redemption.points} pts)`
              : redemption.freeItemSource === "referral"
                ? // §6: el cajero tiene que saber QUÉ está entregando. Un taco
                  // de referido no es la bienvenida: se lo ganó porque su
                  // amigo vino, y decirlo en voz alta es la mitad del premio.
                  ` (referido${redemption.freeItemReferredName ? ` de ${redemption.freeItemReferredName}` : ""})`
                : " (bienvenida)"}
          </p>
        ) : null}
        <button
          onClick={() => onConfirm(mode, method, name, phone, notes, redemption, discountProfile, mode === "now" ? tipAmount : 0, effTipMethod)}
          disabled={
            processing ||
            (mode === "tab" && !name.trim()) ||
            (total <= 0 && !redemption)
          }
          className="flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
          style={mode === "now" ? { background: BRAND, color: INK } : { background: INK, color: CREAM }}
        >
          {processing ? (
            "Procesando…"
          ) : mode === "now" ? (
            isRedeemOnly
              ? (redemption ? "Entregar premio" : "Elige un premio para canjear ↑")
              : `Cobrar ${fmt(grandTotal)}`
          ) : !name.trim() ? (
            // Gris callado se leía como "no sirve": se dice qué falta.
            "Escribe el nombre de la cuenta ↑"
          ) : (
            `Abrir cuenta · ${fmt(effTotal)}`
          )}
        </button>
      </div>
    </ModalFrame>
  );
}

// ─── Success overlay ───────────────────────────────────────────────────────────

function SuccessOverlay({ mode, total, receiptUrl, ticketUrl, onDone, onReceiptTapped, onTicket, loyaltyLive = true, referralNotify }: { mode: CheckoutMode; total: number; receiptUrl?: string; ticketUrl?: string; onDone: () => void; onReceiptTapped?: () => void; /** El ticket es Pro (23-sep): la página decide si abre la hoja o la pared. */ onTicket?: () => void; loyaltyLive?: boolean; referralNotify?: ReactNode }) {
  useEffect(() => {
    // With a captured phone there's a receipt to send — the cashier decides
    // when to close (no timer racing their tap). Otherwise, auto-dismiss.
    // Con ticket que imprimir, igual: el cajero cierra cuando termine.
    if (receiptUrl || ticketUrl) return;
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone, receiptUrl]);

  const primaryCls = "flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold transition hover:opacity-90 active:scale-[0.98]";
  const secondaryCls = "flex h-11 w-full items-center justify-center rounded-xl bg-white text-[14px] font-semibold transition hover:opacity-90";
  const ticketButton = (strong: boolean) =>
    ticketUrl ? (
      <button
        onClick={() => (onTicket ? onTicket() : window.open(ticketUrl, "_blank", "noopener,noreferrer"))}
        className={secondaryCls}
        style={{ border: `1px solid ${strong ? INK : BORDER}`, color: INK }}
      >
        Imprimir ticket
      </button>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(28,37,38,0.5)" }}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-[360px] flex-col items-center gap-3 rounded-xl bg-white px-5 py-6 text-center"
        style={{ border: `1px solid ${BORDER}` }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TILE, color: INK }} aria-hidden>
          <IconCheck />
        </div>
        <div>
          <p className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
            {mode === "now" ? "Venta cobrada" : "Cuenta abierta"}
          </p>
          <p className="mt-1 text-[22px] font-bold leading-7 tabular-nums" style={{ color: INK }}>{fmt(total)}</p>
          <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>
            {mode === "now" ? "Pedido enviado a cocina" : "La cuenta está activa"}
          </p>
        </div>
        {/* Sin tope de lealtad (8-sep): aquí ya no hay aviso de lealtad llena —
            cada venta con número suma sus puntos, gratis y sin límite. */}
        {receiptUrl && (
          <div className="mt-1 flex w-full flex-col gap-2">
            {/* El empujón (paridad con la app): el recibo es el gancho de
                regreso, no un papelito. Sin esta línea, "Nueva venta" gana. */}
            <p className="text-[14px] leading-5" style={{ color: INK_MUTED }}>
              {loyaltyLive
                ? "No olvides mandarle su recibo: ahí van sus puntos y el premio que lo hace volver."
                : "No olvides mandarle su recibo: es su ticket y tu puerta para avisarle de promos."}
            </p>
            <button
              onClick={() => {
                // WhatsApp directo al número capturado, recibo ya escrito
                // (puntos ganados + premio canjeado EN el mensaje).
                window.open(receiptUrl, "_blank", "noopener,noreferrer");
                // Stamp del embudo del recibo (docs/REFERIDOS_POR_TELEFONO.md §10).
                onReceiptTapped?.();
                onDone();
              }}
              className={primaryCls}
              style={{ background: BRAND, color: INK }}
            >
              Enviar recibo por WhatsApp
            </button>
            {/* "Avísale" (§9): si este cobro le dio un taco a quien invitó al
                cliente, el local se lo dice por WhatsApp. A mano, y nunca se
                promete que se mande solo. Si no hubo referido, no sale nada. */}
            {referralNotify}
            {ticketButton(false)}
            <button onClick={onDone} className={secondaryCls} style={{ border: `1px solid ${BORDER}`, color: INK }}>
              Nueva venta
            </button>
          </div>
        )}
        {/* Sin teléfono no hay recibo por WhatsApp, pero el ticket de
            cocina sí se imprime. */}
        {!receiptUrl && ticketUrl && (
          <div className="mt-1 flex w-full flex-col gap-2">
            {ticketButton(true)}
            <button onClick={onDone} className={primaryCls} style={{ background: BRAND, color: INK }}>
              Nueva venta
            </button>
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
  /** Premios apagados (5-sep): la Caja pide el número por el ticket, sin prometer puntos. */
  const [loyaltyLive, setLoyaltyLive] = useState(true);
  /** Doc del local (para el preview de puntos en el cobro). */
  const [restaurantData, setRestaurantData] = useState<Record<string, unknown> | null>(null);
  // Pared 3 de la Caja (8-sep): abrir una cuenta de mesa / agregarle rondas es
  // Pro. Cobrar o cerrar una cuenta que YA existe jamás se bloquea (el dinero
  // siempre entra; el pedido del comensal no tiene la culpa). El plan se lee
  // fundido con private/billing (fetchWithBilling) al arrancar.
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [ents, setEnts] = useState<Entitlements>(FREE_ENTITLEMENTS);
  const entsRef = useRef<Entitlements>(FREE_ENTITLEMENTS);
  const [wallOpen, setWallOpen] = useState(false);
  /** Qué pared enseñar: mesas (pared 3) o el ticket de cocina (23-sep, pared 4). */
  const [wallKind, setWallKind] = useState<CajaWall>("tableTabs");
  /** La acción que la pared detuvo — se repite al abrirse la puerta. */
  const pendingAction = useRef<(() => void) | null>(null);
  // 🎚️ Formas de pago que el dueño dejó prendidas en Configuración. Hasta
  // que cargue el doc, las tres (nunca una Caja sin botones).
  const [paymentOptions, setPaymentOptions] = useState<typeof POS_PAYMENT_OPTIONS>(POS_PAYMENT_OPTIONS);
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
  const [optionsFor, setOptionsFor] = useState<
    { item: MenuItem; groups: MenuItemOptionGroup[] } | null
  >(null);

  // UI state
  const [showCheckout, setShowCheckout] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<{ mode: CheckoutMode; total: number; receiptUrl?: string; ticketUrl?: string; orderId?: string; customerName?: string } | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Open tabs state
  const [activeOpenTabs, setActiveOpenTabs] = useState<any[]>([]);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [showTabsModal, setShowTabsModal] = useState(false);
  const [addingToTab, setAddingToTab] = useState<any | null>(null);
  // Llave del GRUPO en cobro (tabId, o el id de la cuenta si es pre-tabId).
  const [checkoutTabId, setCheckoutTabId] = useState<string | null>(null);
  // Las cuentas abiertas agrupadas por mesa: una fila por tabId
  // ("Mesa 5 · 3 personas · $840"). Una cuenta suelta = grupo de 1 y se ve
  // EXACTAMENTE como siempre. Núcleo puro en lib/pos/tabGroups.ts.
  const openTabGroups = useMemo(() => groupOpenTabs(activeOpenTabs as any[]), [activeOpenTabs]);

  // Modo Caja: sync con el candado del layout (el diálogo de salir vive allá).
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
      if (!u || u.isAnonymous) { router.push("/activar?modo=entrar"); return; }

      const db = getFirebaseDb();
      // Staff-aware: dueño, manager y empleado operan la caja (mismo matrix
      // que el app; las rules ya autorizan associates).
      const ctx = await resolveVendorContext(db, u.uid);
      if (!ctx) { router.push("/activar?modo=entrar"); return; }
      const rid = ctx.restaurantId;
      setVendorRole(ctx.role);

      const restSnap = await getDoc(doc(db, "restaurants", rid));
      const rData = restSnap.data() ?? {};
      setRestaurantName((rData.name as string | undefined) ?? "POS");
      setLoyaltyLive(restaurantPromisesPoints(rData));
      setRestaurantData(rData as Record<string, unknown>);
      setPaymentOptions(acceptedPaymentOptions(rData));
      try {
        const merged = await fetchWithBilling(db, rid, rData as Record<string, unknown>);
        setEnt(entitlementOf(merged));
        const es = entitlementsOf(merged, rid);
        setEnts(es);
        entsRef.current = es;
      } catch { /* sin lectura del plan: free (fail-closed), la Caja cobra igual */ }
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
    // Pared 3: agregar rondas a una mesa = llevar mesas = Pro.
    if (!entsRef.current.tableTabsAccess) {
      pendingAction.current = () => { void addItemsToTabTransaction(orderId, itemsToAdd); };
      setWallKind("tableTabs");
      setWallOpen(true);
      return;
    }
    setProcessing(true);
    try {
      const db = getFirebaseDb();
      const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId);

      // Perfiles del restaurante: se leen ANTES de la transacción para poder
      // recalcular el descuento de la cuenta con el perfil que ya traía.
      let tabProfiles: DiscountProfile[] = [];
      try {
        const rSnap = await getDoc(doc(db, "restaurants", restaurantId));
        const rdata = rSnap.data() as Record<string, unknown> | undefined;
        // Gate Pro con private/billing (migración 24-ago): el doc público ya
        // no trae los campos de suscripción.
        if (rdata && discountsEnabled(await fetchWithBilling(db, restaurantId, rdata), restaurantId)) {
          tabProfiles = parseDiscountProfiles(rdata.discountProfiles);
        }
      } catch {
        // best-effort: agregar items nunca se bloquea por el lookup
      }

      await runTransaction(db, async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists()) {
          throw new Error("La cuenta no existe.");
        }
        
        const data = orderDoc.data();
        const existingItems = data.items || [];
        
        const newItems = itemsToAdd.map(cartLineToOrderItem);

        const combinedItems = [...existingItems, ...newItems];

        // 5.1.4 — El descuento se RECALCULA sobre TODOS los items acumulados,
        // partiendo de los precios originales. Antes esto escribía
        // `total: newSubtotal` (el bruto) y BORRABA el descuento que la cuenta
        // ya traía: una pizza de $100 con 15% pasaba de cobrar $85 a cobrar
        // $150 en cuanto pedían una cerveza de $50 (lo correcto son $127.50),
        // y `discountApplied` se quedaba en el doc mintiendo.
        // Recalcular desde `items` y no desde `total` es lo que impide el
        // error opuesto: aplicar el porcentaje encima de un total ya descontado.
        const prevProfileId =
          (data.discountApplied as Record<string, unknown> | undefined)
            ?.profileId;
        const profile =
          typeof prevProfileId === "string" && prevProfileId
            ? tabProfiles.find((p) => p.id === prevProfileId) ?? null
            : null;
        const recalc = recalcTabDiscount({
          lines: tabLinesFromItems(combinedItems),
          profile,
        });

        transaction.update(orderRef, {
          items: combinedItems,
          subtotal: recalc.gross,
          total: recalc.net,
          ...(recalc.discountApplied
            ? { discountApplied: recalc.discountApplied }
            : { discountApplied: deleteField() }),
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

  async function closeTabGroup(
    group: TabGroup<any>,
    method: PaymentMethod,
    tip = 0,
    tipMethod: PaymentMethod = "cash",
    customerPhone = "",
    // 🏷️ Descuento resuelto AL CERRAR (5.1.4): lo calcula CloseTabDialog
    // sobre TODOS los items del GRUPO — lo mostrado, lo cobrado y lo
    // registrado son el mismo peso.
    recalc: TabDiscountRecalc | null = null,
  ) {
    if (!restaurantId) return;
    try {
      // ⚖️ Una sola verdad del cobro: la transacción, el reparto proporcional
      // y los puntos por ronda viven en registerPayment.ts — aquí solo la UI.
      const result = await registerTabGroupPayment({
        db: getFirebaseDb(),
        restaurantId,
        group,
        method,
        tip,
        tipMethod,
        customerPhone,
        recalc,
      });

      alert(
        result.rondas > 1
          ? `¡Cuenta pagada y cerrada! (${result.rondas} rondas de la mesa` +
            (result.creditedCount > 0 ? `, ${result.creditedCount} con puntos)` : ")")
          : "¡Cuenta pagada y cerrada!",
      );
      loadOpenTabs(restaurantId);
    } catch (err: any) {
      console.error("Error closing tab", err);
      alert(`Error al cerrar la cuenta. ${err?.message || ""}`);
    }
  }

  async function voidTabGroup(group: TabGroup<any>) {
    if (!restaurantId) return;
    const rondas = group.orders.length;
    const confirmed = confirm(
      rondas > 1
        ? `¿Cancelar la cuenta completa de ${group.label}? Son ${rondas} rondas y esta acción no se puede deshacer.`
        : "¿Estás seguro de que deseas cancelar esta cuenta? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    try {
      const db = getFirebaseDb();
      // Cancelar a medias deja rondas huérfanas cobrables: o todas o ninguna.
      await runTransaction(db, async (transaction) => {
        const refs = group.orders.map((o: any) =>
          doc(db, "restaurants", restaurantId, "orders", o.id),
        );
        for (const ref of refs) {
          const snap = await transaction.get(ref);
          if (!snap.exists() || snap.data().isOpenTab !== true) {
            throw new Error("Una ronda cambió — recarga las cuentas.");
          }
        }
        for (const ref of refs) {
          transaction.update(ref, {
            status: "cancelled",
            isOpenTab: false,
            voidReason: "cancelled_by_vendor",
            updatedAt: serverTimestamp(),
          });
        }
      });

      alert(rondas > 1 ? `¡Cuenta cancelada! (${rondas} rondas)` : "¡Cuenta cancelada!");
      loadOpenTabs(restaurantId);
    } catch (err: any) {
      console.error("Error voiding tab", err);
      alert(`Error al cancelar la cuenta. ${err?.message || ""}`);
    }
  }

  useEffect(() => {
    if (restaurantId) {
      loadMenu(restaurantId);
      loadOpenTabs(restaurantId);
      // Llegó desde Pedidos con "Cobrar en la Caja →": abrir Cuentas de una.
      try {
        if (new URLSearchParams(window.location.search).get("cuentas") === "1") {
          setShowTabsModal(true);
        }
      } catch {/* sin query — nada */}
    }
  }, [restaurantId, loadMenu, loadOpenTabs]);

  // ── Cart helpers ────────────────────────────────────────────────────────────

  /** `quantity` viene del "− 1 +" de la hoja de opciones (3 toritos de un jalón). */
  function pushLine(item: MenuItem, selected: SelectedOptionGroup[] | null, quantity = 1) {
    const lineId = buildLineId(item.id, selected);
    const unitPrice = item.price + optionsPriceDelta(selected);
    const n = Math.max(1, Math.floor(quantity));
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.lineId === lineId);
      if (idx >= 0) {
        return prev.map((c, i) =>
          i === idx ? { ...c, quantity: c.quantity + n } : c
        );
      }
      return [
        ...prev,
        {
          menuItem: item,
          quantity: n,
          lineId,
          unitPrice,
          ...(selected && selected.length > 0 ? { selectedOptions: selected } : {}),
        },
      ];
    });
  }

  /**
   * "Marcar agotados" desde la hoja de opciones: el cajero apaga o prende una
   * opción (se quedaron sin asada) sin borrarla del menú ni salir de la Caja, y
   * se aplica en TODOS los platillos que traen esa opción (10-sep-2026: La
   * Familia tiene la asada en 6 platillos; eran 6 vueltas a media venta).
   * Se guarda en `optionGroups` al momento; si el grupo venía del parser de la
   * descripción, este guardado lo vuelve la verdad (igual que el editor). El
   * menú del cliente la pinta tachada en el siguiente refresh.
   */
  const agotadosEnFila = useRef<Promise<void>>(Promise.resolve());
  function toggleOptionAvailability(groupId: string, optionId: string, available: boolean) {
    if (!optionsFor || !restaurantId) return;
    const itemId = optionsFor.item.id;
    const tocado = optionsFor.groups;
    const next = setOptionAvailability(tocado, groupId, optionId, available);
    setOptionsFor({ item: { ...optionsFor.item, optionGroups: next }, groups: next });
    // En pantalla al instante: los platillos que la Caja ya tiene cargados.
    const locales = new Map(
      applyOptionAvailabilityToMenu(
        menuItems.map((i) => ({ id: i.id, groups: i.id === itemId ? tocado : resolveOptionGroups(i) })),
        groupId,
        optionId,
        available,
      ).map((c) => [c.id, c.groups]),
    );
    setMenuItems((prev) =>
      prev.map((i) => {
        const g = locales.get(i.id);
        return g ? { ...i, optionGroups: g } : i;
      }),
    );
    // En Firestore: en fila (apagar y prender rápido no debe llegar al revés) y
    // leyendo el menú COMPLETO — también los platillos apagados, que la Caja no
    // carga — para no pisar lo que otro teléfono editó. Un solo lote.
    const rid = restaurantId;
    agotadosEnFila.current = agotadosEnFila.current.then(async () => {
      try {
        const db = getFirebaseDb();
        const menuRef = collection(db, "restaurants", rid, "menu");
        const snap = await getDocs(menuRef);
        const cambios = applyOptionAvailabilityToMenu(
          snap.docs.map((d) => ({ id: d.id, groups: resolveOptionGroups(d.data()) })),
          groupId,
          optionId,
          available,
        );
        if (cambios.length === 0) return;
        const lote = writeBatch(db);
        for (const c of cambios) lote.update(doc(menuRef, c.id), { optionGroups: c.groups });
        await lote.commit();
      } catch {
        // Sin red: el siguiente toque lo reintenta y la recarga del menú manda.
      }
    });
  }

  /** El "+" del POS. Con opciones abre la hoja; sin opciones agrega directo
   *  (lineId === menuItemId, se comporta igual que antes). */
  function addToCart(item: MenuItem) {
    const groups = resolveOptionGroups(item);
    if (groups.length > 0) {
      setOptionsFor({ item, groups });
      return;
    }
    pushLine(item, null);
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

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
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
    tipMethod: PaymentMethod = "cash",
  ) {
    if (!restaurantId || !uid) return;
    // Pared 3: abrir una cuenta de mesa desde la Caja es Pro. Cobrar ahora
    // sigue gratis y sin tope. Si la puerta se abre (prueba), se repite igual.
    if (mode === "tab" && !entsRef.current.tableTabsAccess) {
      pendingAction.current = () => {
        void confirmOrder(mode, method, customerName, customerPhone, notes, redemption, discount, tip, tipMethod);
      };
      setWallKind("tableTabs");
      setWallOpen(true);
      return;
    }
    // Last-10 (MX local): con el 52 tecleado, la orden y los puntos deben caer
    // en el MISMO phoneCustomers/{last10} que el lookup de descuentos.
    let phoneDigits = customerPhone.replace(/\D/g, "");
    if (phoneDigits.length > 10) phoneDigits = phoneDigits.slice(-10);
    // A redemption is meaningless without the phone it belongs to.
    const effectiveRedemption =
      redemption && phoneDigits.length >= 10 ? redemption : null;
    setProcessing(true);
    try {
      const db = getFirebaseDb();
      const items: Record<string, unknown>[] = cart.map(cartLineToOrderItem);

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
        ...(mode === "now" && tip > 0
          ? {
              tipAmount: Math.round(tip * 100) / 100,
              // Efectivo = el mesero ya la trae; tarjeta/transferencia = el dueño se la debe.
              // Puede diferir de paymentMethod a proposito.
              tipMethod,
            }
          : {}),
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
      let pointsAwarded = 0;
      let redemptionWasApplied = false;
      if (mode === "now" && phoneDigits.length >= 10) {
        try {
          const res = await creditPhonePointsForOrder({
            db,
            restaurantId,
            orderId: orderRef.id,
          });
          if (res.credited) {
            console.log(`[phonePoints] +${res.points} pts → ${res.phone}`);
            pointsAwarded = res.points;
            redemptionWasApplied = res.redemptionApplied === true;
          }
        } catch (e) {
          console.error("[phonePoints] POS credit failed", e);
        }
      }

      // Link de invitación para el recibo (§3): el código lo acuña el servidor.
      // Con tope de 1.2 s y sin romper nada si falla: el cobro JAMÁS espera por
      // esto, y si no llega, el recibo sale como siempre, sin la línea.
      let inviteLink: string | null = null;
      let inviteText: string | null = null;
      if (mode === "now" && phoneDigits.length >= 10) {
        try {
          const res = await Promise.race([
            fetch("/api/referral-code", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restaurantId, orderId: orderRef.id }),
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
          ]);
          if (res && res.status === 200) {
            const j = (await res.json()) as { link?: string; receiptText?: string };
            if (typeof j.link === "string" && j.link) inviteLink = j.link;
            if (typeof j.receiptText === "string" && j.receiptText) inviteText = j.receiptText;
          }
        } catch {
          // sin invitación en el recibo: el recibo sigue siendo recibo
        }
      }

      // Recibo por WhatsApp: con teléfono capturado, la pantalla de éxito
      // ofrece abrir wa.me DIRECTO al número del cliente con el recibo ya
      // escrito (mismo mensaje que Pedidos — lib/receiptWhatsapp.ts).
      const receiptUrl =
        mode === "now" && phoneDigits.length >= 10
          ? receiptWhatsappUrl({
              restaurantId,
              restaurantName,
              orderId: orderRef.id,
              customerPhone: phoneDigits,
              phoneCountryCode: phoneCountryOf(restaurantData),
              customerName: customerName.trim() || null,
              items: items.map((i) => ({
                name: String(i.name ?? ""),
                quantity: Number(i.quantity) || 1,
                price: Number(i.price) || 0,
              })),
              total: netTotal,
              redemptionName:
                redemptionWasApplied && effectiveRedemption
                  ? effectiveRedemption.name
                  : null,
              pointsAwarded,
              origin: window.location.origin,
              promisesPoints: loyaltyLive,
              inviteLink,
              inviteText,
            })
          : undefined;

      // 🖨️ Ticket para la impresora térmica (10-sep): la misma hoja que
      // Pedidos, con el pedido recién cobrado.
      // customerName va para el "Avísale" (§9): el texto dice QUIÉN vino.
      setSuccess({ mode, total: subtotal, receiptUrl, ticketUrl: `/vendor/ticket/${encodeURIComponent(orderRef.id)}`, orderId: orderRef.id, customerName: customerName.trim() || undefined });
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
          className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-3 md:px-8"
          style={{ background: "#FAF9F5", borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-[22px] font-semibold leading-[26px]" style={{ color: INK, fontFamily: SERIF }}>Caja</p>
            <p className="truncate text-[13px] leading-4" style={{ color: INK_SOFT }}>
              {restaurantName}{currentSeller ? ` · cobra ${currentSeller.name}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Modo Caja — candado kiosk para tablet compartida. Solo se
                ofrece cuando de verdad CIERRA: hace falta un Gerente activo
                con PIN para salir; sin gerente el candado se abre con un
                toque (fail-open) y es puro dedazo esperando a pasar (Zahir,
                10-sep: dueño solo, lo prendió en su celular y quedó
                encerrado). */}
            {posStaff.some((m) => m.active && m.role === "gerente") && vendorRole !== "employee" && !cajaLocked && (
              <button
                onClick={() => setLockDialogOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white transition hover:opacity-90"
                style={{ border: `1px solid ${BORDER}`, color: INK }}
                title="Modo Caja: bloquea esta pantalla a solo operación"
                aria-label="Activar Modo Caja"
              >
                <IconLock open />
              </button>
            )}
            {cajaLocked && (
              // El candado es un BOTÓN: tocarlo pide al layout el diálogo de
              // salir (PIN de gerente; sin gerentes sale directo). Antes era
              // un letrero que decía "salir desde la barra lateral" — y en el
              // celular no hay barra lateral (10-sep, Zahir encerrado).
              <button
                type="button"
                onClick={() => {
                  try {
                    window.dispatchEvent(new Event("cajaModeExitRequested"));
                  } catch {
                    /* sin listeners */
                  }
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: INK, color: "#FAF9F5" }}
                title="Modo Caja activo: toca para salir (PIN de gerente)"
                aria-label="Salir de Modo Caja"
              >
                <IconLock />
              </button>
            )}
            {/* ¿Quién cobra? — switcher del equipo (solo si hay roster) */}
            {posStaff.length > 0 && (
              <button
                onClick={() => setSellerDialogOpen(true)}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-white px-2.5 transition hover:opacity-90"
                style={{ border: `1px solid ${currentSeller ? INK : BORDER}`, color: INK }}
                aria-label="¿Quién cobra?"
              >
                <IconPerson />
                <span className="hidden text-[13px] font-semibold sm:inline">
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
              className="relative flex h-10 items-center gap-1.5 rounded-xl bg-white px-2.5 transition hover:opacity-90"
              style={{ border: `1px solid ${BORDER}`, color: INK }}
              aria-label="Cuentas abiertas"
            >
              <IconTabs />
              <span className="hidden text-[13px] font-semibold sm:inline">Cuentas</span>
              {activeOpenTabs.length > 0 && (
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: LINK }}>{activeOpenTabs.length}</span>
              )}
            </button>

            {/* Mobile cart badge */}
            <button
              className="relative flex h-10 items-center gap-2 rounded-xl px-3 md:hidden"
              style={cartCount > 0 ? { background: INK, color: "#FAF9F5" } : { background: "#FFFFFF", border: `1px solid ${BORDER}`, color: INK }}
              onClick={() => setMobileCartOpen(true)}
              aria-label="Ver carrito"
            >
              <IconCart />
              {cartCount > 0 ? (
                <span className="text-[13px] font-semibold tabular-nums">{cartCount} · {fmt(subtotal)}</span>
              ) : (
                <span className="text-[13px] font-semibold">Carrito</span>
              )}
            </button>
          </div>
        </div>

        {/* ── Body: menu + cart split ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Menu ── */}
          <div className="flex flex-1 flex-col overflow-hidden">

            {/* Search + category filter */}
            <div className="space-y-2 px-5 pb-2 pt-4 md:px-6">
              <label className="flex h-12 items-center gap-2.5 rounded-xl bg-white px-3.5" style={{ border: `1px solid ${BORDER}` }}>
                <IconSearch />
                <span className="sr-only">Buscar platillo</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar platillo"
                  className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#5B6366]"
                  style={{ color: INK }}
                />
              </label>

              {addingToTab && (
                <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-[14px]" style={{ background: "#FFFBEB", color: INK }}>
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: "#B45309" }} />Agregando a {addingToTab.customerName || `la cuenta #${addingToTab.id.slice(-4)}`}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingToTab(null);
                      clearCart();
                    }}
                    className="text-[14px] font-semibold hover:underline"
                    style={{ color: LINK }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {/* Category chips */}
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto px-5 pb-3 md:px-6" style={{ scrollbarWidth: "none" }}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="h-9 shrink-0 rounded-full px-3.5 text-[14px] transition-all"
                  style={selectedCategory === null
                    ? { background: INK, color: "#FAF9F5", border: `1px solid ${INK}`, fontWeight: 600 }
                    : { background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }}
                >
                  Todo
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                    className="h-9 shrink-0 rounded-full px-3.5 text-[14px] transition-all"
                    style={selectedCategory === cat
                      ? { background: INK, color: "#FAF9F5", border: `1px solid ${INK}`, fontWeight: 600 }
                      : { background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Menu grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-28 md:px-6 md:pb-6">
              {menuLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner size={28} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TILE }}>
                    <IconDish />
                  </div>
                  <p className="mt-4 text-[16px] font-semibold" style={{ color: INK }}>
                    {menuItems.length === 0 ? "Sin platillos" : "Sin resultados"}
                  </p>
                  <p className="mt-1 text-[14px]" style={{ color: INK_SOFT }}>
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
              background: "#FFFFFF",
              borderLeft: `1px solid ${HAIRLINE}`,
              flexShrink: 0,
            }}
          >
            {/* Cart header */}
            <div className="flex items-baseline justify-between px-5 pb-3 pt-5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <p className="text-[17px] font-semibold" style={{ color: INK, fontFamily: SERIF }}>
                Carrito{cartCount > 0 ? <span className="ml-1.5 text-[13px] font-normal tabular-nums" style={{ color: INK_SOFT, fontFamily: "inherit" }}>{cartCount}</span> : null}
              </p>
              {cart.length > 0 && (
                <button type="button" onClick={clearCart} className="text-[13px] font-semibold hover:underline" style={{ color: LINK }}>
                  Vaciar
                </button>
              )}
            </div>

            {/* Items */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TILE, color: INK_SOFT }}><IconCart /></div>
                  <p className="mt-3 text-[14px]" style={{ color: INK_SOFT }}>Toca un platillo para empezar</p>
                  {/* Pure redemption: customer came only to claim a reward. */}
                  {!addingToTab && (
                    <button
                      type="button"
                      onClick={() => setShowCheckout(true)}
                      className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3.5 text-[14px] font-semibold transition hover:opacity-90"
                      style={{ border: `1px solid ${BORDER}`, color: INK }}
                    >
                      <IconGift /> Canjear premio sin venta
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {cart.map((c, i) => (
                    <CartRow
                      key={c.lineId}
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
            <div className="space-y-3 p-5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
              <div className="flex items-baseline justify-between">
                <p className="text-[13px]" style={{ color: INK_SOFT }}>Total</p>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: INK }}>{fmt(subtotal)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (addingToTab) {
                    addItemsToTabTransaction(addingToTab.id, cart);
                  } else {
                    setShowCheckout(true);
                  }
                }}
                disabled={cart.length === 0}
                className="flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold text-[#1C2526] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                style={{ background: BRAND }}
              >
                {addingToTab ? "Actualizar cuenta" : "Cobrar"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile sticky bottom bar — bottom-[72px]: el nav móvil del layout
            vive en bottom-0 con el MISMO z-30 y la tapaba por completo (sin
            esto, la Caja móvil no tenía NINGÚN botón para cobrar). */}
        {cartCount > 0 && (
          <div
            className="fixed bottom-[72px] left-0 right-0 z-30 flex items-center gap-4 px-5 py-3 md:hidden"
            style={{ background: "#FFFFFF", borderTop: `1px solid ${HAIRLINE}` }}
          >
            <button type="button" onClick={() => setMobileCartOpen(true)} className="flex-1 text-left">
              <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>{cartCount} platillo{cartCount !== 1 ? "s" : ""} · ver carrito</p>
              <p className="text-[20px] font-bold leading-6 tabular-nums" style={{ color: INK }}>{fmt(subtotal)}</p>
            </button>
            <button
              type="button"
              onClick={() => {
                if (addingToTab) {
                  addItemsToTabTransaction(addingToTab.id, cart);
                } else {
                  setShowCheckout(true);
                }
              }}
              className="flex h-12 items-center justify-center rounded-xl px-7 text-[15px] font-semibold text-[#1C2526] transition hover:opacity-90 active:scale-[0.98]"
              style={{ background: BRAND }}
            >
              {addingToTab ? "Actualizar cuenta" : "Cobrar"}
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
            className="flex flex-col overflow-hidden rounded-t-2xl"
            style={{ background: "#FFFFFF", maxHeight: "70vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <p className="text-[17px] font-semibold" style={{ color: INK, fontFamily: SERIF }}>Carrito <span className="text-[13px] font-normal tabular-nums" style={{ color: INK_SOFT, fontFamily: "inherit" }}>{cartCount}</span></p>
              <button type="button" onClick={() => setMobileCartOpen(false)} aria-label="Cerrar" className="text-[22px] leading-none" style={{ color: INK_SOFT }}>×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {cart.map((c, i) => (
                <CartRow key={c.lineId} cartItem={c} index={i} onIncrement={increment} onDecrement={decrement} />
              ))}
              <div className="py-4">
                {cart.length > 0 && (
                  <button type="button" onClick={clearCart} className="w-full py-2 text-[14px] font-semibold hover:underline" style={{ color: LINK }}>
                    Vaciar carrito
                  </button>
                )}
              </div>
            </div>
            {/* Total + CTA (espejo del panel de escritorio): el drawer debe
                poder CERRAR la venta él solo — dependía de la barra fija de
                abajo, que el nav móvil tapaba. */}
            <div className="space-y-3 px-5 py-4" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
              <div className="flex items-baseline justify-between">
                <p className="text-[13px]" style={{ color: INK_SOFT }}>Total</p>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: INK }}>{fmt(subtotal)}</p>
              </div>
              <button
                onClick={() => {
                  setMobileCartOpen(false);
                  if (addingToTab) {
                    addItemsToTabTransaction(addingToTab.id, cart);
                  } else {
                    setShowCheckout(true);
                  }
                }}
                disabled={cart.length === 0}
                className="flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold text-[#1C2526] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                style={{ background: BRAND }}
              >
                {addingToTab ? "Actualizar cuenta" : "Cobrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Activar Modo Caja ── */}
      {lockDialogOpen && (
        <ModalFrame onBackdrop={() => setLockDialogOpen(false)} widthClass="md:w-[400px]">
          <div className="px-5 pb-5 pt-4">
            <p className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
              Activar Modo Caja
            </p>
            <p className="mt-2 text-[14px] leading-5" style={{ color: INK_MUTED }}>
              Esta pantalla queda bloqueada a <b style={{ color: INK }}>Caja, Pedidos y Escanear</b>, ideal
              para la tablet del mostrador. Para salir se necesita el PIN de un{" "}
              <b style={{ color: INK }}>Gerente</b> de tu equipo.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (restaurantId) setCajaModeLocked(restaurantId, true);
                  setCajaLocked(true);
                  setLockDialogOpen(false);
                }}
                className="flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: BRAND, color: INK }}
              >
                Activar Modo Caja
              </button>
              <button
                type="button"
                onClick={() => setLockDialogOpen(false)}
                className="flex h-11 w-full items-center justify-center text-[14px] font-semibold hover:underline"
                style={{ color: LINK }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </ModalFrame>
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

      {/* ── Opciones del platillo (salsas / extras) ── */}
      <ItemOptionsSheet
        open={optionsFor !== null}
        itemName={optionsFor?.item.name ?? ""}
        basePrice={optionsFor?.item.price ?? 0}
        groups={optionsFor?.groups ?? []}
        onCancel={() => setOptionsFor(null)}
        onConfirm={(selected, quantity) => {
          if (optionsFor) pushLine(optionsFor.item, selected, quantity);
          setOptionsFor(null);
        }}
        onToggleAvailability={toggleOptionAvailability}
      />

      {/* ── Checkout dialog ── */}
      {showCheckout && (
        <CheckoutDialog
          loyaltyLive={loyaltyLive}
          restaurantData={restaurantData}
          paymentOptions={paymentOptions}
          total={subtotal}
          cartLines={cart.map((c) => ({
            price: c.unitPrice,
            quantity: c.quantity,
            categoryName: c.menuItem.category,
          }))}
          restaurantId={restaurantId ?? ""}
          onClose={() => setShowCheckout(false)}
          onConfirm={confirmOrder}
          processing={processing}
          canAssignDiscount={vendorRole === "owner"}
          tableTabsLocked={!ents.tableTabsAccess}
          onTabsLocked={() => {
            // La pared sale al tocar "Cuenta abierta"; si se abre, el modal pasa
            // solo a ese modo y el dueño teclea el nombre. Nada que repetir.
            pendingAction.current = null;
            setWallKind("tableTabs");
      setWallOpen(true);
          }}
        />
      )}

      {/* ── Success overlay ── */}
      {success && (
        <SuccessOverlay
          loyaltyLive={loyaltyLive}
          mode={success.mode}
          total={success.total}
          receiptUrl={success.receiptUrl}
          ticketUrl={success.ticketUrl}
          onReceiptTapped={() => {
            if (restaurantId && success.orderId) void markReceiptTapped(getFirebaseDb(), restaurantId, success.orderId);
          }}
          onTicket={() => {
            const url = success.ticketUrl;
            if (!url) return;
            // Pared 4: el ticket de cocina es Pro. Si la puerta se abre, se imprime igual.
            if (!entsRef.current.kitchenPrintAccess) {
              pendingAction.current = () => window.open(url, "_blank", "noopener,noreferrer");
              setWallKind("kitchenPrint");
              setWallOpen(true);
              return;
            }
            window.open(url, "_blank", "noopener,noreferrer");
          }}
          referralNotify={
            restaurantId && success.orderId ? (
              <ReferralNotifyButton
                restaurantId={restaurantId}
                orderId={success.orderId}
                restaurantName={String(restaurantData?.name ?? "")}
                friendName={success.customerName}
                phoneCountryCode={phoneCountryOf(restaurantData)}
              />
            ) : null
          }
          onDone={() => setSuccess(null)}
        />
      )}

      {/* ── Open Tabs Modal ── */}
      {showTabsModal && (
        <OpenTabsModal
          groups={openTabGroups}
          loading={tabsLoading}
          onClose={() => setShowTabsModal(false)}
          onCloseGroup={(key) => setCheckoutTabId(key)}
          onStartAdding={(group) => {
            // Agregar productos siempre cae en el ANCLA (la ronda que fundó la
            // mesa): una sola cuenta crece, no se abren rondas por accidente.
            setAddingToTab(group.anchor);
            setShowTabsModal(false);
          }}
          onVoidGroup={(group) => voidTabGroup(group)}
        />
      )}

      {/* ── Close Tab Payment Method Selector ── */}
      {checkoutTabId && (() => {
        const group = openTabGroups.find((g) => g.key === checkoutTabId);
        if (!group) return null;
        return (
          <CloseTabDialog
            loyaltyLive={loyaltyLive}
            tabTotal={group.total}
            restaurantId={restaurantId ?? ""}
            // TODOS los items del GRUPO: la base del recálculo. El descuento
            // se resuelve desde aquí (precios originales), nunca desde el
            // total, que puede venir ya descontado.
            tabItems={group.orders.flatMap((o: any) => (Array.isArray(o.items) ? o.items : []))}
            canAssignDiscount={vendorRole === "owner"}
            paymentOptions={paymentOptions}
            onClose={() => setCheckoutTabId(null)}
            onConfirm={(method, tip, tipMethod, phone, recalc) => {
              closeTabGroup(group, method, tip, tipMethod, phone, recalc);
              setCheckoutTabId(null);
            }}
          />
        );
      })()}
      {/* ── Pared 3 (mesas) / Pared 4 (ticket de cocina): va DESPUÉS del éxito para pintarse encima ── */}
      {wallOpen && ent && restaurantId && (
        <ProWall
          wall={wallKind}
          restaurantId={restaurantId}
          entitlement={ent}
          onClose={() => {
            setWallOpen(false);
            pendingAction.current = null;
          }}
          onUnlocked={(next, nextEnt) => {
            setEnts(next);
            entsRef.current = next;
            setEnt(nextEnt);
            setWallOpen(false);
            const again = pendingAction.current;
            pendingAction.current = null;
            again?.();
          }}
        />
      )}
    </>
  );
}

// ─── Open Tabs Subcomponents ──────────────────────────────────────────────────

function OpenTabsModal({
  groups,
  loading,
  onClose,
  onCloseGroup,
  onStartAdding,
  onVoidGroup,
}: {
  groups: TabGroup<any>[];
  loading: boolean;
  onClose: () => void;
  onCloseGroup: (groupKey: string) => void;
  onStartAdding: (group: TabGroup<any>) => void;
  onVoidGroup: (group: TabGroup<any>) => void;
}) {
  return (
    <ModalFrame onBackdrop={onClose} widthClass="md:w-[500px]" maxHeight="80vh">
      <DialogHeader
        title="Cuentas abiertas"
        caption={groups.length === 1 ? "1 cuenta activa" : `${groups.length} cuentas activas`}
        onClose={onClose}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner size={24} /></div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TILE, color: INK_SOFT }} aria-hidden>
              <IconTabs />
            </div>
            <p className="mt-3 text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>Sin cuentas abiertas</p>
            <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>Las mesas que dejes pendientes de cobrar salen aquí.</p>
          </div>
        ) : (
          groups.map((group, gi) => {
            // Grupo de 1 = la fila clásica. Con varias rondas, UNA fila
            // por mesa: "Mesa 5 · 3 personas · $840" — la cocina ya vio cada
            // ronda como su ticket; aquí solo importa el cobro.
            const anchor: any = group.anchor;
            const rondas = group.orders.length;
            const itemCount = group.orders.reduce(
              (sum: number, o: any) =>
                sum + (o.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0),
              0,
            );
            const date = anchor.createdAt?.toDate ? anchor.createdAt.toDate() : new Date();
            const formattedTime = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

            return (
              <div key={group.key} className="py-4" style={{ borderTop: gi === 0 ? "none" : `1px solid ${HAIRLINE}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>{group.label}</p>
                      {rondas > 1 && (
                        <span className="inline-flex h-[24px] items-center rounded-full px-2.5 text-[12px] font-semibold" style={{ background: TILE, color: INK_MUTED }}>
                          {group.people} {group.people === 1 ? "persona" : "personas"} · {rondas} rondas
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>
                      Abierta a las {formattedTime} · {itemCount} {itemCount === 1 ? "platillo" : "platillos"}
                    </p>
                  </div>
                  <p className="shrink-0 text-[15px] font-bold tabular-nums" style={{ color: INK }}>{fmt(group.total)}</p>
                </div>

                {/* Items — con varias rondas, separadas por quién pidió */}
                <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[13px] leading-[18px]" style={{ color: INK_MUTED }}>
                  {group.orders.map((o: any, oi: number) => (
                    <div key={o.id} className="space-y-1">
                      {rondas > 1 && (
                        <p className="pt-1 font-semibold" style={{ color: INK_SOFT }}>
                          Ronda {oi + 1}{o.customerName ? ` · ${o.customerName}` : ""} · <span className="tabular-nums">{fmt(o.total || 0)}</span>
                        </p>
                      )}
                      {o.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between gap-3">
                          <span className="min-w-0 truncate">{item.quantity}x {item.name}</span>
                          <span className="shrink-0 tabular-nums">{fmt(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onVoidGroup(group)}
                    className="flex h-11 items-center justify-center px-2 text-[14px] font-semibold hover:underline"
                    style={{ color: DANGER }}
                  >
                    Cancelar cuenta
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartAdding(group)}
                    className="flex h-11 items-center justify-center rounded-xl bg-white px-3 text-[14px] font-semibold transition hover:opacity-90"
                    style={{ border: `1px solid ${BORDER}`, color: INK }}
                  >
                    Agregar platillos
                  </button>
                  <button
                    type="button"
                    onClick={() => onCloseGroup(group.key)}
                    className="flex h-11 items-center justify-center rounded-xl bg-white px-4 text-[14px] font-semibold transition hover:opacity-90"
                    style={{ border: `1px solid ${INK}`, color: INK }}
                  >
                    Cobrar cuenta
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ModalFrame>
  );
}

function CloseTabDialog({
  tabTotal,
  restaurantId,
  tabItems,
  canAssignDiscount = false,
  paymentOptions,
  onClose,
  onConfirm,
  loyaltyLive = true,
}: {
  tabTotal: number;
  restaurantId: string;
  /** Items acumulados de la cuenta (crudo de Firestore). */
  tabItems?: unknown;
  /** Owner-only: asignar descuentos especiales desde el cierre de cuenta.
   *  Un cajero con PIN no debe poder auto-descontarse. */
  canAssignDiscount?: boolean;
  /** 🎚️ Solo las formas de pago que este restaurante acepta (Configuración). */
  paymentOptions: typeof POS_PAYMENT_OPTIONS;
  onClose: () => void;
  onConfirm: (
    method: PaymentMethod,
    tip: number,
    tipMethod: PaymentMethod,
    phone: string,
    recalc: TabDiscountRecalc | null,
  ) => void;
  /** Premios apagados (5-sep): sin nada que ganar, no se prometen puntos. */
  loyaltyLive?: boolean;
}) {
  const [tipPct, setTipPct] = useState<number | null>(null);
  const [tipCustom, setTipCustom] = useState<number | "">("");
  /** null = sigue al metodo con el que cierran la cuenta. */
  const [tipMethod, setTipMethod] = useState<PaymentMethod | null>(null);
  /** 📱 Telefono capturado AL CERRAR. Es el UNICO momento del flujo de cuentas
   *  donde se puede pedir: al abrir la orden el cliente apenas esta pidiendo y
   *  no hay ticket que mandar. Sin esto un restaurante que trabaja por cuentas
   *  jamas captura un numero (Pecado Escondido: 184 ventas -> 1 telefono). */
  const [phone, setPhone] = useState("");
  const phoneDigits = phone.replace(/\D/g, "").slice(-10);
  /** 🏷️ Descuento recalculado al cerrar. null = sin perfil, el total no se mueve. */
  const [recalc, setRecalc] = useState<TabDiscountRecalc | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  // Quick-assign (DUENO): numero sin descuento + perfiles creados -> marcarlo
  // como Staff/Familia aqui mismo. Espejo del flujo del carrito y de la app.
  const [profiles, setProfiles] = useState<DiscountProfile[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignErr, setAssignErr] = useState(false);

  // El descuento se resuelve AQUÍ y no al abrir la cuenta: al abrir, el cliente
  // apenas está pidiendo y nadie teclea su teléfono. Este es el único momento
  // del flujo en que se puede aplicar — y ya con todo lo consumido enfrente.
  // Best-effort: si el lookup falla, el cobro sigue a precio normal.
  useEffect(() => {
    if (phoneDigits.length !== 10 || !restaurantId) {
      setRecalc(null);
      setProfiles([]);
      setAssignOpen(false);
      setAssignErr(false);
      return;
    }
    let cancelled = false;
    setLookingUp(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const db = getFirebaseDb();
          const [pcSnap, rSnap] = await Promise.all([
            getDoc(doc(db, "restaurants", restaurantId, "phoneCustomers", phoneDigits)),
            getDoc(doc(db, "restaurants", restaurantId)),
          ]);
          if (cancelled) return;
          const pc = pcSnap.data() as Record<string, unknown> | undefined;
          const rdata = rSnap.data() as Record<string, unknown> | undefined;
          let profile: DiscountProfile | null = null;
          let all: DiscountProfile[] = [];
          // Gate Pro con private/billing (migración 24-ago).
          if (rdata && discountsEnabled(await fetchWithBilling(db, restaurantId, rdata), restaurantId)) {
            all = parseDiscountProfiles(rdata.discountProfiles);
            const pid = pc?.discountProfileId;
            if (typeof pid === "string" && pid) {
              profile = all.find((d) => d.id === pid) ?? null;
            }
          }
          const r = recalcTabDiscount({
            lines: tabLinesFromItems(tabItems),
            profile,
          });
          if (!cancelled) {
            setRecalc(r.hasDiscount ? r : null);
            setProfiles(all);
            setAssignOpen(false);
            setAssignErr(false);
          }
        } catch {
          // el cobro nunca se bloquea por el lookup
        } finally {
          if (!cancelled) setLookingUp(false);
        }
      })();
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneDigits, restaurantId]);

  /** Quick-assign desde el cierre (DUENO): guarda el perfil en
   * phoneCustomers/{phone10} (setDoc merge crea el doc si el numero es nuevo)
   * y RECALCULA de inmediato sobre TODOS los items de la cuenta — el cajero ve
   * el badge sin reteclear el numero. Reemplaza, nunca apila: el recalculo
   * parte siempre de las lineas originales. */
  async function assignProfile(p: DiscountProfile) {
    if (phoneDigits.length !== 10 || !restaurantId) return;
    setAssignBusy(true);
    setAssignErr(false);
    try {
      await setDoc(
        doc(getFirebaseDb(), "restaurants", restaurantId, "phoneCustomers", phoneDigits),
        {
          phone: phoneDigits,
          restaurantId,
          discountProfileId: p.id,
          discountProfileName: p.name,
        },
        { merge: true },
      );
      const r = recalcTabDiscount({
        lines: tabLinesFromItems(tabItems),
        profile: p,
      });
      setRecalc(r.hasDiscount ? r : null);
      setAssignOpen(false);
      // El total acaba de cambiar: la propina se re-elige sobre el neto.
      setTipPct(null);
      setTipCustom("");
    } catch (e) {
      console.error("[closeTab/assignDiscount]", e);
      setAssignErr(true);
    } finally {
      setAssignBusy(false);
    }
  }

  /** Lo que se cobra: el neto si hay descuento, si no el total de la cuenta. */
  const netTotal = recalc?.net ?? tabTotal;
  const tip =
    tipCustom !== "" && Number(tipCustom) > 0
      ? Math.round(Number(tipCustom) * 100) / 100
      : tipPct
        ? Math.round(netTotal * tipPct) / 100
        : 0;
  return (
    <ModalFrame onBackdrop={onClose} widthClass="md:w-[400px]" z="z-[60]">
      <DialogHeader
        title="Cobrar cuenta"
        caption={
          recalc ? (
            <>
              <span className="tabular-nums" style={{ textDecoration: "line-through", color: INK_SOFT }}>{fmt(recalc.gross)}</span>{" "}
              <span className="font-bold tabular-nums" style={{ color: INK }}>{fmt(netTotal)}</span>
              {tip > 0 ? ` + propina ${fmt(tip)} = ${fmt(netTotal + tip)}` : ""}
            </>
          ) : tip > 0 ? (
            `Total ${fmt(netTotal)} + propina ${fmt(tip)} = ${fmt(netTotal + tip)}`
          ) : (
            `Total ${fmt(netTotal)}`
          )
        }
        onClose={onClose}
      />

      <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5">
        {/* Telefono PRIMERO: se pide por el TICKET (servicio que el cliente
            quiere), no por los puntos (favor que le pedimos). Los puntos se
            mencionan de pilon. */}
        <div>
          <FieldLabel htmlFor="tab-phone">¿Le mandamos su ticket por WhatsApp?</FieldLabel>
          <input
            id="tab-phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            autoFocus
            onChange={(e) => setPhone(e.target.value)}
            placeholder={loyaltyLive ? "Su ticket y sus puntos — 614 123 4567" : "Su ticket — 614 123 4567"}
            className={INPUT_CLS}
            style={INPUT_STYLE}
          />
          {lookingUp && (
            <p className="mt-1.5 text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>Buscando su descuento…</p>
          )}
          {/* El descuento, ENSEÑADO antes de cobrar: el cajero ve qué era y
              qué se va a cobrar. Sin esto el mesero no sabe que aplicó. */}
          {recalc && (
            <p className="mt-1.5 text-[14px] font-semibold leading-5 tabular-nums" style={{ color: SUCCESS }}>
              {recalc.profile?.name ?? "Descuento"}: {fmt(recalc.gross)} → {fmt(recalc.net)} (−{fmt(recalc.discount)})
            </p>
          )}
          {/* Quick-assign (DUENO): numero sin descuento + perfiles creados
              -> marcarlo como Staff/Familia sin salir del cobro. Mismo gate,
              mismo copy que el carrito y que la app. */}
          {phoneDigits.length === 10 &&
          !recalc &&
          !lookingUp &&
          canAssignDiscount &&
          profiles.length > 0 ? (
            <div className="mt-2">
              {!assignOpen ? (
                <button
                  type="button"
                  onClick={() => setAssignOpen(true)}
                  className="text-left text-[14px] font-semibold leading-5 hover:underline"
                  style={{ color: LINK }}
                >
                  ¿Staff o familia? Asignar descuento a este número
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[13px] leading-[18px]" style={{ color: INK_MUTED }}>
                    Asignar descuento (queda guardado para siempre)
                  </p>
                  {profiles.map((dp) => (
                    <button
                      key={dp.id}
                      type="button"
                      disabled={assignBusy}
                      onClick={() => assignProfile(dp)}
                      className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-white px-3 text-left text-[14px] font-semibold transition hover:opacity-80 disabled:opacity-60"
                      style={{ border: `1px solid ${BORDER}`, color: INK }}
                    >
                      <span className="min-w-0 truncate">{dp.name}</span>
                      <span className="shrink-0 text-[13px] font-normal tabular-nums" style={{ color: INK_SOFT }}>
                        {(dp.type === "total"
                          ? `${dp.totalPct ?? 0}% total`
                          : `${dp.bebidasPct ?? 0}% beb · ${dp.alimentosPct ?? 0}% alim`) +
                          (dp.earnsPoints === false ? " · sin pts" : "")}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={assignBusy}
                    onClick={() => setAssignOpen(false)}
                    className="flex h-11 w-full items-center justify-center text-[14px] font-semibold hover:underline disabled:opacity-60"
                    style={{ color: LINK }}
                  >
                    Cancelar
                  </button>
                  {assignBusy ? (
                    <p className="text-center text-[13px]" style={{ color: INK_SOFT }}>
                      Guardando…
                    </p>
                  ) : null}
                  {assignErr ? (
                    <p className="text-center text-[13px] font-semibold" style={{ color: DANGER }}>
                      No se pudo asignar. Intenta de nuevo.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
          <p
            className="mt-1.5 text-[13px] leading-[18px]"
            style={{ color: phoneDigits.length === 10 ? SUCCESS : INK_SOFT }}
          >
            {phoneDigits.length === 10
              ? (loyaltyLive ? "Le llega su ticket y junta sus puntos." : "Le llega su ticket.")
              : (loyaltyLive
                  ? "Opcional. Con su número le mandas el ticket y junta puntos solo."
                  : "Opcional. Con su número le mandas el ticket y le avisas de promos.")}
          </p>
        </div>

        <div>
          <FieldLabel>Propina (opcional)</FieldLabel>
          <div className="flex items-center gap-2">
            {[10, 15, 20].map((pct) => (
              <Seg
                key={pct}
                active={tipPct === pct && tipCustom === ""}
                onClick={() => { setTipCustom(""); setTipPct((c) => (c === pct ? null : pct)); }}
                className="flex-1 px-2 tabular-nums"
              >
                {pct}%
              </Seg>
            ))}
            <div className="flex h-11 flex-1 items-center gap-1 rounded-xl bg-white px-3" style={{ border: `1px solid ${BORDER}` }}>
              <span className="text-[14px]" style={{ color: INK_SOFT }}>$</span>
              <input
                type="number"
                min={0}
                value={tipCustom}
                placeholder="otra"
                aria-label="Otra propina"
                onChange={(e) => { setTipPct(null); setTipCustom(e.target.value === "" ? "" : Math.max(0, Number(e.target.value))); }}
                className="w-full min-w-0 bg-transparent text-[16px] font-semibold tabular-nums outline-none placeholder:text-[#5B6366]"
                style={{ color: INK }}
              />
            </div>
          </div>
          {tip > 0 && (
            <>
              <div className="mt-3">
                <FieldLabel>¿Cómo dejó la propina?</FieldLabel>
                <div className="flex items-center gap-2">
                  {paymentOptions.map((t) => (
                    <Seg key={t.key} active={tipMethod === t.key} onClick={() => setTipMethod(t.key)} className="flex-1 px-1">
                      {t.label}
                    </Seg>
                  ))}
                </div>
              </div>
              <p className="mt-1.5 text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>
                {tipMethod === null
                  ? "Si no eliges, se guarda igual que el pago de la cuenta."
                  : tipMethod === "cash"
                    ? "En efectivo el mesero ya la tiene en la mano."
                    : ""}
              </p>
            </>
          )}
        </div>

        <div>
          <FieldLabel>¿Con qué te pagó? Toca y la cuenta queda cobrada.</FieldLabel>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${paymentOptions.length}, minmax(0, 1fr))` }}>
            {paymentOptions.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() =>
                  onConfirm(
                    m.key,
                    tip,
                    // Sin elección explícita, la propina viaja igual que la cuenta.
                    tipMethod ?? m.key,
                    phoneDigits.length === 10 ? phoneDigits : "",
                    recalc,
                  )
                }
                className="flex h-14 items-center justify-center rounded-xl bg-white px-2 text-[14px] font-semibold transition hover:opacity-90 active:scale-[0.98]"
                style={{ border: `1px solid ${INK}`, color: INK }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-full items-center justify-center text-[14px] font-semibold hover:underline"
          style={{ color: LINK }}
        >
          Cancelar
        </button>
      </div>
    </ModalFrame>
  );
}
