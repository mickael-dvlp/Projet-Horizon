// Priorités partagées entre livres, chapitres et scènes.
export const PRIORITY_OPTIONS = [
  {
    value: "low",
    label: "Faible",
    dot: "bg-slate-400",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  },
  {
    value: "medium",
    label: "Moyenne",
    dot: "bg-amber-400",
    badge: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    value: "high",
    label: "Haute",
    dot: "bg-rose-500",
    badge: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
];

export function getPriorityConfig(priority) {
  return PRIORITY_OPTIONS.find((p) => p.value === priority) || null;
}
