import "server-only";
import ExcelJS from "exceljs";

export interface RawAoRow {
  titre: string;
  client: string;
  datePublication: string;
  deadline: string;
  budgetKEur: string;
  description: string;
  sourceUrl: string;
  secteur: string;
}

// Mapping flexible : normalise les en-têtes du fichier reçu vers nos champs
const COL_MAP: Record<string, keyof RawAoRow> = {
  // titre
  titre: "titre", objet: "titre", nom: "titre", "libellé": "titre",
  "intitulé": "titre", title: "titre", name: "titre",
  "objet du marché": "titre", marché: "titre",
  // client
  client: "client", organisme: "client", acheteur: "client",
  "entité": "client", organization: "client", company: "client",
  "pouvoir adjudicateur": "client", "maître d'ouvrage": "client",
  // datePublication
  date: "datePublication", "date de publication": "datePublication",
  "date publi": "datePublication", published: "datePublication",
  publication: "datePublication",
  // deadline
  deadline: "deadline", "date limite": "deadline",
  "date de remise": "deadline", "échéance": "deadline",
  "date de clôture": "deadline", "date limite de dépôt": "deadline",
  // budgetKEur
  budget: "budgetKEur", montant: "budgetKEur", valeur: "budgetKEur",
  "budget k€": "budgetKEur", "montant estimé": "budgetKEur",
  "enveloppe": "budgetKEur", amount: "budgetKEur",
  // description
  description: "description", "objet du marché détaillé": "description",
  "détail": "description", detail: "description", summary: "description",
  résumé: "description", contenu: "description",
  // sourceUrl
  url: "sourceUrl", lien: "sourceUrl", source: "sourceUrl",
  link: "sourceUrl", "lien source": "sourceUrl",
  // secteur
  secteur: "secteur", domaine: "secteur", sector: "secteur",
  "domaine d'activité": "secteur", activité: "secteur",
};

function normalizeKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Convertit une valeur de cellule ExcelJS en texte (gère dates, formules, rich text). */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("result" in v && v.result != null) return String(v.result).trim();
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((p) => String((p as { text?: string }).text ?? "")).join("").trim();
    }
    if ("hyperlink" in v && typeof v.hyperlink === "string") return v.hyperlink.trim();
    return "";
  }
  return String(value).trim();
}

/** Parse un CSV simple (délimiteur , ou ; ; gère les champs entre guillemets). */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
    return obj;
  });
}

function mapRow(row: Record<string, unknown>): RawAoRow {
  const out: RawAoRow = {
    titre: "", client: "", datePublication: "", deadline: "",
    budgetKEur: "", description: "", sourceUrl: "", secteur: "",
  };
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const normalized = normalizeKey(rawKey);
    const field = COL_MAP[normalized];
    if (field) {
      out[field] = String(rawValue ?? "").trim();
    }
  }
  // Fallback: si titre vide, utiliser la première colonne non vide
  if (!out.titre) {
    const first = Object.values(row).find((v) => v && String(v).trim());
    if (first) out.titre = String(first).trim();
  }
  return out;
}

/**
 * Parse un fichier Excel (.xlsx) ou CSV en tableau de RawAoRow.
 * Prend uniquement la première feuille du classeur.
 * (Remplace l'ancienne lib `xlsx`, vulnérable et non maintenue.)
 */
export async function parseAoFile(buffer: ArrayBuffer, fileName: string): Promise<RawAoRow[]> {
  const isCsv = fileName.toLowerCase().endsWith(".csv");

  let rows: Record<string, unknown>[];
  if (isCsv) {
    rows = parseCsv(new TextDecoder().decode(buffer));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];

    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
      headers[col] = cellText(cell.value);
    });

    rows = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const obj: Record<string, unknown> = {};
      let hasValue = false;
      headers.forEach((key, col) => {
        if (!key) return;
        const val = cellText(row.getCell(col).value);
        obj[key] = val;
        if (val) hasValue = true;
      });
      if (hasValue) rows.push(obj);
    }
  }

  return rows
    .map(mapRow)
    .filter((r) => r.titre.length > 0); // Ignorer les lignes vides
}
