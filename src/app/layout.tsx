import "./globals.css";
import "@/server/env"; // validate env in every server runtime

import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";

import { THEME_INIT_SCRIPT } from "@/lib/theme";

// Typography: a textbook serif for headings, IBM Plex (an engineering family) for UI text and code.
// Headings only use the semibold weight: one static file (~25 KB) instead of the 122 KB variable font
// keeps the landing page inside its Lighthouse budget.
const display = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-display",
  display: "swap",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
// Mono is rarely above the fold (units, LaTeX source): don't preload it.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Quiro Physics | AI physics tutor", template: "%s · Quiro Physics" },
  description:
    "Quiro Physics is an AI physics tutor that explains concepts, works through problems step by step and cites the pages of your own textbook.",
  applicationName: "Quiro Physics",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="focus:bg-field focus:text-on-field sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
