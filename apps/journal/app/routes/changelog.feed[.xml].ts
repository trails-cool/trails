import { getAllEntries } from "~/lib/changelog.server";
import Markdown from "react-markdown";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

function renderMarkdown(md: string): string {
  return renderToStaticMarkup(createElement(Markdown, null, md));
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function loader() {
  const entries = getAllEntries();
  const domain = process.env.DOMAIN ?? "trails.cool";
  const baseUrl = `https://${domain}`;
  const updated = entries[0]?.date ?? new Date().toISOString().slice(0, 10);

  const atomEntries = entries.map((entry) => {
    const html = renderMarkdown(entry.content);
    return `  <entry>
    <title>${escapeXml(entry.title)}</title>
    <link href="${baseUrl}/changelog/${entry.slug}" rel="alternate"/>
    <id>${baseUrl}/changelog/${entry.slug}</id>
    <updated>${entry.date}T00:00:00Z</updated>
    <content type="html">${escapeXml(html)}</content>
  </entry>`;
  });

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>trails.cool Changelog</title>
  <link href="${baseUrl}/changelog" rel="alternate"/>
  <link href="${baseUrl}/changelog/feed.xml" rel="self"/>
  <id>${baseUrl}/changelog</id>
  <updated>${updated}T00:00:00Z</updated>
${atomEntries.join("\n")}
</feed>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
