// Default timeout for outbound HTTP calls to third-party providers.
// Hung providers must not stall job workers or request handlers.
export const DEFAULT_EXTERNAL_FETCH_TIMEOUT_MS = 30_000;

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_EXTERNAL_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const signal = init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);
  return fetch(input, { ...init, signal });
}
