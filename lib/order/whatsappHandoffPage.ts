// La pestaña de WhatsApp se abre en blanco en el mismo click (si no, Safari la
// bloquea) y se le pone el wa.me cuando el pedido ya existe. Mientras tanto el
// cliente veía una pantalla blanca 1–3 segundos y no sabía si algo pasaba
// (8-oct-2026, mismo hueco que se le vio al sitio de Rebellion Pizza). Esto le
// pinta a esa pestaña qué está pasando y qué tiene que hacer.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export function whatsappHandoffHtml(restaurantName: string | null | undefined): string {
  const name = restaurantName && restaurantName.trim() ? escapeHtml(restaurantName.trim()) : "el restaurante";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Abriendo WhatsApp…</title>
<style>
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
font:16px/1.45 system-ui,-apple-system,sans-serif;background:#f6f1e8;color:#1c1917;text-align:center;padding:24px}
.s{width:44px;height:44px;border-radius:50%;border:4px solid #d9d2c5;border-top-color:#25d366;animation:r .8s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}
b{font-size:20px}
p{margin:0;max-width:300px;color:#57534e}
</style></head><body>
<div class="s" aria-hidden="true"></div>
<b>Abriendo WhatsApp…</b>
<p>Ahí solo dale enviar al mensaje para que ${name} vea tu pedido.</p>
</body></html>`;
}

/** Escribe la pantalla de espera en la pestaña recién abierta. Nunca truena. */
export function paintWhatsappHandoff(win: Window | null, restaurantName: string | null | undefined): void {
  if (!win) return;
  try {
    win.document.open();
    win.document.write(whatsappHandoffHtml(restaurantName));
    win.document.close();
  } catch {
    /* pestaña bloqueada o cerrada: el flujo sigue igual, queda el botón verde */
  }
}
