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

const inputCls =
  "w-full rounded-xl border border-[#e8e6dc] bg-white px-4 py-2.5 text-sm text-[#141413] outline-none placeholder:text-[#141413]/30 focus:border-[#F28C38]";

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
      <p className="text-[13px]" style={{ color: "rgba(28,37,38,0.55)" }}>
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
          <p className="text-[13px] font-semibold" style={{ color: "#1C2526" }}>
            Contraseña
          </p>
          <p className="truncate text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
            {user.email}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => { setOpen(true); setDone(false); setError(null); }}
            className="shrink-0 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors hover:bg-[#F28C38]/10"
            style={{ border: "1px solid rgba(28,37,38,0.12)", color: "#1C2526" }}
          >
            Cambiar
          </button>
        )}
      </div>

      {done && !open && (
        <p className="text-[12px] font-semibold" style={{ color: "#15803D" }}>
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
            <p className="text-[12px] text-red-600">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#F28C38] py-2.5 text-[13px] font-bold text-[#1C2526] transition-colors hover:bg-[#c46644] disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar contraseña"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => { setOpen(false); setError(null); setNeedsCurrent(false); setCurrent(""); setNext(""); setConfirm(""); }}
              className="rounded-xl px-4 py-2.5 text-[13px] font-semibold"
              style={{ border: "1px solid rgba(28,37,38,0.12)", color: "rgba(28,37,38,0.6)" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
