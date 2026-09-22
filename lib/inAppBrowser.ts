/**
 * Navegador embebido (Facebook, Instagram, Messenger, TikTok, LINE).
 *
 * Por qué existe (22-sep-2026): la pauta MENU_B2 trae dueños de Chihuahua
 * que abren /demo DENTRO del navegador de Facebook. Suben su menú, lo ven,
 * pican "Quédatelo" y el modal les ofrece "Continuar con Google". Google
 * rechaza el inicio de sesión en cualquier navegador embebido (error 403
 * disallowed_useragent, política de Google desde ~2021; redirect tampoco
 * sirve). El modal solo decía "No pudimos conectar. Intenta de nuevo." y
 * 6 de 8 que llegaron a ese paso se quedaron anónimos para siempre.
 *
 * Esto detecta el caso para que el modal NO ofrezca Google ahí y ponga el
 * correo primero. En Android, además, se puede abrir el link en Chrome con
 * un intent://; en iPhone no hay forma programática — solo instrucción.
 */

export type InAppBrowser = {
  app: 'Facebook' | 'Instagram' | 'Messenger' | 'TikTok' | 'LINE' | 'esta app';
  os: 'android' | 'ios' | 'other';
};

export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  const ua = String(userAgent || '');
  if (!ua) return null;
  const os: InAppBrowser['os'] = /Android/i.test(ua)
    ? 'android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'ios'
      : 'other';

  let app: InAppBrowser['app'] | null = null;
  if (/FB_IAB\/MESSENGER|Messenger\//i.test(ua)) app = 'Messenger';
  else if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) app = 'Facebook';
  else if (/Instagram/i.test(ua)) app = 'Instagram';
  else if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) app = 'TikTok';
  else if (/\bLine\//i.test(ua)) app = 'LINE';
  // WebView genérico de Android ("; wv)") — otra app cualquiera con navegador
  // adentro. Google lo bloquea igual.
  else if (/;\s*wv\)/.test(ua) && os === 'android') app = 'esta app';

  return app ? {app, os} : null;
}

/**
 * Link que abre la misma página en Chrome desde un navegador embebido de
 * Android. En iPhone devuelve null: ahí solo queda "⋯ → Abrir en Safari".
 */
export function chromeIntentUrl(href: string, os: InAppBrowser['os']): string | null {
  if (os !== 'android') return null;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  return (
    `intent://${u.host}${u.pathname}${u.search}${u.hash}` +
    `#Intent;scheme=https;package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(href)};end`
  );
}
