"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once the page has settled.
 *
 * Registration is deferred until `load` + a short delay so it never
 * competes with first-paint resources. A failed registration (e.g. an
 * old browser, or HTTPS-only contexts in dev) is harmless and silent.
 */
export default function PwaRegister(): null {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = (): void => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          /* noop — PWA is progressive enhancement */
        });
    };

    if (document.readyState === "complete") {
      window.setTimeout(register, 1500);
    } else {
      window.addEventListener("load", () => window.setTimeout(register, 1500), {
        once: true,
      });
    }
  }, []);

  return null;
}
