// Statuts partagés entre livres, chapitres et scènes.
export const STATUS_OPTIONS = [
  {
    value: "idea",
    label: "Idée",
    dot: "bg-violet-400",
    badge: "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    value: "todo",
    label: "À faire",
    dot: "bg-slate-400",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  },
  {
    value: "in_progress",
    label: "En cours",
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  {
    value: "to_review",
    label: "À relire",
    dot: "bg-amber-400",
    badge: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    value: "done",
    label: "Terminé",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
];

export const DEFAULT_STATUS = "todo";

export function getStatusConfig(status) {
  return (
    STATUS_OPTIONS.find((s) => s.value === status) ||
    STATUS_OPTIONS.find((s) => s.value === DEFAULT_STATUS)
  );
}
