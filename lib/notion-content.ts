import "server-only";
import { Client } from "@notionhq/client";
import { notionConfig } from "./config";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = new Client({ auth: notionConfig().token });
  }
  return client;
}

/** Extrait l'ID Notion depuis une URL ou un UUID brut. */
export function parseNotionPageId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hexOnly = trimmed.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/i.test(hexOnly)) {
    return formatUuid(hexOnly);
  }

  const m = trimmed.match(
    /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (!m) return null;
  const raw = m[1].replace(/-/g, "");
  return raw.length === 32 ? formatUuid(raw) : null;
}

function formatUuid(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Extrait le texte brut d'une page Notion (blocs récursifs). */
export async function fetchNotionPagePlainText(
  pageId: string,
  opts: { maxBlocks?: number } = {}
): Promise<{ title: string; text: string }> {
  const notion = getClient();
  const maxBlocks = opts.maxBlocks ?? 200;

  const page = await notion.pages.retrieve({ page_id: pageId });
  const title =
    "properties" in page
      ? extractPageTitle(page.properties as Record<string, unknown>)
      : "Page Notion";

  const parts: string[] = [];
  let count = 0;
  await collectBlocks(notion, pageId, parts, () => ++count > maxBlocks);

  return { title, text: parts.join("\n\n").trim() };
}

function extractPageTitle(properties: Record<string, unknown>): string {
  for (const prop of Object.values(properties)) {
    const p = prop as { type?: string; title?: { plain_text: string }[] };
    if (p?.type === "title" && p.title?.length) {
      return p.title.map((t) => t.plain_text).join("");
    }
  }
  return "Page Notion";
}

async function collectBlocks(
  notion: Client,
  blockId: string,
  parts: string[],
  shouldStop: () => boolean
): Promise<void> {
  if (shouldStop()) return;

  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of res.results) {
      if (shouldStop()) return;
      const text = blockToPlainText(block as Record<string, unknown>);
      if (text) parts.push(text);

      if ((block as { has_children?: boolean }).has_children) {
        await collectBlocks(
          notion,
          (block as { id: string }).id,
          parts,
          shouldStop
        );
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
}

function blockToPlainText(block: Record<string, unknown>): string {
  const type = block.type as string | undefined;
  if (!type || type === "child_page" || type === "child_database") return "";

  const payload = block[type] as { rich_text?: { plain_text: string }[] } | undefined;
  if (payload?.rich_text?.length) {
    return payload.rich_text.map((t) => t.plain_text).join("");
  }

  if (type === "divider") return "---";
  return "";
}
