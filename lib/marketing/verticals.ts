/**
 * Landings por VERTICAL (tipo de negocio) — el play que Maspedidos hace y
 * nosotros no teníamos (teardown 6 ago 2026).
 *
 * POR QUÉ: nuestras 13 páginas SEO son por FEATURE ("menú qr gratis",
 * "programa de lealtad"). El restaurantero no busca así. Busca
 * "software para taquería", "punto de venta para cafetería". Maspedidos tiene
 * 9 páginas de vertical y por eso aparece; nosotros teníamos cero.
 *
 * CÓMO AGREGAR UNA VERTICAL: agrega una entrada aquí y ya. La ruta
 * (/software-para-restaurantes/{slug}), el <h1>, el FAQ + su JSON-LD, el
 * sitemap y el interlinking salen solos. NO se duplica markup.
 */

export type Vertical = {
  slug: string;
  /** Plural, como lo escribe el dueño: "taquerías" */
  nombre: string;
  /** Para el título: "tu taquería" */
  posesivo: string;
  emoji: string;
  title: string;
  description: string;
  /** <h1>: h1pre <span naranja>h1kw</span> h1post */
  h1pre: string;
  h1kw: string;
  h1post: string;
  heroP: string;
  /** Banda oscura: el dolor específico de la vertical + ancla de precio. */
  dolorH2: string;
  dolorP: string;
  /** 6 razones concretas por las que ESTE negocio lo necesita. */
  razones: { t: string; d: string }[];
  /** FAQ propia de la vertical (se le añaden las 3 comunes automáticamente). */
  faq: { q: string; a: string }[];
};

/** FAQ que va en TODAS las verticales (precio, cobertura, equipo). */
export const FAQ_COMUN: { q: string; a: string }[] = [
  {
    q: "¿De verdad es gratis o hay letras chiquitas?",
    a: "El menú QR, el punto de venta, los pedidos, tus clientes y los reportes son gratis para siempre, sin tarjeta y sin límite de tiempo. Solo los pagos digitales en línea llevan 3% — en efectivo y con tu terminal de siempre, 0%. Si quieres la lealtad ilimitada y la recuperación automática por WhatsApp, eso es Pro: $299 al mes, y puedes probarlo 14 días gratis sin dejar tarjeta.",
  },
  {
    q: "¿Necesito comprar equipo nuevo?",
    a: "No. Funciona en el celular, la tablet o la computadora que ya tienes, desde el navegador y sin instalar nada. Si quieres impresora de tickets te decimos cuáles son compatibles y dónde salen baratas — no te vendemos hardware.",
  },
  {
    q: "¿Están en mi ciudad?",
    a: "Comeleal funciona en todo México desde el navegador y te configuramos por WhatsApp el mismo día. Si estás en Chihuahua capital, vamos en persona a dejarte todo listo.",
  },
];

