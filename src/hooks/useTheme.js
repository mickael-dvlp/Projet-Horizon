"use client";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "horizon-theme";
const THEMES = ["light", "dark", "system"];

function isDarkFor(theme) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", isDarkFor(theme));
}

export function useTheme() {
  // null tant que la valeur enregistrée n'a pas été lue : appliquer "system"
  // d'ici là annulait le thème déjà posé par le script de layout.jsx (flash
  // clair/sombre au chargement quand le thème choisi diffère du système).
  const [theme, setThemeState] = useState(null);

  useEffect(() => {
    // localStorage n'existe pas côté serveur : la lecture doit attendre le montage
    // (un lazy initializer de useState casserait l'hydratation SSR).
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(THEMES.includes(stored) ? stored : "system");
  }, []);

  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  return { theme: theme ?? "system", setTheme };
}
