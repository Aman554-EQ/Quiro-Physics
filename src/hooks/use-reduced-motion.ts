"use client";

import { useSyncExternalStore } from "react";

import { MOTION_STORAGE_KEY } from "@/lib/design-tokens";

const QUERY = "(prefers-reduced-motion: reduce)";
export type MotionPreference = "system" | "reduce" | "full";

function readPreference(): MotionPreference {
  if (typeof document === "undefined") return "system";
  const attr = document.documentElement.getAttribute("data-motion");
  return attr === "reduce" || attr === "full" ? attr : "system";
}

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  window.addEventListener("prc-motion-change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    window.removeEventListener("prc-motion-change", onChange);
  };
}

function getSnapshot(): boolean {
  const pref = readPreference();
  if (pref === "reduce") return true;
  if (pref === "full") return false;
  return window.matchMedia(QUERY).matches;
}

/** True when the OS asks for reduced motion, or the user turned motion off in the app. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function setMotionPreference(pref: MotionPreference) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-motion");
  else root.setAttribute("data-motion", pref);
  try {
    if (pref === "system") localStorage.removeItem(MOTION_STORAGE_KEY);
    else localStorage.setItem(MOTION_STORAGE_KEY, pref);
  } catch {}
  window.dispatchEvent(new Event("prc-motion-change"));
}

export function toggleMotion() {
  setMotionPreference(getSnapshot() ? "full" : "reduce");
}
