import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { YjsState } from "~/lib/use-yjs";
import { electHost } from "~/lib/host-election";

interface Participant {
  clientId: number;
  name: string;
  color: string;
  isHost: boolean;
  isLocal: boolean;
}

interface ParticipantListProps {
  yjs: YjsState;
}

export function ParticipantList({ yjs }: ParticipantListProps) {
  const { t } = useTranslation("planner");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const updateParticipants = useCallback(() => {
    const states = yjs.awareness.getStates() as Map<number, Record<string, unknown>>;
    const localId = yjs.awareness.clientID;

    const list: Participant[] = [];
    states.forEach((state, clientId) => {
      const user = state.user as { color: string; name: string } | undefined;
      if (!user) return;

      const { isHost } = electHost(states, clientId);

      list.push({
        clientId,
        name: user.name,
        color: user.color,
        isHost,
        isLocal: clientId === localId,
      });
    });

    // Sort: local user first, then host, then alphabetical
    list.sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    setParticipants(list);
  }, [yjs.awareness]);

  useEffect(() => {
    yjs.awareness.on("change", updateParticipants);
    updateParticipants();

    return () => {
      yjs.awareness.off("change", updateParticipants);
    };
  }, [yjs.awareness, updateParticipants]);

  const startEditing = () => {
    const localParticipant = participants.find((p) => p.isLocal);
    if (localParticipant) {
      setEditValue(localParticipant.name);
      setEditing(true);
    }
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed.length <= 20) {
      yjs.setUserName(trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitEdit();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {participants.map((p) => (
        <div key={p.clientId} className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          {p.isLocal && editing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              maxLength={20}
              className="w-20 rounded border border-gray-300 px-1 py-0 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={p.isLocal ? startEditing : undefined}
              className={`text-xs text-gray-700 ${p.isLocal ? "cursor-pointer hover:underline" : "cursor-default"}`}
              title={p.isLocal ? t("participants.editName") : p.name}
            >
              {p.name}
              {p.isLocal && (
                <span className="ml-0.5 text-gray-400">{t("participants.you")}</span>
              )}
            </button>
          )}
          {p.isHost && (
            <span className="rounded-full bg-green-100 px-1.5 py-0 text-[10px] text-green-700">
              {t("participants.host")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
