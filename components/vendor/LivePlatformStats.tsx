// El número del titular, VIVO — no de folleto. Biomenus pone "+2€ por mesa"
// y confiesa "ilustrativo"; aquí el dato se calcula contra Firestore al
// render y si no se puede calcular, la sección no existe. Server component:
// úsalo solo desde páginas server.

import { fetchPlatformStats } from "@/lib/server/platformStats";

const fmt = new Intl.NumberFormat("es-MX");

export async function LivePlatformStats() {
  const stats = await fetchPlatformStats();
  if (!stats || stats.dishesOnline < 100) return null;

  return (
    <section className="px-5 pb-4">
      <p className="mx-auto max-w-2xl text-center text-[14px] leading-relaxed text-[#1C2526]/60">
        Ahora mismo hay{" "}
        <b className="text-[#1C2526]">{fmt.format(stats.dishesOnline)} platillos</b>{" "}
        en línea de{" "}
        <b className="text-[#1C2526]">{fmt.format(stats.activeRestaurants)} cocinas
        de Chihuahua</b> en Comeleal.{" "}
        <span className="text-[#1C2526]/40">
          (Dato vivo, calculado al cargar esta página — no es un número de folleto.)
        </span>
      </p>
    </section>
  );
}
