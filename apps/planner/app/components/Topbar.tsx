import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { IconButton } from "@trails-cool/ui";
import { ParticipantAvatars } from "~/components/ParticipantAvatars";
import type { Participant } from "~/lib/use-participants";

interface TopbarProps {
  participants: Participant[];
  onRenameLocal?: (name: string) => void;
  connected: boolean;
  sessionShortId: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  computing?: boolean;
  /** App-specific interactive slot (profile selector). */
  profileSlot?: ReactNode;
  /** Right-aligned action slot (save-to-journal, export). */
  actions?: ReactNode;
}

const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);
const RedoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
  </svg>
);

export function Topbar({
  participants,
  onRenameLocal,
  connected,
  sessionShortId,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  computing = false,
  profileSlot,
  actions,
}: TopbarProps) {
  const { t } = useTranslation("planner");

  return (
    <header className="flex items-center justify-between gap-2 border-b border-border bg-bg-raised px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] sm:px-4 sm:py-2">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-4">
        <Link
          to="/"
          className="hidden shrink-0 text-lg font-semibold tracking-tight text-text-hi hover:text-accent sm:block"
        >
          {t("title")}
        </Link>
        <div className="shrink-0">{profileSlot}</div>
        <div className="hidden min-w-0 overflow-hidden sm:block">
          <ParticipantAvatars
            participants={participants}
            onRenameLocal={onRenameLocal}
          />
        </div>
        <div className="hidden shrink-0 gap-0.5 sm:flex">
          <IconButton
            size="sm"
            label={t("undo.tooltip")}
            onClick={onUndo}
            disabled={!canUndo}
          >
            <UndoIcon />
          </IconButton>
          <IconButton
            size="sm"
            label={t("redo.tooltip")}
            onClick={onRedo}
            disabled={!canRedo}
          >
            <RedoIcon />
          </IconButton>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {actions}
        {computing && (
          <span className="hidden text-xs text-accent sm:inline">
            {t("computingRoute")}
          </span>
        )}
        <span className="hidden items-center gap-1.5 text-sm text-text-md sm:inline-flex">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-accent" : "bg-text-lo"}`}
            aria-hidden
          />
          {connected ? t("connected") : t("connecting")} · {sessionShortId}
        </span>
      </div>
    </header>
  );
}
