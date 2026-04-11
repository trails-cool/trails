import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { yCollab } from "y-codemirror.next";
import type { YjsState } from "~/lib/use-yjs";

interface NotesPanelProps {
  yjs: YjsState;
}

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
  },
  ".cm-editor": {
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "inherit",
  },
  ".cm-content": {
    padding: "12px",
    caretColor: "#1f2937",
  },
  ".cm-line": {
    lineHeight: "1.5",
  },
  "&.cm-focused": {
    outline: "none",
  },
  // Remote cursor styling
  ".cm-ySelectionInfo": {
    fontSize: "10px",
    fontFamily: "system-ui, sans-serif",
    padding: "1px 4px",
    borderRadius: "3px",
    opacity: "0.9",
    fontWeight: "500",
    position: "absolute",
    top: "-1.2em",
    left: "-1px",
    whiteSpace: "nowrap",
  },
});

export function NotesPanel({ yjs }: NotesPanelProps) {
  const { t } = useTranslation("planner");
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Set awareness user fields for cursor display
    const localState = yjs.awareness.getLocalState() as Record<string, unknown> | null;
    const user = localState?.user as { name: string; color: string } | undefined;
    if (user) {
      yjs.awareness.setLocalStateField("user", {
        ...user,
        colorLight: user.color + "30",
      });
    }

    const state = EditorState.create({
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.lineWrapping,
        placeholder(t("notes.placeholder")),
        theme,
        yCollab(yjs.notes, yjs.awareness, {
          undoManager: yjs.undoManager,
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [yjs]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">
          {t("sidebar.notes")}
        </h2>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
