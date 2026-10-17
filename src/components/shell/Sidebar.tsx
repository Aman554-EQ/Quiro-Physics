"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { getTransition, spring } from "@/components/physics/motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import { SidebarContent } from "./SidebarContent";

export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_STORAGE_KEY = "prc-sidebar-collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Desktop (≥ 1024 px) sidebar, collapsible to a 72 px rail; state survives reloads. */
export function Sidebar() {
  const reduced = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  // Animate only user toggles — restoring the saved state on load must not visibly slide.
  const [animated, setAnimated] = useState(false);
  // Read persisted state after mount (localStorage is unavailable during SSR).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
    const t = setTimeout(() => setAnimated(true), 0);
    return () => clearTimeout(t);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <motion.aside
      data-testid="sidebar"
      data-collapsed={collapsed}
      aria-label="Sidebar"
      initial={false}
      animate={{ width }}
      transition={animated ? getTransition(spring.heavy, reduced) : { duration: 0 }}
      style={{ width }}
      className="border-border bg-surface/60 relative hidden shrink-0 border-r backdrop-blur-xl lg:block"
      data-print-hide
    >
      <SidebarContent collapsed={collapsed} />
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="border-border bg-surface text-muted shadow-glow hover:text-text absolute top-4 -right-3.5 grid size-7 place-items-center rounded-full border"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" aria-hidden />
        ) : (
          <PanelLeftClose className="size-4" aria-hidden />
        )}
      </button>
    </motion.aside>
  );
}
