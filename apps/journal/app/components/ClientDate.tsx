import { useState, useEffect } from "react";
import { useLocale } from "./LocaleContext";

/**
 * Renders a date using the server-detected locale for the initial render
 * (matching SSR output), then updates to the browser's native locale
 * after hydration.
 */
export function ClientDate({ iso }: { iso: string }) {
  const locale = useLocale();
  const [formatted, setFormatted] = useState(
    new Date(iso).toLocaleDateString(locale),
  );

  useEffect(() => {
    setFormatted(new Date(iso).toLocaleDateString());
  }, [iso]);

  return <time dateTime={iso}>{formatted}</time>;
}
