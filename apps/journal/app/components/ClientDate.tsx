import { useState, useEffect } from "react";

/**
 * Renders a date only on the client to avoid SSR hydration mismatches.
 * Server renders empty, client fills in with user's locale.
 */
export function ClientDate({ iso }: { iso: string }) {
  const [formatted, setFormatted] = useState(new Date(iso).toLocaleDateString("en-US"));

  useEffect(() => {
    setFormatted(new Date(iso).toLocaleDateString());
  }, [iso]);

  return <time dateTime={iso}>{formatted}</time>;
}
