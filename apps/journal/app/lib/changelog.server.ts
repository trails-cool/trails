const modules = import.meta.glob("/changelog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export interface ChangelogEntry {
  slug: string;
  title: string;
  date: string;
  preview: string;
  content: string;
}

function parseFrontmatter(raw: string): {
  attrs: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { attrs: {}, body: raw };
  const attrs: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    attrs[key] = value;
  }
  return { attrs, body: match[2]! };
}

function firstParagraph(md: string): string {
  const trimmed = md.trim();
  const lines: string[] = [];
  for (const line of trimmed.split("\n")) {
    if (line.startsWith("#")) continue;
    if (lines.length > 0 && line.trim() === "") break;
    if (line.trim() !== "") lines.push(line);
  }
  return lines.join(" ").slice(0, 200);
}

function parseEntry(path: string, raw: string): ChangelogEntry {
  const slug = path.replace(/^\/changelog\//, "").replace(/\.md$/, "");
  const { attrs, body } = parseFrontmatter(raw);
  return {
    slug,
    title: attrs.title ?? slug,
    date: attrs.date ?? slug,
    preview: firstParagraph(body),
    content: body,
  };
}

let cachedEntries: ChangelogEntry[] | null = null;

export function getAllEntries(): ChangelogEntry[] {
  if (!cachedEntries) {
    cachedEntries = Object.entries(modules)
      .map(([path, raw]) => parseEntry(path, raw))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  return cachedEntries;
}

export function getEntry(slug: string): ChangelogEntry | undefined {
  return getAllEntries().find((e) => e.slug === slug);
}

export function getNewestDate(): string | null {
  const entries = getAllEntries();
  return entries.length > 0 ? entries[0]!.date : null;
}
