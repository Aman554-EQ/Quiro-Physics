"use client";

import { useSyncExternalStore } from "react";

import { setMotionPreference, type MotionPreference } from "@/hooks/use-reduced-motion";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/cn";

function readMotionPref(): MotionPreference {
  const v = document.documentElement.getAttribute("data-motion");
  return v === "reduce" || v === "full" ? v : "system";
}
function subscribeMotion(cb: () => void) {
  window.addEventListener("prc-motion-change", cb);
  return () => window.removeEventListener("prc-motion-change", cb);
}

function Choice<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: { value: T; label: string; hint: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="border-border bg-surface/70 rounded-[var(--radius-md)] border p-4">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "border-border has-[:focus-visible]:outline-field flex min-h-11 cursor-pointer flex-col rounded-[var(--radius-sm)] border px-3 py-2.5 has-[:focus-visible]:outline-2",
              value === o.value && "border-field bg-[color-mix(in_oklch,var(--field)_10%,transparent)]",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className="text-[15px]">{o.label}</span>
            <span className="text-muted text-xs">{o.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AppearanceSettings() {
  const [theme, setTheme] = useTheme();
  const motion = useSyncExternalStore(subscribeMotion, readMotionPref, () => "system" as MotionPreference);
  return (
    <section aria-labelledby="appearance-title" className="space-y-3">
      <h2 id="appearance-title" className="text-lg font-semibold">
        Appearance
      </h2>
      <Choice
        name="theme"
        legend="Theme"
        value={theme}
        onChange={setTheme}
        options={[
          { value: "dark", label: "Dark Matter", hint: "Deep space, cyan field lines" },
          { value: "light", label: "Lab Light", hint: "Paper white, ink navy" },
        ]}
      />
      <Choice
        name="motion"
        legend="Motion"
        value={motion}
        onChange={setMotionPreference}
        options={[
          { value: "system", label: "Follow device", hint: "Uses your OS setting" },
          { value: "full", label: "Full motion", hint: "Springs and particle field" },
          { value: "reduce", label: "Reduced", hint: "Simple fades, static field" },
        ]}
      />
    </section>
  );
}
