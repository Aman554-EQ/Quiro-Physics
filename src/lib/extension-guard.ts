/**
 * Some browser extensions (e.g. Urban VPN / Bitdefender style "bis_skin_checked", "bis_register",
 * "__processed_<uuid>__") write attributes into every element before React hydrates, which makes
 * React report a hydration mismatch. This inline script (runs in <head>, before hydration) strips
 * those attributes as they appear, then stops watching a few seconds after the page has loaded.
 */
export const EXTENSION_GUARD_SCRIPT = `(() => {
  try {
    const bad = (n) => n === "bis_skin_checked" || n === "bis_register" || n === "bis_use" || /^__processed_[\\w-]+__$/.test(n);
    const clean = (el) => {
      if (!el || !el.attributes) return;
      for (const a of Array.from(el.attributes)) if (bad(a.name)) el.removeAttribute(a.name);
    };
    const sweep = (root) => {
      clean(root);
      if (root.querySelectorAll) for (const el of root.querySelectorAll("*")) clean(el);
    };
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes" && r.attributeName && bad(r.attributeName)) r.target.removeAttribute(r.attributeName);
        else if (r.type === "childList") for (const n of r.addedNodes) if (n.nodeType === 1) sweep(n);
      }
    });
    mo.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    const stop = () => setTimeout(() => { sweep(document.documentElement); mo.disconnect(); }, 5000);
    if (document.readyState === "complete") stop(); else addEventListener("load", stop, { once: true });
  } catch {}
})();`;
