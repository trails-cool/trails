import { useEffect, useState } from "react";
import { electHost } from "./host-election.ts";
import type { YjsState } from "./use-yjs.ts";

export function useHostElection(yjs: YjsState | null): boolean {
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!yjs) return;

    const checkHost = () => {
      const states = yjs.awareness.getStates() as Map<number, Record<string, unknown>>;
      const localId = yjs.awareness.clientID;
      const { isHost: amHost, role } = electHost(states, localId);
      setIsHost(amHost);
      yjs.awareness.setLocalStateField("role", role);
    };

    yjs.awareness.on("change", checkHost);
    checkHost();

    return () => {
      yjs.awareness.off("change", checkHost);
    };
  }, [yjs]);

  return isHost;
}
