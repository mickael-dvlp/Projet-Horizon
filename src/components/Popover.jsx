"use client";
import { useEscapeKey } from "@/hooks/useEscapeKey";

// Menu flottant : un fond transparent qui le referme au clic, un panneau
// positionné par `className` (position, largeur, arrondi, z-index,
// marges internes), et fermeture par Échap. `closeOnMouseDown` : referme
// dès l'appui (sélecteurs de couleur de l'éditeur, qui doivent conserver
// la sélection de texte en cours).
export default function Popover({
  onClose,
  className = "",
  overlayClassName = "z-10",
  closeOnMouseDown = false,
  children,
}) {
  useEscapeKey(onClose);
  return (
    <>
      <div
        className={`fixed inset-0 ${overlayClassName}`}
        {...(closeOnMouseDown ? { onMouseDown: onClose } : { onClick: onClose })}
      />
      <div
        className={`absolute bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl animate-in fade-in zoom-in-95 duration-100 ${className}`}
      >
        {children}
      </div>
    </>
  );
}
