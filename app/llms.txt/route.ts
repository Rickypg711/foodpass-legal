// /llms.txt — lo que ChatGPT, Claude, Perplexity y demás leen para saber qué es Comeleal (12-sep-2026).
//
// Swirvle (Monterrey, POS + lealtad desde $749) ya publica el suyo. Se arma aquí y no en public/ para que el
// precio de Pro y las páginas por tipo de negocio salgan de la misma fuente que el sitio: si cambia el precio
// o se agrega una vertical, esto cambia solo. Regla: SOLO cosas ciertas hoy (nada de "automático" en WhatsApp,
// cuentas por mesa = Pro). Candado: scripts/validate-landing-seo.mjs.
import { PRO_PRICE_LABEL } from "@/lib/subscription/pricing";
import { VERTICALES } from "@/lib/marketing/verticals";
import { SITE_URL } from "@/lib/siteMetadata";
import { PUBLIC_WHATSAPP_DISPLAY } from "@/lib/contactEmail";

export const dynamic = "force-static";

export function GET() {
  const verticales = VERTICALES.map(
    (v) => `- [${v.h1kw.charAt(0).toUpperCase()}${v.h1kw.slice(1)}](${SITE_URL}/software-para-restaurantes/${v.slug}): ${v.title.split(" — ")[0]}`,
  ).join("\n");

  const body = `# Comeleal

> Comeleal es un software para restaurantes hecho en Chihuahua, México: menú digital con QR, pedidos en línea que llegan al WhatsApp del restaurante, punto de venta (Caja) y un programa de puntos donde el número de teléfono del cliente es su tarjeta de lealtad. Es gratis para empezar, sin tarjeta y sin contrato.

## Qué es gratis

- Menú digital con QR y link propio del restaurante (fotos, precios, tamaños y opciones).
- Pedidos en línea para recoger o a domicilio: el cliente pide desde el menú y el pedido llega al WhatsApp del restaurante y a su panel. No hay comisión si le pagan en efectivo o con su terminal.
- Caja (punto de venta) en el navegador del teléfono, tablet o computadora. No hace falta comprar equipo.
- Programa de puntos sin tope: cada venta con el número del cliente le suma puntos; el cliente no tiene que descargar nada.
- Panel con clientes, ventas y reportes.
- Sugerencias con IA: quién dejó de venir, qué premio poner y el mensaje de WhatsApp para recuperar a un cliente.

## Qué cuesta

- Pagos digitales en línea con Mercado Pago: 3% por pedido. Efectivo y terminal propia: 0%.
- Pro: ${PRO_PRICE_LABEL} MXN al mes por restaurante, para cuando la Caja crece: historial completo de ventas (más de 30 días), equipo que cobra con su PIN y cuentas abiertas por mesa. Se prueba 14 días gratis sin tarjeta; si no se activa, el restaurante regresa al plan gratis sin perder nada.
- Precios: ${SITE_URL}/precios

## Cómo funciona la lealtad

- El cliente da su número al pagar (en la Caja o en el pedido en línea) y sus puntos quedan guardados en ese número.
- Recibe su recibo por link de WhatsApp, donde ve su pedido y sus puntos.
- Quien usa la app Comeleal (iOS y Android) ve sus puntos de todos sus lugares y puede recibir recordatorios para regresar.
- A los clientes que no tienen la app, el restaurante les escribe por WhatsApp desde su panel; la IA le dice a quién y le redacta el mensaje. Comeleal no manda WhatsApp por su cuenta.
- Los premios se canjean con un código personal del cliente.

## Para quién

Taquerías, pizzerías, cafeterías, comida rápida, food trucks, bares, marisquerías y dark kitchens, sobre todo negocios independientes en México. También hay restaurantes en República Dominicana y Colombia.

## Cómo empezar

- En línea: ${SITE_URL}/activar
- O por WhatsApp al ${PUBLIC_WHATSAPP_DISPLAY} (Chihuahua): el restaurante manda la foto de su menú y se lo dejan listo, gratis. Te contesta una persona.

## Páginas

- [Inicio](${SITE_URL}/): qué es Comeleal
- [Precios](${SITE_URL}/precios): plan gratis y Pro
- [Programa de lealtad para restaurantes en Chihuahua](${SITE_URL}/lealtad-restaurantes-chihuahua)
- [Programa de lealtad para restaurantes](${SITE_URL}/programa-de-lealtad-para-restaurantes)
- [Tarjeta de lealtad digital](${SITE_URL}/tarjeta-de-lealtad-digital)
- [Menú digital QR gratis](${SITE_URL}/menu-qr-gratis-restaurantes)
- [Pedidos por WhatsApp](${SITE_URL}/pedidos-whatsapp-restaurantes)
- [Pedidos en línea sin comisiones de apps](${SITE_URL}/pedidos-en-linea-restaurantes)
- [Punto de venta gratis](${SITE_URL}/punto-de-venta-gratis-restaurantes)
- [Cómo hacer que tus clientes regresen](${SITE_URL}/clientes-que-regresan)
- [Cómo vender más en un restaurante](${SITE_URL}/como-vender-mas-en-mi-restaurante)
- [Inteligencia artificial para restaurantes](${SITE_URL}/inteligencia-artificial-para-restaurantes)
- [Las mejores apps de menú digital en México](${SITE_URL}/mejores-apps-menu-digital-restaurantes): comparación con precios
- [Equipo compatible](${SITE_URL}/hardware): no hace falta comprar nada
- [Directorio de restaurantes](${SITE_URL}/restaurantes)
- [App para comensales](${SITE_URL}/descargar)

## Por tipo de negocio

- [Software para restaurantes](${SITE_URL}/software-para-restaurantes)
${verticales}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
