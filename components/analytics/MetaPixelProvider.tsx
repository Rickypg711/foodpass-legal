"use client";

/**
 * MetaPixelProvider
 *
 * Responsibilities:
 *   1. Inject the Meta Pixel init snippet once via next/script (afterInteractive).
 *   2. Fire PageView on every App Router route change via usePathname.
 *   3. Render the noscript fallback image for non-JS environments.
 *
 * PageView deduplication strategy:
 *   The init snippet already includes fbq('track', 'PageView') for the initial
 *   load. The useEffect ref guard skips the first call so the initial PageView
 *   is never doubled. Every subsequent pathname change fires a fresh PageView.
 *
 * Place this component once inside RootLayout > <body>.
 * It renders null UI — only side effects and script tags.
 */

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  META_PIXEL_ID,
  buildPixelInitSnippet,
  pixelPageView,
  flushPendingPixelEvents,
} from "@/lib/meta/pixel";
import { pixelAllowedOnPath } from "@/lib/meta/pixelPaths";

export function MetaPixelProvider() {
  // Skip render entirely when pixel ID is not configured.
  // This prevents accidental tracking in local dev if the env var is absent.
  if (!META_PIXEL_ID) return null;

  return <MetaPixelInner pixelId={META_PIXEL_ID} />;
}

// Split into an inner component so the early return above works correctly
// with React rules of hooks (hooks are only in MetaPixelInner).
function MetaPixelInner({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();

  // True after the first useEffect fires.
  // The init snippet fires the first PageView; we skip the first effect call
  // to avoid sending a duplicate immediately after hydration.
  const isFirstRender = useRef(true);
  // Decidido UNA vez con la ruta de aterrizaje: si el navegador abrió directo
  // en el panel, el script del pixel ni se inyecta.
  const [allowed] = useState(() => pixelAllowedOnPath(pathname));

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // First PageView was already fired by the init snippet in the Script tag.
      return;
    }
    if (!pixelAllowedOnPath(pathname)) return;
    // Fire PageView on every subsequent App Router navigation.
    pixelPageView();
  }, [pathname]);

  if (!allowed) return null;

  const noscriptSrc = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;

  return (
    <>
      {/*
        Inline init snippet injected after the page becomes interactive.
        strategy="afterInteractive" is the correct choice for a conversion pixel:
          - Does not block first paint or server render
          - Runs before the user can interact, so no events are missed
          - Works correctly with Next.js App Router streaming
      */}
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: buildPixelInitSnippet(pixelId) }}
        onReady={flushPendingPixelEvents}
      />

      {/*
        noscript fallback — required by Meta Pixel implementation guidelines.
        Tracks PageView via 1×1 tracking pixel for users with JS disabled.
      */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={noscriptSrc}
          alt=""
        />
      </noscript>
    </>
  );
}