export const VERTICALES: Vertical[] = [
  {
    slug: "taquerias",
    nombre: "taquerías",
    posesivo: "tu taquería",
    emoji: "🌮",
    title: "Software para taquerías — punto de venta gratis y clientes que regresan | Comeleal",
    description:
      "Punto de venta para taquerías sin mensualidad: cobra rápido en la hora pico, corta caja sin cuadrar a mano y haz que tus clientes regresen con puntos ligados a su teléfono. Gratis para operar.",
    h1pre: "Software para ",
    h1kw: "taquerías",
    h1post: " que cobra rápido y hace volver al cliente",
    heroP:
      "En una taquería el sistema o te ayuda en la hora pico o estorba. Comeleal cobra en tres toques, manda la comanda solita y guarda al cliente con su número para que regrese. <b>Gratis para operar, sin mensualidad.</b>",
    dolorH2: "Tu problema no es vender tacos. Es que el de enfrente vende los mismos.",
    dolorP:
      "En taquería casi nadie tiene menú de precios estable, todos compiten por ubicación y antojo, y el cliente que vino hoy mañana se para en la esquina de junto. Lo único que te lo amarra es que aquí acumula algo. Comeleal guarda a cada cliente con su número al momento de cobrar — sin apps, sin tarjetitas, sin trabajo extra para tu taquero — y te avisa cuándo dejó de venir. Otras plataformas cobran desde $749 MXN al mes por esto.",
    razones: [
      { t: "Cobra en la hora pico sin frenarse", d: "Los productos más vendidos quedan a un toque. Nada de buscar en menús largos cuando tienes seis personas formadas." },
      { t: "La comanda llega sola a la plancha", d: "Cada pedido sale impreso o aparece en la pantalla con lo que lleva y lo que no. Se acabó el gritar la orden y que salga mal." },
      { t: "Corte de caja a prueba de faltantes", d: "El sistema sabe cuánto entró en efectivo, cuánto en tarjeta y quién cobró cada venta. Si falta dinero, sabes de qué turno y de quién." },
      { t: "Cada taquero con su PIN", d: "Tu equipo cobra con su propio código y cada venta queda a su nombre. Ves las ventas por empleado sin preguntarle a nadie." },
      { t: "Menú QR para la mesa y para llevar", d: "Pegas el QR y el cliente pide desde su teléfono sin descargar nada. También funciona para pedidos por WhatsApp." },
      { t: "Puntos con el puro número", d: "El cliente da su teléfono al pagar y suma. A los X puntos se lleva su orden de gratis — el premio lo pones tú, con tus propios tacos." },
    ],
    faq: [
      { q: "¿Sirve para taquería de banqueta o solo para local?", a: "Para las dos. Funciona desde el celular sin instalar nada, así que un puesto de banqueta con un teléfono ya puede cobrar, imprimir con una impresora portátil y acumular puntos. No necesitas caja registradora." },
      { q: "¿Puedo manejar precios por kilo, por orden y por taco?", a: "Sí, cada producto lleva su propio precio y puedes tener variantes (orden, media orden, kilo, taco suelto). Se cobran igual de rápido." },
      { q: "¿Y si se me va el internet a media noche?", a: "El menú QR y los pedidos en línea sí necesitan internet, pero es la parte que menos usas en el mostrador. Para la venta de mostrador te recomendamos un plan de datos de respaldo en el celular de la caja — es lo más barato y lo que hacen todos." },
      { q: "¿Cómo evito que mis empleados regalen premios a sus conocidos?", a: "Cada canje pide un código personal que solo el cliente ve en su teléfono. Sin cliente presente no hay canje, y todo queda registrado con el nombre de quién lo hizo." },
    ],
  },
  {
    slug: "pizzerias",
    nombre: "pizzerías",
    posesivo: "tu pizzería",
    emoji: "🍕",
    title: "Software para pizzerías — pedidos, punto de venta y lealtad sin mensualidad | Comeleal",
    description:
      "Sistema para pizzerías: recibe pedidos a domicilio y para recoger sin comisiones de reparto, cobra en mostrador y haz que el cliente vuelva a pedirte a ti y no a la app. Gratis para operar.",
    h1pre: "Software para ",
    h1kw: "pizzerías",
    h1post: " que te quita de encima a las apps de delivery",
    heroP:
      "Cada pizza que vendes por una app de reparto te deja hasta 30% menos y el cliente nunca es tuyo. Comeleal te da tu propio canal de pedidos, tu punto de venta y un programa de puntos para que la próxima vez te pidan directo. <b>Sin comisiones de reparto.</b>",
    dolorH2: "La app de delivery no te trajo un cliente. Te rentó uno.",
    dolorP:
      "Cuando alguien te pide por una app, la app se queda con la comisión y con el número. Al mes siguiente le manda un cupón de la pizzería de junto y tú no puedes hacer nada. La pizza es el producto que más se re-pide en México, así que perder al cliente ahí duele doble. Comeleal te deja tu propio menú, tus propios pedidos y el teléfono del cliente en tu base — y cuando deja de pedir, la IA te avisa y te arma el mensaje.",
    razones: [
      { t: "Pedidos en línea sin comisión de reparto", d: "El cliente pide desde tu menú, tú cobras completo. Solo pagas 3% si el cliente paga con tarjeta en línea; en efectivo al entregar, 0%." },
      { t: "Media, entera y por rebanada", d: "Cada tamaño con su precio, y los extras se suman solos al cobrar. Sin cuentas mentales a las 10 de la noche." },
      { t: "Sugerencia de extras automática", d: "Cuando el cliente arma su pedido, el sistema le sugiere el refresco o el pan de ajo — el ticket sube solo, sin que nadie tenga que acordarse." },
      { t: "Comanda directa al horno", d: "El pedido aparece en la pantalla de cocina con todo el detalle y el tiempo corriendo. Sabes qué lleva esperando y qué ya va tarde." },
      { t: "Puntos que hacen que te pidan a ti", d: "El cliente acumula con su número en cada pedido, aquí o en línea. La pizza gratis a los X puntos la pones tú — le cuesta poco a tu margen y lo trae de vuelta." },
      { t: "Recuperación automática del que dejó de pedir", d: "Si un cliente frecuente lleva semanas sin pedir, la IA lo detecta y te deja listo el mensaje de WhatsApp para traerlo." },
    ],
    faq: [
      { q: "¿Puedo cobrar el envío?", a: "Hoy Comeleal maneja pedidos para recoger y pedidos que tú entregas con tu propio repartidor, cobrando el envío como un producto más de tu menú. El cálculo automático de envío por distancia está en camino." },
      { q: "¿Puedo tener promociones tipo 2x1 o martes de pizza?", a: "Sí. Puedes crear descuentos especiales que la caja aplica sola al cobrar, y decidir si esa venta con descuento suma puntos o no." },
      { q: "¿Sirve si ya vendo en Uber Eats o Rappi?", a: "Sí, y es justo la jugada: sigue vendiendo ahí, pero mete tu QR y tu número en la caja de la pizza. El cliente que llega por la app se pasa a tu canal directo, y ahí ya no pagas comisión ni pierdes su teléfono." },
      { q: "¿Cuánto tarda en estar listo mi menú?", a: "Si nos mandas tu menú por WhatsApp, te lo dejamos cargado el mismo día. También puedes subirlo tú: la IA lee la foto o el PDF de tu menú y lo captura sola." },
    ],
  },
  {
    slug: "cafeterias",
    nombre: "cafeterías",
    posesivo: "tu cafetería",
    emoji: "☕",
    title: "Software para cafeterías — punto de venta y programa de lealtad gratis | Comeleal",
    description:
      "Punto de venta para cafeterías y coffee shops: cobra rápido, maneja cuentas por mesa y premia al cliente que viene diario con puntos ligados a su teléfono. Sin mensualidad.",
    h1pre: "Software para ",
    h1kw: "cafeterías",
    h1post: " donde el cliente de diario es el negocio",
    heroP:
      "Una cafetería no vive del cliente nuevo, vive del que viene tres veces por semana. Comeleal cobra rápido, lleva las cuentas por mesa y le da puntos a ese cliente con su puro número — <b>gratis, sin tarjetitas de sellos.</b>",
    dolorH2: "La tarjetita de sellos se moja, se pierde y se falsifica.",
    dolorP:
      "Todas las cafeterías tienen la tarjeta del décimo café gratis, y todas tienen el mismo problema: el cliente la pierde, el barista regala sellos de más, y tú nunca sabes cuántos clientes de verdad regresan. Con Comeleal el sello es el número de teléfono: no se pierde, no se falsifica, y a fin de mes ves cuántos clientes regresaron y cuánto te dejaron. Otras plataformas cobran desde $749 MXN al mes por eso.",
    razones: [
      { t: "Cuentas abiertas por mesa", d: "Abres la cuenta, el cliente sigue pidiendo y cierras al final. Ideal para quien se queda a trabajar toda la mañana." },
      { t: "Tamaños y leches sin enredo", d: "Chico, mediano, grande, deslactosada, de avena — cada variante con su precio y sin que el barista tenga que calcular nada." },
      { t: "Puntos sin tarjetita", d: "El cliente da su teléfono y suma. El café gratis a los X puntos lo defines tú, y nadie puede falsificar sellos." },
      { t: "Propinas que sí llegan", d: "La propina se calcula sobre el neto y queda registrada por empleado, para que el reparto sea justo y sin discusiones." },
      { t: "Cada barista con su PIN", d: "Sabes quién cobró cada venta y cuánto vendió cada turno, sin estar preguntando." },
      { t: "Menú QR en cada mesa", d: "El cliente ve tu carta actualizada desde su teléfono, con fotos, y sin que tengas que reimprimir cuando subes precios." },
    ],
    faq: [
      { q: "¿Puedo vender también el grano y la mercancía?", a: "Sí, cualquier producto entra al menú: bolsas de café, tazas, pan. Se cobran en la misma caja y suman puntos igual." },
      { q: "¿Sirve para el cliente que se queda a trabajar y va pidiendo?", a: "Para eso son las cuentas abiertas: abres la cuenta a nombre de la mesa, va sumando lo que pida y cierras cuando se va. Nada se pierde en el camino." },
      { q: "¿Cómo hago que el cliente de diario se registre sin incomodarlo?", a: "Solo le pides su número al cobrar, una vez. No descarga nada ni llena formularios. La siguiente vez que dé el mismo número, sus puntos ya están ahí." },
      { q: "¿Puedo darle precio especial a mis empleados o a clientes frecuentes?", a: "Sí, con los descuentos especiales: asignas un perfil a un número de teléfono y la caja aplica el descuento sola al cobrar, sin que nadie tenga que autorizar nada." },
    ],
  },
  {
    slug: "comida-rapida",
    nombre: "negocios de comida rápida",
    posesivo: "tu negocio",
    emoji: "🍔",
    title: "Software para comida rápida — punto de venta veloz y lealtad | Comeleal",
    description:
      "Sistema de punto de venta para comida rápida: cobra en segundos, manda comandas a cocina, controla la caja por turno y haz que el cliente regrese con puntos. Gratis para operar.",
    h1pre: "Software para ",
    h1kw: "comida rápida",
    h1post: " donde cada segundo en la fila cuesta dinero",
    heroP:
      "En comida rápida la fila es el enemigo: si tardas, la gente se va. Comeleal cobra en segundos, manda la comanda sola a cocina y guarda al cliente con su número para que vuelva. <b>Gratis para operar.</b>",
    dolorH2: "Cada minuto de fila es un cliente que se dio la vuelta.",
    dolorP:
      "En este negocio compites por velocidad y por precio, y las dos cosas se te acaban tarde o temprano. Lo que no se acaba es tener al cliente identificado: saber quién viene seguido, qué pide y cuándo dejó de venir. Comeleal te da la caja veloz que necesitas hoy y la base de clientes que te va a servir el año que entra. Otras plataformas cobran desde $749 MXN al mes.",
    razones: [
      { t: "Los más vendidos siempre a la mano", d: "La caja aprende qué se vende más y lo deja a un toque. Menos búsquedas, menos errores, menos fila." },
      { t: "Comanda automática a cocina", d: "El pedido aparece en pantalla con el tiempo corriendo y lo que lleva cada uno. Se acabó el papelito perdido." },
      { t: "Combos y extras que suben el ticket", d: "El sistema sugiere el complemento al momento de armar el pedido — el ticket promedio sube sin que nadie tenga que memorizar el guion." },
      { t: "Control de caja por turno", d: "Cada turno abre y cierra su caja, y el sistema te dice cuánto debería haber. Los faltantes salen a la luz el mismo día." },
      { t: "Cada cajero con su PIN", d: "Toda venta queda a nombre de quien la cobró. Ves ventas por empleado y por turno sin pedirle cuentas a nadie." },
      { t: "Puntos con el número, sin apps", d: "Al cobrar le pides su teléfono y ya está sumando. El premio lo pones tú con tus propios productos." },
    ],
    faq: [
      { q: "¿Cuántas cajas puedo tener al mismo tiempo?", a: "Las que necesites. Cada una entra desde su propio dispositivo con su PIN y todas se ven en el mismo panel, en tiempo real." },
      { q: "¿Puedo tener varios puntos de venta o sucursales?", a: "Sí, puedes manejar varias sucursales y ver las ventas de todas juntas o por separado." },
      { q: "¿Qué tan rápido aprende mi equipo a usarlo?", a: "Está hecho para que un empleado nuevo cobre bien el primer día sin capacitación. Si prefieres, te lo dejamos configurado y le explicamos a tu equipo por WhatsApp o en persona si estás en Chihuahua." },
      { q: "¿Puedo ver cuánto vendió cada empleado?", a: "Sí, en Reportes tienes ventas por empleado y por turno, porque cada venta queda ligada al PIN de quien cobró." },
    ],
  },
  {
    slug: "food-trucks",
    nombre: "food trucks",
    posesivo: "tu food truck",
    emoji: "🚚",
    title: "Software para food trucks — punto de venta desde el celular, gratis | Comeleal",
    description:
      "Punto de venta para food trucks que funciona desde el celular sin instalar nada: cobra, corta caja, recibe pedidos por WhatsApp y acumula puntos de tus clientes aunque cambies de ubicación.",
    h1pre: "Software para ",
    h1kw: "food trucks",
    h1post: " que cabe en tu celular",
    heroP:
      "Un food truck no tiene espacio para una caja registradora ni ganas de pagar mensualidad. Comeleal corre en el celular que ya traes, cobra, corta caja y guarda a tus clientes con su número — <b>aunque mañana estés en otra esquina.</b>",
    dolorH2: "Te mueves de lugar. Tus clientes no deberían perderte.",
    dolorP:
      "El problema del food truck no es vender, es que la gente sepa dónde estás hoy y se acuerde de ti mañana. Si tus clientes solo te conocen por la esquina, cada vez que te mueves empiezas de cero. Con Comeleal cada cliente queda guardado con su número, tu menú vive en un link que siempre es el mismo, y puedes avisarles por WhatsApp dónde vas a estar. Otras plataformas cobran desde $749 MXN al mes por menos que esto.",
    razones: [
      { t: "Cero equipo, cero instalación", d: "Abres el navegador en tu celular y ya estás cobrando. No necesitas caja, ni computadora, ni que venga un técnico." },
      { t: "Tu menú en un link que no cambia", d: "Aunque te muevas de ubicación, tu menú QR es el mismo. Lo pegas en la ventanilla y lo compartes en tus historias." },
      { t: "Pedidos por WhatsApp para recoger", d: "El cliente arma su pedido desde el link y lo recoge listo. Menos fila en la ventanilla, más vueltas por hora." },
      { t: "Corte de caja sin cuadrar a mano", d: "Al cerrar te dice cuánto debería haber en efectivo. Se acabó contar billetes tratando de acordarte de las ventas." },
      { t: "Clientes que te siguen a donde vayas", d: "Cada cliente queda con su número y sus puntos. Cuando cambies de zona, sabes a quién avisarle." },
      { t: "Sin mensualidad para operar", d: "Cobrar, el menú, los pedidos y tus clientes son gratis para siempre. Solo pagas 3% si te pagan con tarjeta en línea." },
    ],
    faq: [
      { q: "¿Funciona sin internet?", a: "El cobro necesita conexión, así que lo que recomendamos es un plan de datos en el celular de la caja — es lo más barato y lo que hace todo mundo. Si sabes que vas a una zona sin señal, avísanos y te decimos cómo prepararte." },
      { q: "¿Puedo usar impresora de tickets en el truck?", a: "Sí, hay impresoras térmicas portátiles que se conectan al celular. Te decimos cuáles son compatibles y dónde salen baratas — nosotros no vendemos equipo." },
      { q: "¿Y si somos dos cobrando al mismo tiempo?", a: "Cada quien entra desde su propio celular con su PIN, y las dos ventas caen en la misma caja. Al final ves cuánto vendió cada uno." },
      { q: "¿Cómo le aviso a mis clientes dónde voy a estar?", a: "Tienes los teléfonos de todos los que te han comprado en tu lista de clientes, y puedes mandarles mensaje por WhatsApp desde el panel." },
    ],
  },
  {
    slug: "bares",
    nombre: "bares y antros",
    posesivo: "tu bar",
    emoji: "🍻",
    title: "Software para bares y antros — cuentas por mesa y control de caja | Comeleal",
    description:
      "Punto de venta para bares: cuentas abiertas por mesa, control de caja por turno, ventas por empleado y programa de lealtad. Sin mensualidad para operar.",
    h1pre: "Software para ",
    h1kw: "bares y antros",
    h1post: " donde la caja tiene que cuadrar",
    heroP:
      "En un bar el dinero se va por las grietas: cuentas mal cerradas, cortesías que nadie autorizó, faltantes que aparecen hasta el corte. Comeleal lleva cada cuenta por mesa y deja cada venta con el nombre de quien la cobró. <b>Gratis para operar.</b>",
    dolorH2: "El faltante nunca es del monto. Es de no saber de dónde salió.",
    dolorP:
      "En bar la barra se mueve rápido, hay cortesías, hay cuentas que se abren y se cierran toda la noche, y el corte casi nunca cuadra a la primera. El problema no es el dinero que falta, es no poder rastrearlo. Comeleal amarra cada venta al PIN del empleado que la cobró, registra cada descuento y cada cortesía, y te da el corte por turno con el detalle. Otras plataformas cobran desde $749 MXN al mes.",
    razones: [
      { t: "Cuentas abiertas por mesa toda la noche", d: "Abres la cuenta, va sumando todo lo que pidan y la cierras al final. Nada se queda fuera del ticket." },
      { t: "Cada quien cobra con su PIN", d: "Meseros y barra entran con su código. Cada venta, cada descuento y cada cortesía quedan con nombre y hora." },
      { t: "Corte de caja por turno", d: "El sistema sabe cuánto entró en efectivo y cuánto en tarjeta. Si el corte no cuadra, ves exactamente en qué turno y con quién." },
      { t: "Descuentos y cortesías con control", d: "Defines quién puede aplicar precios especiales y a quién. Todo queda auditado en Reportes — sin discusiones al día siguiente." },
      { t: "Propinas sobre el neto, repartidas justo", d: "La propina se calcula sobre el neto y se registra por empleado, así el reparto es claro para todos." },
      { t: "Clientes frecuentes identificados", d: "El cliente que viene cada viernes queda guardado con su número. Puedes premiarlo y avisarle cuando tengas evento." },
    ],
    faq: [
      { q: "¿Puedo tener precios distintos en hora feliz?", a: "Sí, puedes crear descuentos especiales que se aplican solos al cobrar, y decidir si esas ventas suman puntos o no." },
      { q: "¿Cómo controlo las cortesías del personal?", a: "Con los perfiles de descuento: defines quién tiene precio de staff y la caja lo aplica sola, dejando registro de cada una. En Reportes ves cuántas cortesías se dieron, de qué monto y quién las aplicó." },
      { q: "¿Sirve para llevar el inventario de las botellas?", a: "Hoy Comeleal se enfoca en la venta, la caja y los clientes; no lleva inventario de barra. Lo que sí te da es el detalle de todo lo que se vendió, que es la mitad del trabajo." },
      { q: "¿Aguanta una noche pesada con muchas mesas abiertas?", a: "Sí. Las cuentas viven en la nube y se ven desde cualquier dispositivo de tu equipo al mismo tiempo, así que la barra y los meseros trabajan sobre la misma información." },
    ],
  },
  {
    slug: "marisquerias",
    nombre: "marisquerías",
    posesivo: "tu marisquería",
    emoji: "🦐",
    title: "Software para marisquerías — cuentas por mesa, caja y lealtad | Comeleal",
    description:
      "Punto de venta para marisquerías: cuentas por mesa, precios por tamaño y kilo, control de caja y programa de puntos para el cliente de fin de semana. Gratis para operar.",
    h1pre: "Software para ",
    h1kw: "marisquerías",
    h1post: " donde el ticket es alto y el fin de semana lo es todo",
    heroP:
      "En marisquería el ticket promedio es alto y la mayor parte de la venta se concentra en tres días. Comeleal te ayuda a mover las mesas rápido, cuadrar la caja y hacer que la familia que vino este domingo regrese el otro. <b>Gratis para operar.</b>",
    dolorH2: "Ticket alto, poca frecuencia. Ahí es donde la lealtad paga más.",
    dolorP:
      "Una familia que deja mil pesos en tu marisquería y no regresa en tres meses es la pérdida más cara del negocio, porque recuperarla cuesta más que cualquier promoción. Comeleal guarda a cada cliente con su número al cobrar, y cuando lleva demasiado sin volver te avisa y te deja listo el mensaje de WhatsApp. Con tickets de este tamaño, traer de vuelta a dos familias al mes ya te pagó el sistema varias veces.",
    razones: [
      { t: "Cuentas por mesa con todo el detalle", d: "Mesas grandes, pedidos que van llegando por partes, y al final una cuenta clara. Nada se queda fuera." },
      { t: "Precios por tamaño, orden y kilo", d: "Cada variante con su precio: chico, grande, kilo, media orden. Se cobra rápido y sin cuentas mentales." },
      { t: "Comandas separadas a cocina y barra", d: "Lo de cocina va a cocina, lo de la barra a la barra, cada uno con su tiempo corriendo." },
      { t: "Corte de caja que cuadra", d: "Efectivo, tarjeta y quién cobró cada venta. El corte del domingo deja de ser un dolor de cabeza." },
      { t: "Puntos que valen para un ticket grande", d: "Con tickets altos, cada visita suma bastante. El premio que pongas se siente alcanzable y la familia regresa por él." },
      { t: "Recuperación del cliente que se enfrió", d: "La IA detecta a la familia que dejó de venir y te arma el mensaje para traerla de vuelta." },
    ],
    faq: [
      { q: "¿Puedo manejar precio por kilo y por orden del mismo producto?", a: "Sí, cada presentación es su propia opción con su precio. El cajero solo elige cuál y el sistema hace la cuenta." },
      { q: "¿Sirve para mesas grandes que piden por partes?", a: "Para eso son las cuentas abiertas: la mesa va sumando todo lo que pida durante la comida y cierras una sola vez al final." },
      { q: "¿Cómo separo comandas de cocina y de barra?", a: "Cada área puede tener su propia pantalla o su impresora, y a cada una le llega solo lo que le toca preparar." },
      { q: "¿Vale la pena la lealtad si mis clientes vienen una vez al mes?", a: "Vale más justamente por eso. En negocios de ticket alto y baja frecuencia, subir de una visita cada tres meses a una cada dos meses cambia el año completo. Y como cada visita deja mucho, el premio se alcanza rápido y se siente." },
    ],
  },
  {
    slug: "dark-kitchens",
    nombre: "dark kitchens",
    posesivo: "tu cocina",
    emoji: "🍱",
    title: "Software para dark kitchens — pedidos propios sin comisión de apps | Comeleal",
    description:
      "Sistema para dark kitchens y cocinas fantasma: tu propio canal de pedidos sin comisión de reparto, comandas digitales, varias marcas en una cocina y clientes que son tuyos.",
    h1pre: "Software para ",
    h1kw: "dark kitchens",
    h1post: " que quieren dejar de rentarle clientes a las apps",
    heroP:
      "Una dark kitchen que solo vende por apps de reparto no tiene clientes: tiene pedidos prestados que cuestan hasta 30%. Comeleal te da tu propio canal de pedidos, tus comandas y la base de clientes que sí es tuya. <b>Sin comisiones de reparto.</b>",
    dolorH2: "Si todos tus pedidos vienen de una app, no tienes negocio: tienes un proveedor.",
    dolorP:
      "El modelo de dark kitchen vive o muere por el margen, y la comisión de las apps se lo come. Peor: el cliente nunca es tuyo, así que nunca puedes bajarle el costo de adquisición. La única salida es construir canal propio en paralelo — mismo producto, mismo cliente, sin intermediario. Comeleal te da ese canal gratis y te guarda cada teléfono para que la segunda venta ya no te cueste comisión.",
    razones: [
      { t: "Tu canal directo desde el día uno", d: "Tu menú vive en un link tuyo, el cliente pide ahí y tú cobras completo. Solo 3% si paga con tarjeta en línea." },
      { t: "El teléfono del cliente es tuyo", d: "Cada pedido guarda al cliente con su número. Es el activo que las apps nunca te van a dar." },
      { t: "Comandas digitales por marca", d: "Los pedidos entran a la pantalla de cocina con todo el detalle, ordenados por tiempo de espera." },
      { t: "Reportes que te dicen qué deja margen", d: "Ves qué se vende más, por qué canal y con qué método de pago. Con eso decides qué platillo empujar y cuál matar." },
      { t: "Puntos para forzar la segunda compra", d: "El cliente que ya te compró acumula, y la segunda compra directa te sale sin comisión. Ahí está el margen." },
      { t: "Recuperación automática por WhatsApp", d: "Cuando un cliente deja de pedir, la IA lo detecta y te deja listo el mensaje. Sin volver a pagar por adquirirlo." },
    ],
    faq: [
      { q: "¿Puedo manejar varias marcas en la misma cocina?", a: "Sí, puedes tener más de un negocio en Comeleal y verlos por separado, cada uno con su menú, su link y sus clientes." },
      { q: "¿Me conviene si el 100% de mis pedidos hoy son de apps?", a: "Sobre todo en ese caso. No se trata de dejar las apps de golpe, sino de meter tu QR y tu link en cada empaque que sale. El cliente que ya te probó por la app se pasa a tu canal, y esa segunda venta ya no paga comisión." },
      { q: "¿Cómo entrego si no tengo repartidores?", a: "Puedes trabajar solo pedidos para recoger, o entregar con tu propio repartidor y cobrar el envío como un producto más del menú." },
      { q: "¿Necesito local a la calle para aparecer en Google?", a: "No. Comeleal te genera una página pública de tu marca con tu menú, que sí se indexa en Google. Es de las pocas formas de existir en búsquedas sin tener local a pie de calle." },
    ],
  },
];

export function verticalBySlug(slug: string): Vertical | undefined {
  return VERTICALES.find((v) => v.slug === slug);
}

export const VERTICAL_SLUGS = VERTICALES.map((v) => v.slug);
