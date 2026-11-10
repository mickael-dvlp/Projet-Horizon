"use client";
import { useEffect, useRef, useState } from "react";

// Renommage "en place" partagé (arcs, chapitres, scènes, univers, livres,
// titre de l'éditeur) :
// - repart toujours de la valeur actuelle au démarrage ;
// - Entrée ou perte de focus valident, Échap annule ;
// - un nom vide ou inchangé n'est pas enregistré, les espaces superflus
//   sont retirés ;
// - une ref empêche qu'une perte de focus survenant après Entrée ou Échap
//   (au démontage du champ) ne valide une seconde fois — ou n'applique
//   un renommage que l'utilisateur venait d'annuler.
//
// Dans une liste, `start(id, valeur)` indique quel élément est renommé et
// `isEditing(id)` le teste ; `onSave(nouveauNom, id)` reçoit cet id.
export function useInlineRename(onSave) {
  const [editing, setEditing] = useState(null); // { id, original }
  const [value, setValue] = useState("");
  const closedRef = useRef(true);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const start = (id, current = "") => {
    closedRef.current = false;
    setValue(current || "");
    setEditing({ id, original: current || "" });
  };

  const cancel = () => {
    closedRef.current = true;
    setEditing(null);
  };

  const commit = () => {
    if (closedRef.current || !editing) return;
    const trimmed = value.trim();
    if (trimmed && trimmed !== editing.original) onSave(trimmed, editing.id);
    cancel();
  };

  const isEditing = (id) => editing !== null && (id === undefined || editing.id === id);

  const inputProps = {
    ref: inputRef,
    value,
    onChange: (e) => setValue(e.target.value),
    onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        // N'atteint pas les autres gestionnaires d'Échap (panneau, modale).
        e.stopPropagation();
        cancel();
      }
    },
  };

  return { isEditing, start, cancel, commit, inputProps };
}
