import { BookOpen, FlaskConical, History, MessageCircle, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/chat" | "/history" | "/library" | "/lab" | "/settings";
  label: string;
  /** Label used in the 5-item mobile bottom nav */
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  /** Needs an account (Phase 2). Guests still reach the page and see why. */
  requiresAuth: boolean;
  keywords: string[];
}

/** Single source of truth for Sidebar, IconRail, BottomNav, MobileMenu and CommandPalette. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/chat",
    label: "Chat",
    shortLabel: "Chat",
    icon: MessageCircle,
    description: "Ask the physics tutor",
    requiresAuth: false,
    keywords: ["ask", "question", "tutor"],
  },
  {
    href: "/history",
    label: "History",
    shortLabel: "History",
    icon: History,
    description: "Your saved conversations",
    requiresAuth: true,
    keywords: ["past", "conversations", "chats"],
  },
  {
    href: "/library",
    label: "Library",
    shortLabel: "Library",
    icon: BookOpen,
    description: "Your textbooks (PDFs)",
    requiresAuth: true,
    keywords: ["pdf", "upload", "textbook", "documents"],
  },
  {
    href: "/lab",
    label: "Lab",
    shortLabel: "Lab",
    icon: FlaskConical,
    description: "Interactive physics simulations",
    requiresAuth: false,
    keywords: ["simulation", "experiment", "projectile", "pendulum"],
  },
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "Profile",
    icon: UserRound,
    description: "Preferences, theme and account",
    requiresAuth: true,
    keywords: ["profile", "account", "preferences", "theme"],
  },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function titleFor(pathname: string) {
  return NAV_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? "Quiro Physics";
}
