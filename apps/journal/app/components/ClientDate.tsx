import { useLocale } from "./LocaleContext";

/**
 * Renders a date formatted with the server-detected locale,
 * ensuring SSR and client output match (no hydration flicker).
 * Pass `withTime` for surfaces where the hour/minute matter
 * (e.g. notifications), keeping plain dates as the default.
 */
export function ClientDate({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const locale = useLocale();
  const d = new Date(iso);
  const text = withTime
    ? d.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })
    : d.toLocaleDateString(locale);
  return <time dateTime={iso}>{text}</time>;
}
