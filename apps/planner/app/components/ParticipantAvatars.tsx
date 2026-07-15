import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Badge } from "@trails-cool/ui";
import type { Participant } from "~/lib/use-participants";

interface ParticipantAvatarsProps {
  participants: Participant[];
  /** Called when the local participant commits a new display name. */
  onRenameLocal?: (name: string) => void;
}

/**
 * Presentational participant strip: a colored Avatar per participant, the
 * local user's name inline-editable, and a Host badge. Driven entirely by the
 * plain `participants` array so it renders in the /dev/ui gallery without a
 * live session.
 */
export function ParticipantAvatars({
  participants,
  onRenameLocal,
}: ParticipantAvatarsProps) {
  const { t } = useTranslation("planner");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = (name: string) => {
    setValue(name);
    setEditing(true);
  };

  const commit = () => {
    onRenameLocal?.(value);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2">
      {participants.map((p) => (
        <div key={p.clientId} className="flex items-center gap-1.5">
          <Avatar name={p.name} color={p.color} size="sm" />
          {p.isLocal && editing ? (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                else if (e.key === "Escape") setEditing(false);
              }}
              maxLength={20}
              className="w-24 rounded border border-border bg-bg-raised px-1.5 py-0.5 text-base text-text-hi focus:border-accent focus:outline-none sm:text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={p.isLocal ? () => startEditing(p.name) : undefined}
              className={
                p.isLocal
                  ? "cursor-pointer text-xs text-text-hi hover:underline"
                  : "cursor-default text-xs text-text-md"
              }
              title={p.isLocal ? t("participants.editName") : p.name}
            >
              {p.name}
              {p.isLocal && (
                <span className="ml-0.5 text-text-lo">
                  {t("participants.you")}
                </span>
              )}
            </button>
          )}
          {p.isHost && <Badge tone="accent">{t("participants.host")}</Badge>}
        </div>
      ))}
    </div>
  );
}
