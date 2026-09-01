"use client";
import { useRef, useState } from "react";

// Logique de création "nommer avant d'enregistrer" partagée par tous les
// formulaires inline de l'app (chapitre, tâche, scène, univers, livre...) :
// Entrée et perte de focus valident via le même chemin que le bouton
// "Ajouter" (comportement volontaire et déjà cohérent dans toute l'app,
// conservé tel quel), Échap annule, un titre vide/blanc n'est jamais créé,
// les espaces superflus sont retirés à l'enregistrement, et une ref (pas un
// state) empêche une double création si deux événements de soumission se
// déclenchent l'un juste après l'autre (ex. Entrée puis blur synchrone,
// dont le second lirait autrement une fermeture (closure) pas encore mise
// à jour par le premier).
//
// `onClose` (optionnel) : ferme le formulaire éphémère du composant appelant
// (ex. setIsAddingPage(false)) — omis pour un champ toujours visible
// (TaskList, SceneListPanel), où "annuler" se contente de vider le texte.
// `triggerRef` (optionnel) : élément à refocaliser après création/annulation
// (ex. le bouton "Ajouter un chapitre"), pour ne pas perdre le focus
// clavier quand le formulaire se démonte.
export function useCreateForm(onCreate, { onClose, triggerRef } = {}) {
  const [value, setValue] = useState("");
  const submittedRef = useRef(false);

  const reset = () => {
    setValue("");
    submittedRef.current = false;
  };

  const closeAndRefocus = () => {
    onClose?.();
    // Différé : appeler .focus() de façon synchrone ici déclencherait un
    // "blur" immédiat sur le champ encore techniquement monté à cet instant
    // (avant que React n'ait démonté/re-rendu), ce qui redéclencherait
    // `onBlur` (soumission) avec une fermeture (closure) pas encore à jour
    // — recréant artificiellement le risque de double-soumission que ce
    // hook est censé éviter.
    if (triggerRef) {
      setTimeout(() => triggerRef.current?.focus(), 0);
    }
  };

  const submit = (e) => {
    e?.preventDefault();
    if (submittedRef.current) return;
    const trimmed = value.trim();
    if (!trimmed) {
      reset();
      closeAndRefocus();
      return;
    }
    submittedRef.current = true;
    onCreate(trimmed);
    reset();
    closeAndRefocus();
  };

  const cancel = () => {
    reset();
    closeAndRefocus();
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Escape") return;
    // Empêche l'événement de remonter jusqu'à un gestionnaire Échap global
    // (ex. celui de l'éditeur, qui pourrait sinon fermer tout le panneau au
    // lieu de simplement annuler la saisie en cours dans ce formulaire).
    e.stopPropagation();
    cancel();
  };

  return { value, setValue, submit, cancel, handleKeyDown };
}
