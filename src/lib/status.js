// Statuts partagés entre livres, chapitres et scènes.
export const STATUS_OPTIONS = [
  {
    value: "idea",
    label: "Idée",
    dot: "bg-violet-400",
  },
  {
    value: "todo",
    label: "À faire",
    dot: "bg-slate-400",
  },
  {
    value: "in_progress",
    label: "En cours",
    dot: "bg-indigo-500",
  },
  {
    value: "to_review",
    label: "À relire",
    dot: "bg-amber-400",
  },
  {
    value: "done",
    label: "Terminé",
    dot: "bg-emerald-500",
  },
];

export const DEFAULT_STATUS = "todo";

export function getStatusConfig(status) {
  return (
    STATUS_OPTIONS.find((s) => s.value === status) ||
    STATUS_OPTIONS.find((s) => s.value === DEFAULT_STATUS)
  );
}
