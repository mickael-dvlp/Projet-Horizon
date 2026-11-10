import { newId } from "@/lib/id";

// Calcule la restauration d'un élément de la corbeille, sans effet de bord :
// renvoie soit { restored: true, changes } (les maps d'état à remplacer),
// soit { restored: false, reason } quand aucune destination n'existe — dans
// ce cas l'appelant doit laisser l'élément dans la corbeille plutôt que de
// l'en retirer (ce qui le faisait disparaître définitivement).
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

  const { columnId, ...pageOnly } = clean;
  // Livre sans aucun arc : on en recrée un pour accueillir le chapitre,
  // au lieu d'abandonner la restauration.
  if (cols.length === 0) {
    return {
      restored: true,
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
