"use client";
import { Check } from "lucide-react";
import { STATUS_OPTIONS, getStatusConfig } from "@/lib/status";

export function StatusBadge({ status, className = "" }) {
  const cfg = getStatusConfig(status);
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${cfg.badge} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function StatusDot({ status, className = "" }) {
  const cfg = getStatusConfig(status);
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot} ${className}`}
      title={cfg.label}
    />
  );
}

export function StatusMenu({ value, onChange }) {
  return (
    <div className="py-1">
      {STATUS_OPTIONS.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
          <span className="flex-1 text-left">{s.label}</span>
          {value === s.value && <Check size={12} className="text-indigo-500 dark:text-indigo-400" />}
        </button>
      ))}
    </div>
  );
}
