"use client";

import { useEffect, useState, type ComponentType } from "react";

type FieldProps = { className?: string };

/**
 * Loads the particle field only after the browser is idle, so the hero text (LCP)
 * paints first and the canvas never appears in the server HTML.
 */
export function ParticleFieldLazy(props: FieldProps) {
  const [Field, setField] = useState<ComponentType<FieldProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      import("./ParticleField").then((m) => {
        if (!cancelled) setField(() => m.ParticleField);
      });
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };
    // After the page has fully loaded and gone idle: the animation is decoration and must never
    // compete with loading, hydration or the first interaction (it was the largest main-thread cost).
    const start = () => {
      if (w.requestIdleCallback) w.requestIdleCallback(load, { timeout: 3000 });
      else setTimeout(load, 1000);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
    };
  }, []);

  return Field ? <Field {...props} /> : null;
}
