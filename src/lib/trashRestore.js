import { newId } from "@/lib/id";
import { collectIds } from "@/lib/contentStore";

const insertAt = (list, index, item) => {
  const at = Number.isInteger(index) ? Math.min(Math.max(index, 0), list.length) : list.length;
  return [...list.slice(0, at), item, ...list.slice(at)];
};

// Calcule la restauration d'un élément de la corbeille, sans effet de bord :
// renvoie soit { restored: true, changes, notice? } (les maps d'état à
// remplacer, et un message à afficher si la restauration diffère de
// l'origine), soit { restored: false, reason } quand aucune destination
// n'existe — dans ce cas l'appelant doit laisser l'élément dans la corbeille
// plutôt que de l'en retirer (ce qui le faisait disparaître définitivement).
//
// Destination : l'univers/livre d'origine s'il existe encore, sinon
// l'univers/livre actif.
export function restoreTrashItem(state, item) {
  const {
    projects,
    subProjects,
    allProjectsData,
    knowledgeBaseByProject,
    activeProjectId,
    activeSubProjectId,
    trash = [],
  } = state;
  const { trashId, originalType, deletedAt, projectId, subProjectId, ...clean } = item;

  const projectExists = (id) => !!id && projects.some((p) => p.id === id);
  const targetProjectId = projectExists(projectId)
    ? projectId
    : projectExists(activeProjectId)
      ? activeProjectId
      : null;

  if (originalType === "kbFile") {
    if (!targetProjectId) {
      return { restored: false, reason: "Aucun univers où restaurer cette fiche : ouvrez un univers puis réessayez." };
    }
    return {
      restored: true,
      changes: {
        knowledgeBaseByProject: {
          ...knowledgeBaseByProject,
          [targetProjectId]: [...(knowledgeBaseByProject[targetProjectId] || []), clean],
        },
      },
    };
  }

  // Univers entier : ré-éclate l'instantané autonome dans les mêmes maps que
  // celles vidées par deleteProject. Seul l'id racine est régénéré en cas de
  // collision, les ids des livres/arcs/chapitres restent inchangés.
  if (originalType === "project") {
    const restoredId = projects.some((p) => p.id === clean.id) ? newId("proj") : clean.id;
    return {
      restored: true,
      changes: {
        projects: [...projects, { id: restoredId, name: clean.name }],
        subProjects: { ...subProjects, [restoredId]: clean.subProjects || [] },
        allProjectsData: { ...allProjectsData, ...(clean.allProjectsData || {}) },
        knowledgeBaseByProject: {
          ...knowledgeBaseByProject,
          [restoredId]: clean.knowledgeBaseByProject || [],
        },
      },
    };
  }

  if (originalType === "subProject") {
    if (!targetProjectId) {
      return { restored: false, reason: "Aucun univers où restaurer ce livre : ouvrez un univers puis réessayez." };
    }
    const { allProjectsData: bookColumns, ...bookOnly } = clean;
    return {
      restored: true,
      changes: {
        subProjects: {
          ...subProjects,
          [targetProjectId]: [...(subProjects[targetProjectId] || []), bookOnly],
        },
        allProjectsData: { ...allProjectsData, [bookOnly.id]: bookColumns || [] },
      },
    };
  }

  // Scène : dans son chapitre d'origine, à sa place d'origine, où que ce
  // chapitre se trouve désormais. Chapitre en corbeille (seul ou avec son
  // arc, son livre…) : il faut d'abord le restaurer. Chapitre supprimé
  // définitivement : la scène revient comme chapitre, plutôt que de rester
  // à jamais impossible à restaurer.
  let pageToRestore = clean;
  let notice;
  if (originalType === "scene") {
    const { pageId, sceneIndex, ...sceneOnly } = clean;
    const bookId = Object.keys(allProjectsData).find((id) =>
      (allProjectsData[id] || []).some((col) => (col.pages || []).some((p) => p.id === pageId))
    );
    if (bookId) {
      return {
        restored: true,
        changes: {
          allProjectsData: {
            ...allProjectsData,
            [bookId]: allProjectsData[bookId].map((col) => ({
              ...col,
              pages: (col.pages || []).map((p) =>
                p.id === pageId ? { ...p, scenes: insertAt(p.scenes || [], sceneIndex, sceneOnly) } : p
              ),
            })),
          },
        },
      };
    }
    const container = trash.find((t) => t.trashId !== trashId && collectIds(t).has(pageId));
    if (container) {
      return {
        restored: false,
        reason: `Le chapitre de cette scène est dans la corbeille : restaurez d'abord « ${container.title || container.name || "Sans titre"} ».`,
      };
    }
    pageToRestore = sceneOnly;
    notice = "Le chapitre de cette scène n'existe plus : elle a été restaurée comme chapitre.";
  }

  // Arc ou chapitre : livre d'origine s'il existe encore, sinon livre actif.
  const targetSubId =
    subProjectId && allProjectsData[subProjectId] !== undefined ? subProjectId : activeSubProjectId;
  if (!targetSubId) {
    return { restored: false, reason: "Aucun livre où restaurer cet élément : ouvrez un livre puis réessayez." };
  }
  const cols = allProjectsData[targetSubId] || [];

  if (originalType === "column") {
    return {
      restored: true,
      changes: {
        allProjectsData: {
          ...allProjectsData,
          [targetSubId]: [...cols, { ...clean, pages: clean.pages || [] }],
        },
      },
    };
  }

  const { columnId, ...pageOnly } = pageToRestore;
  // Livre sans aucun arc : on en recrée un pour accueillir le chapitre,
  // au lieu d'abandonner la restauration.
  if (cols.length === 0) {
    return {
      restored: true,
      notice,
      changes: {
        allProjectsData: {
          ...allProjectsData,
          [targetSubId]: [{ id: newId("col"), title: "Arc restauré", color: "slate", pages: [pageOnly] }],
        },
      },
    };
  }
  const targetColId = cols.some((c) => c.id === columnId) ? columnId : cols[0].id;
  return {
    restored: true,
    notice,
    changes: {
      allProjectsData: {
        ...allProjectsData,
        [targetSubId]: cols.map((col) =>
          col.id === targetColId ? { ...col, pages: [pageOnly, ...col.pages] } : col
        ),
      },
    },
  };
}
