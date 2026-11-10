import { newId } from "@/lib/id";

// Opérations sur une liste de tâches ({ id, label, done }), partagées par les
// tâches de livre, de chapitre et de scène. Fonctions pures : elles renvoient
// une nouvelle liste sans modifier celle reçue.

export function addTask(tasks = [], label) {
  const trimmed = (label || "").trim();
  if (!trimmed) return tasks;
  return [...tasks, { id: newId("task"), label: trimmed, done: false }];
}

export function toggleTask(tasks = [], taskId) {
  return tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
}

export function removeTask(tasks = [], taskId) {
  return tasks.filter((t) => t.id !== taskId);
}
