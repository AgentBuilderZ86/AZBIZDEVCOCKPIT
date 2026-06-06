import "server-only";
import * as XLSX from "xlsx";

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
 * Parse un fichier Excel (.xlsx, .xls) ou CSV en tableau de RawAoRow.
 * Prend uniquement la première feuille du classeur.
 */
export function parseAoFile(buffer: ArrayBuffer, fileName: string): RawAoRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, dateNF: "yyyy-mm-dd" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    raw: false,
    defval: "",
  });
  return rows
    .map(mapRow)
    .filter((r) => r.titre.length > 0); // Ignorer les lignes vides
}
