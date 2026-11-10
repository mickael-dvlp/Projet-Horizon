"use client";
import { StatusMenu } from "./StatusPicker";
import { PriorityMenu } from "./PriorityPicker";
import DeadlineField from "./DeadlineField";

export function MenuLabel({ children }) {
  return (
    <p className="px-3 pt-1 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />;
}

// Statut, priorité et échéance d'un livre, chapitre ou scène — section
// commune aux menus de la barre latérale, des cartes et des scènes.
// `onChange` reçoit les champs modifiés ({ status } | { priority } |
// { deadline }) ; à l'appelant de décider s'il referme son menu.
export default function MetaMenu({ status, priority, deadline, onChange }) {
  return (
    <>
      <MenuLabel>Statut</MenuLabel>
      <StatusMenu value={status} onChange={(value) => onChange({ status: value })} />
      <MenuSeparator />
      <MenuLabel>Priorité</MenuLabel>
      <PriorityMenu value={priority} onChange={(value) => onChange({ priority: value })} />
      <MenuSeparator />
      <MenuLabel>Échéance</MenuLabel>
      <div className="px-3 pb-1.5">
        <DeadlineField value={deadline} onChange={(value) => onChange({ deadline: value })} />
      </div>
    </>
  );
}
