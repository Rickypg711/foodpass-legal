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
