import { useState } from "react";

export function useTrash() {
  const [trashItems, setTrashItems] = useState([]);

  const moveToTrash = (item, type = "page", origin = {}) => {
    setTrashItems((prev) => [
      {
        ...item,
        ...origin,
        trashId: `trash-${Date.now()}`,
        originalType: type,
        deletedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const removeFromTrash = (trashId) => {
    setTrashItems((prev) => prev.filter((i) => i.trashId !== trashId));
  };

  return { trashItems, moveToTrash, removeFromTrash, setTrashItems };
}
