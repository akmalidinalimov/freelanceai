"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * Meta (Facebook) Pixel. Renders nothing unless NEXT_PUBLIC_META_PIXEL_ID is set —
 * inlined AT BUILD TIME (CI image build-arg), so dev/test builds carry no tracking.
 * The base snippet only fires PageView on full loads; App Router navigations are
 * client-side, so we also fire PageView on every pathname change (skipping the
 * first render, which the init PageView already covers).
 * CSP: script host + beacon hosts allowlisted in next.config.ts. The future cookie
 * banner integrates via fbq("consent", "revoke"/"grant").
 */
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function MetaPixel() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  if (!PIXEL_ID || !/^\d+$/.test(PIXEL_ID)) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${PIXEL_ID}');
      fbq('track', 'PageView');`}
    </Script>
  );
}
