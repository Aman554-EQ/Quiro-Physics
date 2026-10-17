import { cva } from "class-variance-authority";

/** Button styles — plain module so Server Components can style links as buttons. */
export const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)]",
    "font-medium transition-[background-color,box-shadow,color,opacity] duration-200",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-field",
    "disabled:pointer-events-none disabled:opacity-45",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-field text-on-field shadow-[0_0_0_1px_color-mix(in_oklch,var(--field)_60%,transparent),0_10px_30px_-10px_color-mix(in_oklch,var(--field)_70%,transparent)] hover:shadow-[0_0_0_1px_var(--field),0_14px_40px_-10px_color-mix(in_oklch,var(--field)_90%,transparent)]",
        secondary:
          "bg-surface-2 text-text shadow-glow hover:bg-[color-mix(in_oklch,var(--surface-2)_80%,var(--field))]",
        ghost: "text-muted hover:bg-surface-2 hover:text-text",
        danger: "bg-danger text-bg hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-[15px]",
        lg: "h-13 px-6 text-base",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);
