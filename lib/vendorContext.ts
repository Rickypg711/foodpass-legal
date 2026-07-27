// lib/vendorContext.ts
//
// UN solo lugar para resolver "¿qué restaurante y con qué rol?" en el panel web.
// Espejo del app (lib/user/user_vendor_document.dart + team_member.dart):
//   - users/{uid}.ownedRestaurantId  → owner
//   - users/{uid}.staffRestaurantId / currentRestaurantId / restaurantId (legacy)
//     → miembro; el rol de VERDAD vive en restaurants/{rid}/members/{uid}
//     (status active, role owner|manager|employee), con fallback a
//     users/{uid}.vendorRole si el member doc no se puede leer.
// Matrix de permisos = getPermissionsForRole del app:
//   owner    → todo
//   manager  → operar + clientes/reportes/AI (no configuración, no billing)
//   employee → caja, pedidos, escanear (nada más)

import { doc, getDoc, type Firestore } from "firebase/firestore";

export type VendorRole = "owner" | "manager" | "employee";

export type VendorContext = {
  restaurantId: string;
  role: VendorRole;
};

export async function resolveVendorContext(
  db: Firestore,
  uid: string,
): Promise<VendorContext | null> {
  const userSnap = await getDoc(doc(db, "users", uid));
  const d = (userSnap.data() ?? {}) as Record<string, unknown>;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const owned = str(d.ownedRestaurantId);
  if (owned) return { restaurantId: owned, role: "owner" };

  const rid =
    str(d.staffRestaurantId) || str(d.currentRestaurantId) || str(d.restaurantId);
  if (!rid) return null;

  // Fallback role from the user doc (the app mirrors it there).
  let role: VendorRole = "employee";
  const vr = str(d.vendorRole);
  if (vr === "manager") role = "manager";
  else if (vr === "owner") role = "owner";

  // Truth: the member doc (rules let a member read their own row).
  try {
    const m = await getDoc(doc(db, "restaurants", rid, "members", uid));
    const md = (m.data() ?? {}) as Record<string, unknown>;
    if (m.exists()) {
      if (md.status !== "active") return null; // removed/suspended → sin acceso
      const r = md.role;
      role = r === "owner" || r === "manager" ? r : "employee";
    }
  } catch {
    // member doc ilegible → nos quedamos con el fallback del user doc
  }

  return { restaurantId: rid, role };
}

/** Mismo matrix que getPermissionsForRole del app, expresado como rutas. */
export function canAccessVendorPath(role: VendorRole, href: string): boolean {
  if (!href.startsWith("/vendor")) return true; // links externos/ayuda
  if (role === "owner") return true;
  if (
    href.startsWith("/vendor/pos") ||
    href.startsWith("/vendor/pedidos") ||
    href.startsWith("/vendor/scanner")
  ) {
    return true; // canProcessOrders — todo rol activo
  }
  if (role === "manager") {
    return (
      href === "/vendor" ||
      href.startsWith("/vendor/clientes") ||
      href.startsWith("/vendor/reportes") ||
      href.startsWith("/vendor/brain") ||
      href.startsWith("/vendor/recompensas")
    );
  }
  return false;
}

/** A dónde mandar a alguien que no puede ver la página que abrió. */
export function vendorHomeForRole(role: VendorRole): string {
  return role === "employee" ? "/vendor/pos" : "/vendor";
}
