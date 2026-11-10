"use client";
import { useEffect, useRef } from "react";

// Pile des couches ouvertes qui réagissent à Échap (modales, panneaux,
// menus). Seule la plus récente est appelée : auparavant chaque composant
// écoutait Échap sur window pour son propre compte, et une seule pression
// pouvait fermer plusieurs couches empilées à la fois.
const stack = [];

function onKeyDown(event) {
  if (event.key !== "Escape" || stack.length === 0) return;
  stack[stack.length - 1].current(event);
}

// `handler` est appelé quand Échap est pressé et que ce composant est la
// couche du dessus ; `enabled` permet de ne s'inscrire que tant qu'une
// couche est réellement ouverte.
export function useEscapeKey(handler, enabled = true) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    if (stack.length === 0) window.addEventListener("keydown", onKeyDown);
    stack.push(handlerRef);
    return () => {
      const index = stack.lastIndexOf(handlerRef);
      if (index !== -1) stack.splice(index, 1);
      if (stack.length === 0) window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}
