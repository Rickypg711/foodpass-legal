"use client";

// Cambiar contraseña desde el panel del dueño (9-sep-2026).
// Antes la ÚNICA salida era el link "¿Olvidaste tu contraseña?" del modal de
// entrada, que solo aparecía DESPUÉS de fallar una vez — nadie lo encontraba.
// Aquí se cambia adentro, sin correo (los correos de Firebase caen en spam y
// salen en inglés hasta que se personalice el dominio). Si Firebase pide
// sesión reciente, se le pide la contraseña actual y se reintenta. Un dueño
// que entra con Google no tiene contraseña: se le dice, no se le inventa.
import { useState } from "react";
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

// Opción A (23-sep-2026): campos de 48/16px con borde, foco en tinta.
const inputCls =
  "h-12 w-full rounded-xl border border-[#D9D2C5] bg-white px-4 text-[16px] text-[#1C2526] outline-none placeholder:text-[#5B6366] focus:border-[#1C2526]";

export default function CambiarContrasenaCard() {
  const auth = getAuth();
  const user = auth.currentUser;
  const hasPassword =
    user?.providerData.some((p) => p.providerId === "password") ?? false;
  const providerName = user?.providerData.some((p) => p.providerId === "google.com")
    ? "Google"
    : user?.providerData.some((p) => p.providerId === "apple.com")
      ? "Apple"
      : null;

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [needsCurrent, setNeedsCurrent] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!user) return null;

  if (!hasPassword) {
    return (
      <p className="text-[14px]" style={{ color: "#3F4A4D" }}>
        Entras con {providerName ?? "otra cuenta"}, así que no tienes contraseña
        que cambiar.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 6) {
      setError("La contraseña nueva debe tener al menos 6 caracteres.");
      return;
    }
    if (next !== confirm) {
      setError("Las dos contraseñas no son iguales.");
      return;
    }
    const u = getAuth().currentUser;
    if (!u || !u.email) return;
    setSaving(true);
    try {
      if (needsCurrent) {
        if (!current) {
          setError("Escribe tu contraseña actual.");
          setSaving(false);
          return;
        }
        await reauthenticateWithCredential(
          u,
          EmailAuthProvider.credential(u.email, current),
        );
      }
      await updatePassword(u, next);
      setDone(true);
      setOpen(false);
      setCurrent("");
      setNext("");
      setConfirm("");
      setNeedsCurrent(false);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/requires-recent-login") {
        // Firebase quiere confirmar que eres tú: pide la actual y reintenta.
        setNeedsCurrent(true);
        setError("Por seguridad, escribe tu contraseña actual y vuelve a guardar.");
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("La contraseña actual no es correcta.");
      } else if (code === "auth/weak-password") {
        setError("La contraseña nueva es muy fácil. Usa al menos 6 caracteres.");
      } else {
        setError("No pudimos cambiar tu contraseña. Intenta de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold" style={{ color: "#1C2526" }}>
            Contraseña
          </p>
          <p className="truncate text-[13px]" style={{ color: "#5B6366" }}>
            {user.email}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => { setOpen(true); setDone(false); setError(null); }}
            className="flex h-11 shrink-0 items-center rounded-xl bg-white px-4 text-[14px] font-semibold transition hover:opacity-90"
            style={{ border: "1px solid #D9D2C5", color: "#1C2526" }}
          >
            Cambiar
          </button>
        )}
      </div>

      {done && !open && (
        <p className="text-[13px] font-semibold" style={{ color: "#15803D" }}>
          Listo, tu contraseña ya cambió. Úsala en todos tus celulares.
        </p>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          {needsCurrent && (
            <input
              type="password"
              placeholder="Contraseña actual"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              disabled={saving}
              className={inputCls}
            />
          )}
          <input
            type="password"
            placeholder="Contraseña nueva (mínimo 6 caracteres)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
            disabled={saving}
            className={inputCls}
          />
          <input
            type="password"
            placeholder="Repite la contraseña nueva"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
            disabled={saving}
            className={inputCls}
          />
          {error && (
            <p className="text-[13px]" style={{ color: "#B91C1C" }}>{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[#F28C38] text-[15px] font-semibold text-[#1C2526] transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar contraseña"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => { setOpen(false); setError(null); setNeedsCurrent(false); setCurrent(""); setNext(""); setConfirm(""); }}
              className="flex h-12 items-center rounded-xl bg-white px-4 text-[14px] font-semibold"
              style={{ border: "1px solid #D9D2C5", color: "#1C2526" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
