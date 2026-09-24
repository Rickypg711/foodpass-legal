/* Service worker de push para el panel web de Comeleal (24-sep-2026).
 *
 * Recibe el push cuando la pestaña está cerrada o en segundo plano y, al
 * tocarlo, abre el panel (el link viene en webpush.fcmOptions.link desde
 * functions/owner_push_tokens.js). Con la pestaña abierta, Firebase entrega
 * el mensaje a la página y este archivo no hace nada.
 *
 * La config es la misma pública de lib/firebase.ts (no hay secretos aquí).
 */
/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB6JpeqOiPEFyELSHl9p64v2XPXk6uN9Xk",
  appId: "1:111825516835:web:c224c2dfd3148dcd627496",
  projectId: "foodpass-18b33",
  authDomain: "foodpass-18b33.firebaseapp.com",
  storageBucket: "foodpass-18b33.firebasestorage.app",
  messagingSenderId: "111825516835",
});

const messaging = firebase.messaging();

// Mensajes SOLO de datos (sin bloque notification) los pintamos nosotros.
// Los que traen `notification` los pinta el navegador solo.
messaging.onBackgroundMessage((payload) => {
  if (payload && payload.notification) return;
  const data = (payload && payload.data) || {};
  const title = data.title || "Comeleal";
  const body = data.body || "Tienes algo nuevo en tu panel.";
  self.registration.showNotification(title, {
    body,
    icon: "/comeleal-app-icon.png",
    data: { url: data.url || "/vendor" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const fromData = event.notification && event.notification.data && event.notification.data.url;
  const url = fromData || (event.notification && event.notification.data && event.notification.data.FCM_MSG
    && event.notification.data.FCM_MSG.fcmOptions && event.notification.data.FCM_MSG.fcmOptions.link) || "/vendor";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url && c.url.indexOf("/vendor") !== -1 && "focus" in c) return c.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
