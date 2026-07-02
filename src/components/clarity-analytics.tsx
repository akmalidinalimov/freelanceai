import Script from "next/script";

/**
 * Microsoft Clarity (heatmaps + session recordings). Renders nothing unless
 * NEXT_PUBLIC_CLARITY_ID is set — the id is inlined AT BUILD TIME (CI image
 * build-arg), so dev/test builds carry no tracking. Privacy posture:
 * - The Clarity project runs "require cookie consent" mode → cookieless until
 *   a future cookie banner calls `window.clarity("consent")`.
 * - Masking is set to Strict in the Clarity dashboard (chats/PII never recorded).
 * - CSP: script host + beacon hosts are allowlisted in next.config.ts.
 */
export function ClarityAnalytics() {
  const id = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (!id || !/^[a-z0-9]+$/i.test(id)) return null;
  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${id}");`}
    </Script>
  );
}
