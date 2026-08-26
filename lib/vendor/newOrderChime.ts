"use client";

// La campana del panel (hallazgo de Ricardo 26-ago): el pedido nuevo YA
// aparecía solo en la lista (onSnapshot) pero en SILENCIO — el copy del
// embudo promete "te suena en tu panel" y la app del dueño sí suena (push
// FCM LOUD), así que el panel web tiene que sonar igual. Ding-dong por
// WebAudio (cero assets, cero fetch) + parpadeo del título de la pestaña
// para el dueño que anda en otra pestaña.
//
// Autoplay: el navegador bloquea audio antes del primer gesto. primeChime()
// se cuelga de los primeros pointerdown/keydown para dejar el AudioContext
// listo; si un pedido llega antes de cualquier gesto, el ding queda en cola
// y suena en el siguiente toque (el parpadeo del título sí es inmediato).

let ctx: AudioContext | null = null;
let pendingDing = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  } catch {
    return null;
  }
}

function ding(c: AudioContext): void {
  // Dos tonos tipo timbre de mostrador: mi5 → do5, decaimiento rápido.
  const t0 = c.currentTime;
  for (const [freq, at] of [[988, 0], [784, 0.18]] as const) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.7);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + 0.75);
  }
}

/** Deja el audio listo en el primer gesto del dueño (llamar al montar). */
export function primeChime(): () => void {
  const unlock = () => {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    if (pendingDing && c.state === "running") {
      pendingDing = false;
      ding(c);
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

/** Suena el ding-dong; si el navegador aún no lo permite, queda en cola. */
export function playNewOrderChime(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    pendingDing = true;
    void c.resume().then(() => {
      if (pendingDing && c.state === "running") {
        pendingDing = false;
        ding(c);
      }
    });
    return;
  }
  ding(c);
}

let titleTimer: number | null = null;
let originalTitle: string | null = null;

/** Parpadea "🔔 Pedido nuevo" en la pestaña ~15s o hasta que el dueño vuelva. */
export function flashTabTitle(): void {
  if (typeof document === "undefined") return;
  if (titleTimer !== null) return; // ya parpadeando
  originalTitle = document.title;
  let on = false;
  titleTimer = window.setInterval(() => {
    on = !on;
    document.title = on ? "🔔 Pedido nuevo" : (originalTitle ?? "Comeleal");
  }, 1000);
  const stop = () => {
    if (titleTimer !== null) {
      window.clearInterval(titleTimer);
      titleTimer = null;
    }
    if (originalTitle !== null) document.title = originalTitle;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", stop);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") stop();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", stop);
  window.setTimeout(stop, 15000);
}
