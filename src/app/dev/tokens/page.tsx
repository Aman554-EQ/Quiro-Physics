import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Button } from "@/components/ui/button";
import { COLOR_TOKEN_NAMES, COLOR_TOKENS, THEMES } from "@/lib/design-tokens";

export default function TokensPage() {
  return (
    <main id="main" className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Design tokens</h1>
          <p className="text-muted">Dev-only. Every colour token in both themes, plus type and buttons.</p>
        </div>
        <ThemeToggle />
      </header>

      <section aria-labelledby="colors" className="grid gap-6 md:grid-cols-2">
        <h2 id="colors" className="sr-only">
          Colours
        </h2>
        {THEMES.map((theme) => (
          <div
            key={theme}
            data-theme={theme}
            className="border-border bg-bg text-text rounded-[var(--radius-md)] border p-4"
          >
            <h3 className="mb-3 font-semibold">{theme === "dark" ? "Dark Matter" : "Lab Light"}</h3>
            <ul className="grid gap-2">
              {COLOR_TOKEN_NAMES.map((name) => (
                <li key={name} data-token={name} className="flex items-center gap-3 text-sm">
                  <span
                    className="border-border size-8 shrink-0 rounded-md border"
                    style={{ background: `var(--${name})` }}
                  />
                  <span className="font-mono">--{name}</span>
                  <span className="text-muted ml-auto truncate text-xs">{COLOR_TOKENS[name][theme]}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="type" className="space-y-2">
        <h2 id="type" className="text-xl font-semibold">
          Typography
        </h2>
        <p className="font-display text-3xl">Source Serif 4: Understand physics, one step at a time</p>
        <p className="font-sans">IBM Plex Sans: body text for explanations, 16 px with 1.6 line height.</p>
        <p className="font-mono">IBM Plex Mono: 9.8 m/s² · F = ma</p>
      </section>

      <section aria-labelledby="buttons" className="space-y-3">
        <h2 id="buttons" className="text-xl font-semibold">
          Buttons
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </section>
    </main>
  );
}
