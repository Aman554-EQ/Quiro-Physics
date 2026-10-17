/** History groups (UI_UX.md §5): Pinned, Today, Yesterday, Last 7 days, Older. Local calendar days. */
export type HistoryGroup = "Pinned" | "Today" | "Yesterday" | "Last 7 days" | "Older";
export const GROUP_ORDER: HistoryGroup[] = ["Pinned", "Today", "Yesterday", "Last 7 days", "Older"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 86_400_000;

export function groupFor(item: { pinned: boolean; lastMessageAt: string }, now = new Date()): HistoryGroup {
  if (item.pinned) return "Pinned";
  const days = Math.round((startOfDay(now) - startOfDay(new Date(item.lastMessageAt))) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Last 7 days";
  return "Older";
}

export function groupConversations<T extends { pinned: boolean; lastMessageAt: string }>(items: T[], now = new Date()) {
  const groups = new Map<HistoryGroup, T[]>();
  for (const item of items) {
    const g = groupFor(item, now);
    groups.set(g, [...(groups.get(g) ?? []), item]);
  }
  return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({ group: g, items: groups.get(g)! }));
}

/** "14:05", "Mon", or "12 Oct" depending on age. */
export function shortWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  if (days <= 0) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
