import fs from "node:fs";
import path from "node:path";

import { ThemeToggle } from "@/components/shell/ThemeToggle";

import { MathGallery } from "./MathGallery";

/** Dev-only gallery of every LaTeX test fixture + a mock-streamed worked solution. */
export default function DevMathPage() {
  const dir = path.join(process.cwd(), "tests", "fixtures", "latex");
  const fixtures = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .map((name) => ({ name, content: fs.readFileSync(path.join(dir, name), "utf8") }))
    : [];
  return (
    <main id="main" className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Maths rendering gallery</h1>
          <p className="text-muted">Dev-only. {fixtures.length} fixtures from tests/fixtures/latex.</p>
        </div>
        <ThemeToggle />
      </header>
      <MathGallery fixtures={fixtures} />
    </main>
  );
}
