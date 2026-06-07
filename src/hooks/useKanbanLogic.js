import { useState, useEffect } from "react";
import { auth, db } from "@/firebase/config";
import { arrayMove } from "@dnd-kit/sortable";
import { useTrash } from "@/hooks/useTrash";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export function useKanbanLogic() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { trashItems, moveToTrash, removeFromTrash, setTrashItems } = useTrash();
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [allProjectsData, setAllProjectsData] = useState({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activePage, setActivePage] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);

  const columns = allProjectsData[activeProjectId] || [];

  const DEFAULT_PROJECTS = [{ id: "p1", name: "Mon Premier Projet" }];
  const DEFAULT_DATA = {
    p1: [{ id: "col1", title: "À faire", color: "indigo", pages: [] }],
  };

  const applyData = (data) => {
    setProjects(data.projects || DEFAULT_PROJECTS);
    setAllProjectsData(data.allData || DEFAULT_DATA);
    setActiveProjectId(data.lastActive || data.projects?.[0]?.id || "p1");
    setTrashItems(data.trash || []);
  };

  // --- AUTHENTIFICATION & CHARGEMENT DES DONNÉES ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            applyData(docSnap.data());
          } else {
            const saved = localStorage.getItem(`kanban-data-${currentUser.uid}`);
            if (saved) {
              applyData(JSON.parse(saved));
            } else {
              applyData({});
            }
          }
        } catch (error) {
          console.error("Erreur durant le fetch Firestore :", error);
        } finally {
          setIsInitialLoad(false);
          setLoading(false);
        }
      } else {
        setIsInitialLoad(false);
        setLoading(false);
      }
    });

    setMounted(true);
    return () => unsubscribe();
  }, []);

  // --- SYNCHRONISATION FIRESTORE & LOCALSTORAGE ---
  useEffect(() => {
    const saveData = async () => {
      if (!mounted || isInitialLoad || projects.length === 0) return;

      const dataToSave = {
        projects,
        allData: allProjectsData,
        lastActive: activeProjectId,
        trash: trashItems,
      };

      if (user) {
        try {
          await setDoc(doc(db, "users", user.uid), dataToSave);
          localStorage.setItem(`kanban-data-${user.uid}`, JSON.stringify(dataToSave));
        } catch (error) {
          console.error("Erreur lors de la sauvegarde Firestore:", error);
        }
      } else if (isGuest) {
        localStorage.setItem("kanban-data-guest", JSON.stringify(dataToSave));
      }
    };

    saveData();
  // activeProjectId est exclu des deps : naviguer entre projets ne doit pas
  // déclencher une écriture Firestore. La valeur courante sera capturée lors
  // de la prochaine sauvegarde déclenchée par un vrai changement de données.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, allProjectsData, trashItems, mounted, user, isGuest, isInitialLoad]);

  // --- AUTHENTIFICATION ---

  const handleGuestLogin = () => {
    const saved = localStorage.getItem("kanban-data-guest");
    if (saved) {
      try {
        applyData(JSON.parse(saved));
      } catch {
        applyData({});
      }
    } else {
      applyData({});
    }
    setIsInitialLoad(false);
    setIsGuest(true);
  };

  const handleLogout = async () => {
    if (!isGuest) await signOut(auth);
    setIsGuest(false);
    setProjects([]);
    setAllProjectsData({});
    setActiveProjectId(null);
    setTrashItems([]);
    setUser(null);
  };

  // --- COLONNES ---

  const setColumns = (newColsOrFn) => {
    setAllProjectsData((prev) => {
      const currentCols = prev[activeProjectId] || [];
      const updatedCols =
        typeof newColsOrFn === "function"
          ? newColsOrFn(currentCols)
          : newColsOrFn;
      return { ...prev, [activeProjectId]: updatedCols };
    });
  };

  const addColumn = () =>
    setColumns([
      ...columns,
      {
        id: `col-${Date.now()}`,
        title: "Nouveau Groupe",
        color: "slate",
        pages: [],
      },
    ]);

  const deleteColumn = (columnId) => {
    const columnToDelete = columns.find((col) => col.id === columnId);
    if (
      columnToDelete &&
      window.confirm(
        `Voulez-vous vraiment supprimer le groupe "${columnToDelete.title}" ?`,
      )
    ) {
      moveToTrash({ ...columnToDelete, type: "column" }, "column");
      setColumns((prev) => prev.filter((col) => col.id !== columnId));
    }
  };

  // --- PROJETS ---

  const handleCreateProject = (name) => {
    const newId = `proj-${Date.now()}`;
    setProjects((prev) => [...prev, { id: newId, name }]);
    setAllProjectsData((prev) => ({
      ...prev,
      [newId]: [
        {
          id: `col-${Date.now()}`,
          title: "Nouveau Groupe",
          color: "slate",
          pages: [],
        },
      ],
    }));
    setActiveProjectId(newId);
  };

  const handleRenameProject = (projectId, newName) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, name: newName } : p)),
    );
  };

  const deleteProject = (projectId) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setAllProjectsData((prev) => {
      const newData = { ...prev };
      delete newData[projectId];
      return newData;
    });
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
  };

  // --- PAGES ---

  const addPage = (columnId) => {
    const newPage = {
      id: `p-${Date.now()}`,
      title: "Nouvelle Page",
      content: "",
    };
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, pages: [...col.pages, newPage] } : col,
      ),
    );
  };

  const handleSavePage = (pageId, updates) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        pages: col.pages.map((p) =>
          p.id === pageId ? { ...p, ...updates } : p,
        ),
      })),
    );
  };

  const deletePage = (pageId) => {
    const pageToDelete = columns.flatMap((c) => c.pages).find((p) => p.id === pageId);
    if (pageToDelete) {
      moveToTrash(pageToDelete, "page");
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          pages: col.pages.filter((p) => p.id !== pageId),
        })),
      );
    }
  };

  // --- CORBEILLE ---

  const handleRestore = (item) => {
    if (item.type === "column") {
      setColumns((prev) => [...prev, { ...item, pages: item.pages || [] }]);
    } else {
      setColumns((prev) => {
        const newCols = [...prev];
        if (newCols.length > 0) {
          newCols[0] = { ...newCols[0], pages: [item, ...newCols[0].pages] };
        }
        return newCols;
      });
    }
    removeFromTrash(item.trashId);
  };

  return {
    mounted,
    user,
    isGuest,
    loading,
    isAuthModalOpen,
    setIsAuthModalOpen,
    handleGuestLogin,
    projects,
    activeProjectId,
    setActiveProjectId,
    columns,
    activePage,
    setActivePage,
    draggedItem,
    setDraggedItem,
    isTrashOpen,
    setIsTrashOpen,
    trashItems,
    handleLogout,
    handleCreateProject,
    deletePage,
    handleRestore,
    addColumn,
    addPage,
    handleSavePage,
    setColumns,
    setProjects,
    setAllProjectsData,
    removeFromTrash,
    handleRenameProject,
    deleteColumn,
    deleteProject,
  };
}
