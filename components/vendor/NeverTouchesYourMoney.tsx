// Robo #2 a Biomenus: su movimiento de venta más fuerte es hacer los pagos
// OPCIONALES y decirlo a gritos ("Biomenus never touches your cash flow").
// Comeleal ya ERA así por dentro — efectivo y terminal 0%, el cobro en línea
// es opcional y hasta el dinero en línea cae directo en la cuenta de Mercado
// Pago DEL restaurante (modelo collector: nunca pasa por una cuenta nuestra).
// Solo que lo decíamos como letra chica defensiva. Esto lo vuelve titular.
//
// REGLA DE HONESTIDAD (memoria comisión-MP): el 3% en línea se dice CON la
// tarifa propia de Mercado Pago — que el dueño lo oiga de nosotros antes de
// descubrirlo en su estado de cuenta.

export function NeverTouchesYourMoney() {
  return (
    <section className="px-5 py-14" aria-labelledby="ntym-title">
      <div
        className="mx-auto max-w-3xl rounded-3xl px-6 py-10 text-center sm:px-10"
        style={{ background: "#1C2526" }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F28C38]">
          La regla de la casa
        </p>
        <h2
          id="ntym-title"
          className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
        >
          Comeleal nunca toca tu dinero.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/75">
          Cobra en efectivo o con tu terminal de siempre y la comisión es{" "}
          <b className="text-white">0% — hoy y siempre</b>. El cobro en línea es{" "}
          <b className="text-white">opcional</b>: si lo prendes, el dinero cae
          directo en <b className="text-white">tu</b> cuenta de Mercado Pago, no
          en la nuestra (3% de Comeleal más la tarifa propia de Mercado Pago,
          solo en esas ventas). Las apps de delivery cobran hasta 30% y el
          cliente es de ellas, no tuyo.
        </p>
        <div className="mx-auto mt-7 grid max-w-lg grid-cols-3 gap-3 text-center">
          {[
            ["0%", "efectivo y terminal"],
            ["Opcional", "cobro en línea"],
            ["Directo a ti", "sin pasar por nosotros"],
          ].map(([big, small]) => (
            <div
              key={small}
              className="rounded-2xl px-2 py-4"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <p className="text-lg font-extrabold text-[#F28C38]">{big}</p>
              <p className="mt-1 text-[11px] leading-tight text-white/60">{small}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
