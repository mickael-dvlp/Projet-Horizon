// Priorités partagées entre livres, chapitres et scènes.
export const PRIORITY_OPTIONS = [
  {
    value: "low",
    label: "Faible",
    dot: "bg-slate-400",
  },
  {
    value: "medium",
    label: "Moyenne",
    dot: "bg-amber-400",
  },
  {
    value: "high",
    label: "Haute",
    dot: "bg-rose-500",
  },
];

export function getPriorityConfig(priority) {
  return PRIORITY_OPTIONS.find((p) => p.value === priority) || null;
}
