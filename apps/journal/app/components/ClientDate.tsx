import { useLocale } from "./LocaleContext";

/**
 * Renders a date formatted with the server-detected locale,
 * ensuring SSR and client output match (no hydration flicker).
 */
export function ClientDate({ iso }: { iso: string }) {
  const locale = useLocale();
  return (
    <time dateTime={iso}>{new Date(iso).toLocaleDateString(locale)}</time>
  );
}
