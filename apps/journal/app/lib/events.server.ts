// In-process Server-Sent Events broker. Generation hooks call
// `emitTo(userId, event, data)` after they commit; any open SSE
// connection for that user gets the event written to its stream.
//
// Single-process today. When the Journal goes multi-process, swap the
// in-memory `Map` for a Redis pub/sub adapter behind the same
// emitTo/register interface — no caller changes needed.

interface Connection {
  send: (event: string, data: unknown) => void;
  close: () => void;
}

const connections = new Map<string /* userId */, Set<Connection>>();

export function register(userId: string, conn: Connection): () => void {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  set.add(conn);
  return () => {
    const s = connections.get(userId);
    if (!s) return;
    s.delete(conn);
    if (s.size === 0) connections.delete(userId);
  };
}

export function emitTo(userId: string, event: string, data: unknown): void {
  const set = connections.get(userId);
  if (!set) return;
  for (const conn of set) {
    try {
      conn.send(event, data);
    } catch {
      // Broken pipe — connection will get cleaned up on its own
      // teardown path; defensively close here too.
      try { conn.close(); } catch { /* ignore */ }
    }
  }
}

/** Test/diagnostic helper: how many connections does `userId` have? */
export function connectionCount(userId: string): number {
  return connections.get(userId)?.size ?? 0;
}
