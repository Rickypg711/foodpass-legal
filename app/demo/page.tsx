"use client";

// La puerta de entrada v2 (STRATEGY_MENU_FIRST §6): el prospecto sube la
// foto de su menú ANTES de que le pidamos nada. Móvil primero — la misma
// cámara con la que le toma foto al menú de papel. Cero campos obligatorios
// antes del valor.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_DEMO_PHOTOS,
  createDemoJob,
  recallDemoJob,
} from "@/lib/demo/demoJobs";

export default function DemoUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);

  // §6.7: su demo lo espera en su mismo celular — reanudar, no repetir.
  useEffect(() => {
    setResumeId(recallDemoJob());
  }, []);

  function pick(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_DEMO_PHOTOS);
    if (imgs.length > 0) {
      setFiles(imgs);
      setError(null);
    }
  }

  async function handleSubmit() {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const digits = whatsapp.replace(/\D/g, "").slice(-10);
      const jobId = await createDemoJob(
        files,
        digits.length === 10 ? digits : null,
      );
      router.push(`/demo/${jobId}`);
    } catch (e) {
      console.error("[demo] create", e);
      setError("No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "#faf9f5" }}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: "rgba(28,37,38,0.4)" }}>
          Comeleal · para restaurantes
        </p>
        <h1 className="mt-3 text-[30px] font-extrabold leading-tight"
          style={{ color: "#1C2526" }}>
          📸 Sube la foto de tu menú
          <span className="block" style={{ color: "#F28C38" }}>
            y velo digital en 1 minuto.
          </span>
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed"
          style={{ color: "rgba(28,37,38,0.6)" }}>
          Tus platillos, tus precios, tus salsas y tamaños — leídos de tu
          menú de papel y montados como menú digital profesional.{" "}
          <b>Gratis y sin tarjeta — y para verlo no necesitas ni cuenta.</b>
        </p>

        {/* Cámara directa (capture) — el flujo del celular del taquero. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mt-6 w-full rounded-2xl border-2 border-dashed px-5 py-8 text-center transition disabled:opacity-60"
          style={{ borderColor: "rgba(242,140,56,0.5)", background: "#fff" }}
        >
          {files.length === 0 ? (
            <>
              <span className="block text-4xl">📷</span>
              <span className="mt-2 block text-[15px] font-bold"
                style={{ color: "#1C2526" }}>
                Tomar foto o elegir de galería
              </span>
              <span className="mt-1 block text-[12px]"
                style={{ color: "rgba(28,37,38,0.45)" }}>
                Hasta {MAX_DEMO_PHOTOS} fotos · que se lean los precios
              </span>
            </>
          ) : (
            <>
              <span className="block text-3xl">
                {"🖼️".repeat(files.length)}
              </span>
              <span className="mt-2 block text-[15px] font-bold"
                style={{ color: "#1C2526" }}>
                {files.length} foto{files.length > 1 ? "s" : ""} lista
                {files.length > 1 ? "s" : ""}
              </span>
              <span className="mt-1 block text-[12px]"
                style={{ color: "#B45309" }}>
                Toca para cambiar
              </span>
            </>
          )}
        </button>

        <label className="mt-5 block">
          <span className="text-[12px] font-semibold"
            style={{ color: "rgba(28,37,38,0.55)" }}>
            📱 Tu WhatsApp <span style={{ color: "rgba(28,37,38,0.35)" }}>(opcional)</span> —
            para que no pierdas tu menú: te avisamos antes de que tu vista
            previa se borre
          </span>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="614 123 4567"
            disabled={busy}
            className="mt-1.5 w-full rounded-xl border px-4 py-3 text-[15px] outline-none focus:ring-2 disabled:opacity-60"
            style={{ borderColor: "rgba(28,37,38,0.12)", background: "#fff", color: "#1C2526" }}
          />
        </label>

        {error && (
          <p className="mt-3 text-[13px] font-semibold" style={{ color: "#B91C1C" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={files.length === 0 || busy}
          className="mt-5 w-full rounded-2xl px-5 py-4 text-[16px] font-extrabold transition disabled:opacity-40"
          style={{ background: "#F28C38", color: "#1C2526" }}
        >
          {busy ? "Subiendo tu menú…" : "Ver mi menú digital →"}
        </button>
        <p className="mt-2 text-center text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>
          Gratis · Sin tarjeta · ~1 minuto
        </p>

        {resumeId && !busy && (
          <button
            type="button"
            onClick={() => router.push(`/demo/${resumeId}`)}
            className="mt-6 w-full rounded-xl border px-4 py-3 text-[13px] font-bold"
            style={{ borderColor: "rgba(28,37,38,0.15)", color: "#1C2526", background: "#fff" }}
          >
            ▶️ Continúa donde te quedaste — tu menú te espera
          </button>
        )}
      </div>
    </main>
  );
}
