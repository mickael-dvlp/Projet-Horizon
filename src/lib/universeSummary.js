import { computeBookProgress } from "@/lib/progress";

// Agrège, à travers tous les livres d'un univers, la progression par livre,
// les tâches non cochées, les éléments en cours/à relire et les échéances à
// venir. Fonction pure (ne dépend que des données passées en argument) pour
// rester testable sans rendre le hook React qui la porte.
export function buildUniverseSummary(subProjects, allProjectsData, projectId) {
  const books = (subProjects[projectId] || []).map((sub) => ({
    subProject: sub,
    progress: computeBookProgress(allProjectsData[sub.id] || []),
  }));

  const undoneTasks = [];
  const inProgressItems = [];
  const toReviewItems = [];
  const upcomingDeadlines = [];

  const collect = (item, kind, subProjectId, subProjectName, pageId, chapterTitle) => {
    const base = { kind, subProjectId, subProjectName, pageId, chapterTitle, sceneId: item.__sceneId };
    (item.tasks || [])
      .filter((t) => !t.done)
      .forEach((t) => undoneTasks.push({ ...base, id: t.id, label: t.label, source: item.title || item.name }));
    if (item.status === "in_progress") {
      inProgressItems.push({ ...base, title: item.title || item.name });
    }
    if (item.status === "to_review") {
      toReviewItems.push({ ...base, title: item.title || item.name });
    }
    if (item.deadline) {
      upcomingDeadlines.push({ ...base, title: item.title || item.name, deadline: item.deadline });
    }
  };

  (subProjects[projectId] || []).forEach((sub) => {
    collect(sub, "book", sub.id, sub.name, null, null);
    (allProjectsData[sub.id] || []).forEach((col) => {
      col.pages.forEach((p) => {
        collect(p, "chapter", sub.id, sub.name, p.id, null);
        (p.scenes || []).forEach((s) => {
          collect({ ...s, __sceneId: s.id }, "scene", sub.id, sub.name, p.id, p.title);
        });
      });
    });
  });

  upcomingDeadlines.sort((a, b) => a.deadline.localeCompare(b.deadline));

  return { books, undoneTasks, inProgressItems, toReviewItems, upcomingDeadlines };
}
