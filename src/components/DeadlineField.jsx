"use client";

export default function DeadlineField({ value, onChange }) {
  return (
    <input
      type="date"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Échéance"
      className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 outline-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
    />
  );
}
