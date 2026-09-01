// Ce hook gère la logique de drag-and-drop pour les colonnes et les pages du tableau Kanban. Il utilise les capteurs de dnd-kit pour détecter les interactions de l'utilisateur et met à jour l'état des colonnes et des pages en conséquence.
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

export function useKanbanDnD(logic) {
  // Configuration des capteurs (clic/toucher)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Fonction interne pour savoir dans quelle colonne se trouve un élément
  const findContainer = (id) => {
    if (logic.columns.find((col) => col.id === id)) return id;
    return logic.columns.find((col) => col.pages.some((p) => p.id === id))?.id;
  };

  // Gestion du début du drag
  const handleDragStart = (event) => {
    const { active } = event;
    const isColumn = logic.columns.some((col) => col.id === active.id);

    logic.setDraggedItem(
      isColumn
        ? { type: "Column", ...logic.columns.find((c) => c.id === active.id) }
        : {
            type: "Page",
            ...logic.columns
              .flatMap((c) => c.pages)
              .find((p) => p.id === active.id),
          },
    );
  };

  // Gestion du déplacement au-dessus d'une cible
  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over || logic.columns.some((c) => c.id === active.id)) return;

    const activeCont = findContainer(active.id);
    const overCont = findContainer(over.id);

    if (!activeCont || !overCont || activeCont === overCont) return;

    // Déplacement d'une page entre deux colonnes
    logic.setColumns((prev) => {
      const activeCol = prev.find((c) => c.id === activeCont);
      const overCol = prev.find((c) => c.id === overCont);
      const activeIdx = activeCol.pages.findIndex((i) => i.id === active.id);
      const overIdx = overCol.pages.findIndex((i) => i.id === over.id);

      let newIdx = overIdx >= 0 ? overIdx : overCol.pages.length;

      // Si on déplace vers une position plus basse dans la même colonne, il faut ajuster l'index de destination
      return prev.map((col) => {
        if (col.id === activeCont)
          return { ...col, pages: col.pages.filter((i) => i.id !== active.id) };
        if (col.id === overCont) {
          const newPages = [...col.pages];
          newPages.splice(newIdx, 0, activeCol.pages[activeIdx]);
          return { ...col, pages: newPages };
        }
        return col;
      });
    });
  };

  // Gestion de la fin du drag
  const handleDragEnd = (event) => {
    const { active, over } = event;
    logic.setDraggedItem(null);
    if (!over) return;

    // Si c'est une colonne qu'on déplace
    if (logic.columns.some((c) => c.id === active.id)) {
      if (active.id !== over.id) {
        logic.setColumns((prev) => {
          const oldIndex = prev.findIndex((c) => c.id === active.id);
          const newIndex = prev.findIndex((c) => c.id === over.id);
          return arrayMove(prev, oldIndex, newIndex);
        });
      }
      return;
    }

    // Si c'est une page au sein d'une même colonne
    const aCont = findContainer(active.id);
    const oCont = findContainer(over.id);

    if (aCont === oCont) {
      const container = logic.columns.find((c) => c.id === aCont);
      const oldIdx = container.pages.findIndex((i) => i.id === active.id);
      const newIdx = container.pages.findIndex((i) => i.id === over.id);

      if (oldIdx !== newIdx) {
        logic.setColumns((prev) =>
          prev.map((col) =>
            col.id === aCont
              ? { ...col, pages: arrayMove(col.pages, oldIdx, newIdx) }
              : col,
          ),
        );
      }
    }
  };

  // Sans ceci, dnd-kit annonce par défaut les ids bruts ("p-1699999999999
  // was dropped over col-...") au lecteur d'écran — on les résout vers des
  // phrases lisibles à partir des titres réels d'arc/chapitre.
  const describe = (id) => {
    const col = logic.columns.find((c) => c.id === id);
    if (col) return `l'arc "${col.title}"`;
    const page = logic.columns.flatMap((c) => c.pages).find((p) => p.id === id);
    if (page) return `le chapitre "${page.title}"`;
    return "l'élément";
  };

  const announcements = {
    onDragStart: ({ active }) => `${describe(active.id)} sélectionné, en cours de déplacement.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${describe(active.id)} déplacé au-dessus de ${describe(over.id)}.`
        : `${describe(active.id)} n'est plus au-dessus d'une zone de dépôt valide.`,
    onDragEnd: ({ active, over }) => {
      if (!over) return `${describe(active.id)} n'a pas été déplacé.`;
      if (logic.columns.some((c) => c.id === active.id)) {
        return `${describe(active.id)} repositionné.`;
      }
      const targetCol = logic.columns.find((c) => c.pages.some((p) => p.id === over.id) || c.id === over.id);
      return targetCol
        ? `${describe(active.id)} déplacé vers l'arc "${targetCol.title}".`
        : `${describe(active.id)} déplacé.`;
    },
    onDragCancel: ({ active }) => `Déplacement de ${describe(active.id)} annulé.`,
  };

  return { sensors, handleDragStart, handleDragOver, handleDragEnd, announcements };
}
