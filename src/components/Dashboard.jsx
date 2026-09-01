"use client";
import { ListTodo, Eye, FileSearch, Clock } from "lucide-react";
import { StatusDot } from "@/components/StatusPicker";
import { formatShortDate, getDeadlineStatus } from "@/lib/date";

const KIND_LABELS = { book: "Livre", chapter: "Chapitre", scene: "Scène" };

const DEADLINE_STATUS_STYLES = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-amber-600 dark:text-amber-400",
  upcoming: "text-indigo-600 dark:text-indigo-400",
};

function ProgressBar({ percent }) {
  return (
    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-500 transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

function SectionCard({ icon: Icon, title, items, emptyText, renderItem, onOpenItem, isTaskSection = false }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium ml-auto tabular-nums">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-300 dark:text-slate-600 italic">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto custom-scrollbar -mx-1">
          {items.slice(0, 30).map((item, i) => (
            <button
              key={i}
              onClick={() => onOpenItem(item, isTaskSection)}
              className="flex items-center gap-2 text-left px-1.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ project, activeSubProjectId, summary, onOpenItem }) {
  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <p className="text-sm text-slate-400 dark:text-slate-500 italic max-w-sm">
          Sélectionnez ou créez un univers pour voir apparaître votre tableau de bord.
        </p>
      </div>
    );
  }

  const { books, undoneTasks, inProgressItems, toReviewItems, upcomingDeadlines } = summary;
  const totalChapters = books.reduce((acc, b) => acc + b.progress.total, 0);
  const doneChapters = books.reduce((acc, b) => acc + b.progress.done, 0);
  const globalPercent = totalChapters ? Math.round((doneChapters / totalChapters) * 100) : 0;
  const isEmpty = books.length === 0;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pl-16 md:p-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        <div>
          <p className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-0.5">
            Tableau de bord
          </p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-3">
            {project.name}
          </h1>
          {totalChapters > 0 && (
            <div className="flex items-center gap-3">
              <ProgressBar percent={globalPercent} />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold shrink-0 tabular-nums">
                {doneChapters}/{totalChapters} chapitres terminés · {globalPercent}%
              </span>
            </div>
          )}
        </div>

        {isEmpty ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">
              Rien à afficher pour l’instant — créez un livre et quelques chapitres pour voir apparaître votre suivi ici.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
                Progression par livre
              </h3>
              <div className="flex flex-col gap-2.5">
                {books.map(({ subProject, progress }) => (
                  <div key={subProject.id} className="flex items-center gap-3">
                    <span
                      className={`text-sm truncate w-20 sm:w-32 shrink-0 ${
                        subProject.id === activeSubProjectId
                          ? "font-semibold text-indigo-600 dark:text-indigo-400"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {subProject.name}
                    </span>
                    <ProgressBar percent={progress.percent} />
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0 w-14 sm:w-20 text-right">
                      {progress.done}/{progress.total} ch.
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionCard
                icon={ListTodo}
                title="Tâches à faire"
                items={undoneTasks}
                emptyText="Aucune tâche en attente."
                onOpenItem={onOpenItem}
                isTaskSection
                renderItem={(t) => (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
                      {t.label}
                    </span>
                  </>
                )}
              />
              <SectionCard
                icon={Eye}
                title="En cours"
                items={inProgressItems}
                emptyText="Rien en cours actuellement."
                onOpenItem={onOpenItem}
                renderItem={(it) => (
                  <>
                    <StatusDot status="in_progress" />
                    <span className="flex-1 min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
                      {it.title}
                    </span>
                  </>
                )}
              />
              <SectionCard
                icon={FileSearch}
                title="À relire"
                items={toReviewItems}
                emptyText="Rien à relire pour l’instant."
                onOpenItem={onOpenItem}
                renderItem={(it) => (
                  <>
                    <StatusDot status="to_review" />
                    <span className="flex-1 min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
                      {it.title}
                    </span>
                  </>
                )}
              />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={15} className="text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Prochaines échéances
                </h3>
              </div>
              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-slate-300 dark:text-slate-600 italic">Aucune échéance définie.</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {upcomingDeadlines.slice(0, 10).map((d, i) => {
                    const status = getDeadlineStatus(d.deadline);
                    const origin = [
                      KIND_LABELS[d.kind] || d.kind,
                      d.subProjectName,
                      d.kind === "scene" && d.chapterTitle ? d.chapterTitle : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <button
                        key={i}
                        onClick={() => onOpenItem(d)}
                        className="flex items-center gap-3 text-left px-1.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span
                          className={`text-xs font-semibold w-16 shrink-0 tabular-nums ${DEADLINE_STATUS_STYLES[status] || DEADLINE_STATUS_STYLES.upcoming}`}
                        >
                          {formatShortDate(d.deadline)}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
                          {d.title}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 max-w-[40%] truncate">
                          {origin}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
