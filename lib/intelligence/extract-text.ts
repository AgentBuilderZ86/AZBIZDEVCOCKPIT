import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

const TEXT_EXT = new Set([".txt", ".md", ".markdown", ".json", ".csv"]);

/** Extrait le texte brut d'un fichier uploadé. */
export async function extractTextFromFile(
  file: File
): Promise<{ text: string; suggestedTitle: string }> {
  const name = file.name || "document";
  const lower = name.toLowerCase();

  if (TEXT_EXT.has(extname(lower))) {
    const text = await file.text();
    return { text, suggestedTitle: basename(name) };
  }

  if (lower.endsWith(".pdf")) {
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      const merged =
        typeof text === "string" ? text : (text as string[]).join("\n\n");
      return {
        text: merged.trim(),
        suggestedTitle: basename(name),
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Lecture PDF impossible (${name}) : ${detail.slice(0, 200)}. PDF protégé, scanné ou corrompu ?`
      );
    }
  }

  throw new Error(
    `Format non supporté : ${name}. Formats acceptés : .txt, .md, .pdf`
  );
}

function extname(path: string): string {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i);
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  const name = parts[parts.length - 1] ?? path;
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}
