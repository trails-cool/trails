// Initials-only avatar. We don't have an image-upload story yet (the
// `users` table has no avatar URL column), so initials are the
// implementation. When images land, this component is the single
// place to add the image fallback.

interface Props {
  displayName: string | null;
  username: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function initialsOf(displayName: string | null, username: string): string {
  const source = (displayName ?? username).trim();
  if (source.length === 0) return "?";
  // Two-letter initials: first letter of the first two whitespace-
  // separated words, falling back to the first two characters when
  // the source is a single token.
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

export function Avatar({ displayName, username, size = "md", className = "" }: Props) {
  const initials = initialsOf(displayName, username);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-700 ${SIZE_CLASS[size]} ${className}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
