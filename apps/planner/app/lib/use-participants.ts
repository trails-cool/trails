import { useCallback, useEffect, useState } from "react";
import type { YjsState } from "./use-yjs";
import { electHost } from "./host-election";

export interface Participant {
  clientId: number;
  name: string;
  color: string;
  isHost: boolean;
  isLocal: boolean;
}

/**
 * Derive the live participant list from Yjs awareness, sorted local → host →
 * alphabetical. Presentational components (ParticipantAvatars, the gallery)
 * take the resulting plain array so they can be rendered without a live
 * session. Accepts a null session so it can be called before SessionView's
 * connecting-gate early return.
 */
export function useParticipants(yjs: YjsState | null): {
  participants: Participant[];
  renameLocal: (name: string) => void;
} {
  const [participants, setParticipants] = useState<Participant[]>([]);

  const update = useCallback(() => {
    if (!yjs) {
      setParticipants([]);
      return;
    }
    const states = yjs.awareness.getStates() as Map<
      number,
      Record<string, unknown>
    >;
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

    list.sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    setParticipants(list);
  }, [yjs]);

  useEffect(() => {
    if (!yjs) return;
    yjs.awareness.on("change", update);
    update();
    return () => {
      yjs.awareness.off("change", update);
    };
  }, [yjs, update]);

  const renameLocal = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (yjs && trimmed && trimmed.length <= 20) {
        yjs.setUserName(trimmed);
      }
    },
    [yjs],
  );

  return { participants, renameLocal };
}
