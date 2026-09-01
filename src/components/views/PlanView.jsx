"use client";
import { FileText } from "lucide-react";
import { StatusDot } from "@/components/StatusPicker";
import { PriorityDot } from "@/components/PriorityPicker";

export default function PlanView({ columns, onPageClick }) {
  if (columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
          Aucun arc pour l’instant.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {columns.map((col) => (
          <div key={col.id}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{col.title}</h3>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {col.pages.length} chapitre{col.pages.length !== 1 ? "s" : ""}
              </span>
            </div>
            {col.pages.length === 0 ? (
              <p className="text-xs text-slate-300 dark:text-slate-600 italic pl-1">Aucun chapitre</p>
            ) : (
              <div className="flex flex-col border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {col.pages.map((page) => {
                  const doneTasks = (page.tasks || []).filter((t) => t.done).length;
                  const totalTasks = (page.tasks || []).length;
                  return (
                    <button
                      key={page.id}
                      onClick={() => onPageClick(page)}
                      className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <StatusDot status={page.status} />
                      <FileText size={13} className="text-slate-300 dark:text-slate-600 shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                        {page.title || "Sans titre"}
                      </span>
                      <PriorityDot priority={page.priority} />
                      {totalTasks > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tabular-nums shrink-0">
                          {doneTasks}/{totalTasks}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
