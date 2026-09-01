"use client";
import { Check, Flag } from "lucide-react";
import { PRIORITY_OPTIONS, getPriorityConfig } from "@/lib/priority";

export function PriorityBadge({ priority, className = "" }) {
  const cfg = getPriorityConfig(priority);
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${cfg.badge} ${className}`}
    >
      <Flag size={9} />
      {cfg.label}
    </span>
  );
}

export function PriorityDot({ priority, className = "" }) {
  const cfg = getPriorityConfig(priority);
  if (!cfg) return null;
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot} ${className}`}
      title={cfg.label}
    />
  );
}

export function PriorityMenu({ value, onChange }) {
  return (
    <div className="py-1">
      <button
        onClick={() => onChange(null)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="w-2 h-2 rounded-full shrink-0 bg-slate-200 dark:bg-slate-600" />
        <span className="flex-1 text-left">Aucune</span>
        {!value && <Check size={12} className="text-indigo-500 dark:text-indigo-400" />}
      </button>
      {PRIORITY_OPTIONS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${p.dot}`} />
          <span className="flex-1 text-left">{p.label}</span>
          {value === p.value && <Check size={12} className="text-indigo-500 dark:text-indigo-400" />}
        </button>
      ))}
    </div>
  );
}
