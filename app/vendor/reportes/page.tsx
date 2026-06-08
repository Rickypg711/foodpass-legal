"use client";

import Link from "next/link";

export default function ReportesPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F5F3EF" }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4"
        style={{ background: "#ffffff", borderBottom: "1px solid rgba(28,37,38,0.07)" }}>
        <Link href="/vendor" className="text-[13px] font-medium" style={{ color: "rgba(28,37,38,0.45)" }}>
          ← Panel
        </Link>
        <span style={{ color: "rgba(28,37,38,0.2)" }}>/</span>
        <h1 className="text-[15px] font-bold" style={{ color: "#1C2526" }}>Reportes</h1>
      </div>
      <main className="px-4 py-12 md:px-8">
        <div className="mx-auto max-w-lg text-center">
          <span className="text-[48px]">📊</span>
          <h2 className="mt-4 text-[20px] font-bold" style={{ color: "#1C2526" }}>
            Reportes avanzados
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(28,37,38,0.45)" }}>
            Pronto podrás ver reportes detallados de retención, tendencias semanales,
            segmentación de clientes y más. Por ahora el resumen de 7 días está en el Panel.
          </p>
          <Link href="/vendor"
            className="mt-6 inline-flex rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
            style={{ background: "#1C2526" }}>
            Ver Panel →
          </Link>
        </div>
      </main>
    </div>
  );
}
