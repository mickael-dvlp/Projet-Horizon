"use client";
import { useEffect, useRef } from "react";

// Mémorise l'élément qui avait le focus juste avant l'ouverture d'un panneau
// ou d'une modale, et le lui restitue à la fermeture (démontage) — pour les
// composants montés/démontés conditionnellement (`{isOpen && <Modal/>}`),
// pas ceux qui gèrent leur propre visibilité en interne.
export function useRestoreFocus() {
  const triggerRef = useRef(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    return () => {
      triggerRef.current?.focus?.();
    };
  }, []);
}
