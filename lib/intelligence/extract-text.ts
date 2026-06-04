import "server-only";

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
    // Entrée package "pdf-parse" : en serverless module.parent est absent et
    // déclenche un readFileSync sur ./test/data/… (ENOENT → 500 Netlify).
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const parsed = await pdfParse(buf);
    return {
      text: parsed.text ?? "",
      suggestedTitle: basename(name),
    };
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
