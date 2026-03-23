/**
 * Determines which client should be the routing host.
 *
 * Simple rule: the real client (has user state) with the lowest
 * client ID is always the host. Deterministic, no race conditions.
 */
export function electHost(
  states: Map<number, Record<string, unknown>>,
  localId: number,
): { isHost: boolean; role: "host" | "participant" } {
  let lowestRealId = Infinity;

  states.forEach((state, clientId) => {
    if (state.user) {
      if (clientId < lowestRealId) lowestRealId = clientId;
    }
  });

  // No real clients found (shouldn't happen, but defensive)
  if (lowestRealId === Infinity) {
    return { isHost: true, role: "host" };
  }

  const isHost = localId === lowestRealId;
  return { isHost, role: isHost ? "host" : "participant" };
}
