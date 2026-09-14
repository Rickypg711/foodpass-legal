import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Logos de restaurantes via el optimizador de Next (/_next/image): URL
  // same-origin → la tarjeta de compartir los muestra Y los captura a PNG
  // sin pelear con CORS (Firebase Storage no manda ACAO por default).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Atajos para redes sociales. En TikTok (cuenta normal, <1,000 seguidores)
  // la bio NO es link: la gente lo TECLEA. "comeleal.com/tiktok" se teclea y
  // se dice en voz alta; al llegar, la UTM cae en AttributionCapture (30 días)
  // y el alta nace con su fuente. 307, no 308: si cambia el destino, cambia.
  async redirects() {
    return [
      {
        source: "/tiktok",
        destination: "/?utm_source=tiktok&utm_medium=bio",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
