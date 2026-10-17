"use client";

import { useEffect, useRef, useState } from "react";

import { MathMarkdown } from "@/components/math/MathMarkdown";
import { Button } from "@/components/ui/button";
import { tokenize } from "@/lib/mock/mock-transport";
import { NUMERICAL_PROJECTILE } from "@/lib/mock/scripts";

export function MathGallery({ fixtures }: { fixtures: { name: string; content: string }[] }) {
  const [streamed, setStreamed] = useState("");
  const [streaming, setStreaming] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = () => {
    if (timer.current) clearInterval(timer.current);
    const tokens = tokenize(NUMERICAL_PROJECTILE);
    let i = 0;
    setStreamed("");
    setStreaming(true);
    timer.current = setInterval(() => {
      i++;
      setStreamed(tokens.slice(0, i).join(""));
      if (i >= tokens.length) {
        clearInterval(timer.current!);
        setStreaming(false);
      }
    }, 25);
  };
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="stream-title"
        className="border-border bg-surface rounded-[var(--radius-md)] border p-5"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="stream-title" className="text-xl font-semibold">
            Streaming: projectile solution
          </h2>
          <Button variant="primary" onClick={play} data-testid="play-stream">
            {streaming ? "Restart" : "Play"}
          </Button>
        </div>
        {streamed ? (
          <MathMarkdown content={streamed} streaming={streaming} />
        ) : (
          <p className="text-muted">Press Play.</p>
        )}
      </section>
      {fixtures.map((f) => (
        <section
          key={f.name}
          data-fixture={f.name}
          className="border-border bg-surface rounded-[var(--radius-md)] border p-5"
        >
          <h2 className="text-field mb-3 font-mono text-sm">{f.name}</h2>
          <MathMarkdown content={f.content} />
        </section>
      ))}
    </div>
  );
}
