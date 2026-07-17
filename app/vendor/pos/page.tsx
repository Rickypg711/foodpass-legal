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
import { creditPhonePointsForOrder } from "@/lib/loyalty/phonePoints";
import {
  PosRedemption,
  type PosRedemptionSelection,
} from "@/components/loyalty/PosRedemption";

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

function CheckoutDialog({
  total,
  restaurantId,
  onClose,
  onConfirm,
  processing,
}: {
  total: number;
  restaurantId: string;
  onClose: () => void;
  onConfirm: (
    mode: CheckoutMode,
    method: PaymentMethod,
    name: string,
    phone: string,
    notes: string,
    redemption: PosRedemptionSelection | null,
  ) => void;
  processing: boolean;
}) {
  const [mode, setMode] = useState<CheckoutMode>("now");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [redemption, setRedemption] = useState<PosRedemptionSelection | null>(null);

  // No cart total = pure reward redemption ("Canjear premio sin venta").
  // There's nothing to charge, so we hide the payment flow and speak "canje",
  // not "cobro".
  const isRedeemOnly = total <= 0;

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
            <p className="text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>{isRedeemOnly ? "Sin venta — solo entregar premio" : `Total: ${fmt(total)}`}</p>
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
                Con su número el cliente junta puntos automáticamente. ⭐ Al
                darlo acepta el{" "}
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
            <div>
              <label className="block mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.4)" }}>Notas (opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sin cebolla, extra salsa..."
                className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none"
                style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.1)", color: "#1C2526" }}
              />
            </div>
          </div>

          {/* Confirm */}
          {redemption ? (
            <p className="text-center text-[12px] font-bold" style={{ color: "#16A34A" }}>
              🎁 Incluye: {redemption.name} GRATIS
              {redemption.points > 0 ? ` (−${redemption.points} pts)` : " (bienvenida)"}
            </p>
          ) : null}
          <button
            onClick={() => onConfirm(mode, method, name, phone, notes, redemption)}
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
                : `Cobrar ${fmt(total)}`
            ) : (
              `Abrir cuenta — ${fmt(total)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success overlay ───────────────────────────────────────────────────────────

function SuccessOverlay({ mode, total, onDone }: { mode: CheckoutMode; total: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(28,37,38,0.55)", backdropFilter: "blur(6px)" }}>
      <div
        className="flex flex-col items-center gap-4 rounded-3xl px-10 py-10 text-center"
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
  const [success, setSuccess] = useState<{ mode: CheckoutMode; total: number } | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Open tabs state
  const [activeOpenTabs, setActiveOpenTabs] = useState<any[]>([]);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [showTabsModal, setShowTabsModal] = useState(false);
  const [addingToTab, setAddingToTab] = useState<any | null>(null);
  const [checkoutTabId, setCheckoutTabId] = useState<string | null>(null);

  // ── Auth & restaurant init ──────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }

      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }

      const restSnap = await getDoc(doc(db, "restaurants", rid));
      const rData = restSnap.data() ?? {};
      setRestaurantName((rData.name as string | undefined) ?? "POS");
      setRestaurantId(rid);
      setUid(u.uid);
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

  async function closeOpenTab(orderId: string, method: PaymentMethod) {
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
      });

      // Phone Points v1: tab closed = payment confirmed → credit if the
      // order carries a customerPhone. Idempotent.
      try {
        const res = await creditPhonePointsForOrder({ db, restaurantId, orderId });
        if (res.credited) {
          console.log(`[phonePoints] +${res.points} pts → ${res.phone}`);
        }
      } catch (e) {
        console.error("[phonePoints] tab-close credit failed", e);
      }

      alert("¡Cuenta pagada y cerrada!");
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

      const orderData: Record<string, unknown> = {
        restaurantId,
        restaurantName,
        items,
        subtotal,
        total: subtotal,
        orderType: "in_store",
        orderSource: "pos",
        status: "pending",
        paymentMethod: mode === "now" ? method : "pending",
        paymentStatus: mode === "now" ? "paid" : "pending",
        isOpenTab: mode === "tab",
        createdAt: serverTimestamp(),
        createdByUserId: uid,
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

      if (customerName.trim()) orderData.customerName = customerName.trim();
      if (phoneDigits.length >= 10) orderData.customerPhone = phoneDigits;
      if (notes.trim()) orderData.notes = notes.trim();

      const orderRef = await addDoc(
        collection(db, "restaurants", restaurantId, "orders"),
        orderData,
      );

      // Phone Points v1: "cobrar ahora" = confirmed payment → credit loyalty
      // to the phone if the cashier captured it. (Open tabs credit at close.)
      if (mode === "now" && phoneDigits.length >= 10) {
        try {
          const res = await creditPhonePointsForOrder({
            db,
            restaurantId,
            orderId: orderRef.id,
          });
          if (res.credited) {
            console.log(`[phonePoints] +${res.points} pts → ${res.phone}`);
          }
        } catch (e) {
          console.error("[phonePoints] POS credit failed", e);
        }
      }

      setSuccess({ mode, total: subtotal });
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

      {/* ── Checkout dialog ── */}
      {showCheckout && (
        <CheckoutDialog
          total={subtotal}
          restaurantId={restaurantId ?? ""}
          onClose={() => setShowCheckout(false)}
          onConfirm={confirmOrder}
          processing={processing}
        />
      )}

      {/* ── Success overlay ── */}
      {success && (
        <SuccessOverlay
          mode={success.mode}
          total={success.total}
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
          onClose={() => setCheckoutTabId(null)}
          onConfirm={(method) => {
            closeOpenTab(checkoutTabId, method);
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
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (method: PaymentMethod) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-[320px] text-center space-y-4" style={{ boxShadow: "0 10px 25px rgba(28,37,38,0.15)" }} onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-extrabold text-[#1C2526]">Cobrar Cuenta</p>
        <p className="text-[13px] text-gray-400">Selecciona el método de pago del cliente</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onConfirm("cash")}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-orange-50 hover:border-[#F28C38] transition-all"
          >
            <span className="text-2xl mb-1">💵</span>
            <span className="text-[12px] font-bold text-[#1C2526]">Efectivo</span>
          </button>
          <button
            onClick={() => onConfirm("card")}
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
