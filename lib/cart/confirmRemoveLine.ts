export const CONFIRM_REMOVE_CART_LINE_MESSAGE =
  "¿Seguro que quieres quitar este producto del carrito?";

/** Browser confirm before removing a cart line (Eliminar only, not minus). */
export function confirmRemoveCartLine(): boolean {
  if (typeof window === "undefined") return false;
  return window.confirm(CONFIRM_REMOVE_CART_LINE_MESSAGE);
}
