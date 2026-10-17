"use client";

import { UploadCloud } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Textbook } from "@/components/physics/illustrations";
import { cn } from "@/lib/cn";
import { checkFileBeforeUpload } from "@/shared/documents";

interface DropzoneProps {
  maxSizeMb: number;
  maxPages: number;
  disabled?: boolean;
  disabledReason?: string;
  onFile: (file: File) => void;
}

/** Drag and drop or tap to pick. Wrong type and oversize files are stopped here (P3-S2-A12). */
export function Dropzone({ maxSizeMb, maxPages, disabled = false, disabledReason, onFile }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hintId = useId();

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || disabled) return;
    const problem = checkFileBeforeUpload(file, maxSizeMb);
    setMessage(problem);
    if (!problem) onFile(file);
  };

  return (
    <div>
      <button
        type="button"
        data-testid="dropzone"
        disabled={disabled}
        aria-describedby={hintId}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
        className={cn(
          "border-border bg-surface/40 flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed p-8 text-center transition-colors",
          over && "border-field bg-[color-mix(in_oklch,var(--field)_8%,transparent)]",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-[color-mix(in_oklch,var(--field)_60%,transparent)]",
        )}
      >
        <Textbook className="h-16 w-auto" />
        <span className="flex items-center gap-2 text-[15px]">
          <UploadCloud className="text-field size-4" aria-hidden />
          {disabled && disabledReason ? disabledReason : "Drop a PDF here, or tap to choose one"}
        </span>
        <span id={hintId} className="text-muted text-sm">
          PDF only · up to {maxSizeMb} MB · up to {maxPages} pages
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="file-input"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      {message && (
        <p role="alert" className="text-danger mt-2 text-sm" data-testid="dropzone-error">
          {message}
        </p>
      )}
    </div>
  );
}
