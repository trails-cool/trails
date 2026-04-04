import { useEffect, useRef, useCallback } from "react";
import type { YjsState } from "~/lib/use-yjs";

interface NotesPanelProps {
  yjs: YjsState;
}

export function NotesPanel({ yjs }: NotesPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLocalChange = useRef(false);

  // Sync Y.Text → textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Set initial value
    textarea.value = yjs.notes.toString();

    const observer = () => {
      if (isLocalChange.current) return;
      const pos = textarea.selectionStart;
      textarea.value = yjs.notes.toString();
      textarea.selectionStart = pos;
      textarea.selectionEnd = pos;
    };

    yjs.notes.observe(observer);
    return () => yjs.notes.unobserve(observer);
  }, [yjs.notes]);

  // textarea → Y.Text
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const newValue = textarea.value;
      const currentValue = yjs.notes.toString();

      if (newValue === currentValue) return;

      isLocalChange.current = true;
      yjs.doc.transact(() => {
        yjs.notes.delete(0, yjs.notes.length);
        yjs.notes.insert(0, newValue);
      }, "local");
      isLocalChange.current = false;
    },
    [yjs.notes, yjs.doc],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">Notes</h2>
      </div>
      <div className="flex-1 p-2">
        <textarea
          ref={textareaRef}
          onInput={handleInput}
          className="h-full w-full resize-none rounded border border-gray-200 p-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:outline-none"
          placeholder="Add notes for this session..."
        />
      </div>
    </div>
  );
}
