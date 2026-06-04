/** Découpe un texte long en chunks (~800 tokens ≈ 3200 car., overlap ~100 tokens). */
export function chunkText(
  text: string,
  opts: { size?: number; overlap?: number; minLength?: number } = {}
): string[] {
  const size = opts.size ?? 3200;
  const overlap = opts.overlap ?? 400;
  const minLength = opts.minLength ?? 80;

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + size, normalized.length);
    const slice = normalized.slice(start, end).trim();
    if (slice.length >= minLength) chunks.push(slice);
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}
