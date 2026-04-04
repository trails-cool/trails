import { useState, useEffect, useCallback } from "react";
import * as Y from "yjs";

export function useUndo(undoManager: Y.UndoManager | null): { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void } {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!undoManager) return;
    const update = () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    };
    undoManager.on("stack-item-added", update);
    undoManager.on("stack-item-popped", update);
    undoManager.on("stack-item-updated", update);
    update();
    return () => {
      undoManager.off("stack-item-added", update);
      undoManager.off("stack-item-popped", update);
      undoManager.off("stack-item-updated", update);
    };
  }, [undoManager]);

  const undo = useCallback(() => undoManager?.undo(), [undoManager]);
  const redo = useCallback(() => undoManager?.redo(), [undoManager]);

  return { canUndo, canRedo, undo, redo };
}

export function useUndoShortcuts(undoManager: Y.UndoManager | null) {
  useEffect(() => {
    if (!undoManager) return;

    const handler = (e: KeyboardEvent) => {
      // Suppress in text inputs — let browser-native undo handle those
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.includes("Mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoManager.undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        undoManager.redo();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [undoManager]);
}
