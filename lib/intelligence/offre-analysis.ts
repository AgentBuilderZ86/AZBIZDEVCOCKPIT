import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integrations } from "../config";
import { getCompte, listContactsByCompte, listOpportunitesByCompte, listSignauxByCompte } from "../notion";
import { isIntelligenceEnabled } from "./config";
import { searchKnowledge } from "./knowledge";
import { getDb } from "./db";
import { appendAccountJournal } from "./journal";
import type {
  OffreAnalysis,
  OffreMappingRow,
  ActionStep,
  CoverageIndicator,
  OffreSynthesisPayload,
  OffreSynthesisRow,
} from "../types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

const VALID_COVERAGES: CoverageIndicator[] = ["rag_indexed", "expertise_sia", "gap"];
const VALID_HORIZONS = ["J+7", "J+30", "J+90", "J+180"] as const;

function parseMappingRow(raw: unknown): OffreMappingRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const topic = typeof r.topic === "string" ? r.topic.trim() : null;
  const siaOffer =
    typeof r.siaOffer === "string"
      ? r.siaOffer.trim()
      : typeof r.siaoffer === "string"
        ? r.siaoffer.trim()
        : null;
  const coverage = VALID_COVERAGES.includes(r.coverage as CoverageIndicator)
    ? (r.coverage as CoverageIndicator)
    : "expertise_sia";
  if (!topic || !siaOffer) return null;
  const ragDocTitles = Array.isArray(r.ragDocTitles)
    ? (r.ragDocTitles as unknown[]).filter((t) => typeof t === "string").map(String)
    : [];
  const rationale = typeof r.rationale === "string" ? r.rationale.trim() : "";
  return { topic, siaOffer, coverage, ragDocTitles, rationale };
}

function parseActionStep(raw: unknown, index: number): ActionStep | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const action = typeof r.action === "string" ? r.action.trim() : null;
  if (!action) return null;
  const order = typeof r.order === "number" ? r.order : index + 1;
  const horizon = VALID_HORIZONS.includes(r.horizon as (typeof VALID_HORIZONS)[number])
    ? (r.horizon as ActionStep["horizon"])
    : "J+30";
  const targetContacts = Array.isArray(r.targetContacts)
    ? (r.targetContacts as unknown[]).filter((t) => typeof t === "string").map(String)
    : [];
  const linkedOffer = typeof r.linkedOffer === "string" ? r.linkedOffer.trim() || null : null;
  return { order, horizon, action, targetContacts, linkedOffer };
}

export async function getCachedAnalysis(compteId: string): Promise<OffreAnalysis | null> {
  if (!isIntelligenceEnabled()) return null;
  try {
    const db = getDb();
    const rows = await db<
      {
        compte_id: string;
        generated_at: Date;
        mapping_rows: unknown;
        action_steps: unknown;
        synthese_narrative: string;
      }[]
    >`
      SELECT compte_id, generated_at, mapping_rows, action_steps, synthese_narrative
      FROM compte_offre_analysis
      WHERE compte_id = ${compteId}
        AND generated_at > now() - INTERVAL '24 hours'
      LIMIT 1
    `;
    if (!rows.length) return null;
    const row = rows[0];
    const mappingRows = (Array.isArray(row.mapping_rows) ? row.mapping_rows : [])
      .map(parseMappingRow)
      .filter((r): r is OffreMappingRow => r !== null);
    const actionSteps = (Array.isArray(row.action_steps) ? row.action_steps : [])
      .map(parseActionStep)
      .filter((s): s is ActionStep => s !== null);
    return {
      compteId: row.compte_id,
      generatedAt: row.generated_at.toISOString(),
      mappingRows,
      actionSteps,
      syntheseNarrative: row.synthese_narrative,
    };
  } catch {
    return null;
  }
}

async function saveAnalysis(
  analysis: OffreAnalysis,
  ragHitCount: number,
  compteUrl: string
): Promise<void> {
  if (!isIntelligenceEnabled()) return;
  const db = getDb();
  await db`
    INSERT INTO compte_offre_analysis
      (compte_id, compte_url, mapping_rows, action_steps, synthese_narrative, rag_hit_count)
    VALUES (
      ${analysis.compteId},
      ${compteUrl},
      ${db.json(analysis.mappingRows as never)},
      ${db.json(analysis.actionSteps as never)},
      ${analysis.syntheseNarrative},
      ${ragHitCount}
    )
    ON CONFLICT (compte_id) DO UPDATE SET
      compte_url = EXCLUDED.compte_url,
      mapping_rows = EXCLUDED.mapping_rows,
      action_steps = EXCLUDED.action_steps,
      synthese_narrative = EXCLUDED.synthese_narrative,
      rag_hit_count = EXCLUDED.rag_hit_count,
      generated_at = now()
  `;
}

const SYSTEM_OFFRE = `Tu es analyste BizDev senior chez Sia Partners Maroc (pour Adil Zriouil).
Tu analyses des comptes cibles pour identifier les opportunités d'offres Sia les plus pertinentes
et construire un plan d'action personnalisé et actionnable.

Offres Sia disponibles : Transformation digitale & Digital Banking, Data/IA, Excellence opérationnelle,
Risque & Conformité (Bâle, BAM), ESG/Durabilité, Stratégie & Organisation.

Règles strictes :
- Indique "rag_indexed" UNIQUEMENT si un document RAG fourni dans le contexte couvre ce topic.
- Indique "expertise_sia" si l'offre Sia est pertinente mais sans doc indexé dans le contexte.
- Indique "gap" si ni l'offre Sia ni les docs ne couvrent ce besoin identifié.
- Les étapes d'action doivent être concrètes, nominatives si contacts disponibles.
- Ne fabrique pas de chiffres, noms ou URLs absents du contexte fourni.
- Appelle toujours l'outil submit_offre_analysis pour structurer ta réponse.`;

const OFFRE_TOOL: Anthropic.Tool = {
  name: "submit_offre_analysis",
  description:
    "Soumet l'analyse structurée des offres Sia pertinentes et le plan d'action pour le compte cible.",
  input_schema: {
    type: "object",
    properties: {
      syntheseNarrative: {
        type: "string",
        description: "Synthèse executive en 3-5 phrases.",
      },
      mappingRows: {
        type: "array",
        description: "4 à 6 thématiques prioritaires mappées sur les offres Sia.",
        items: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Thématique prioritaire identifiée." },
            siaOffer: { type: "string", description: "Offre Sia à pousser." },
            coverage: {
              type: "string",
              enum: ["rag_indexed", "expertise_sia", "gap"],
            },
            ragDocTitles: {
              type: "array",
              items: { type: "string" },
              description: "Titres des docs RAG si coverage=rag_indexed.",
            },
            rationale: { type: "string", description: "1 phrase de justification." },
          },
          required: ["topic", "siaOffer", "coverage", "rationale"],
        },
      },
      actionSteps: {
        type: "array",
        description: "3 à 5 étapes d'action concrètes et séquencées.",
        items: {
          type: "object",
          properties: {
            order: { type: "number" },
            horizon: { type: "string", enum: ["J+7", "J+30", "J+90", "J+180"] },
            action: { type: "string", description: "Action concrète et actionnable." },
            targetContacts: {
              type: "array",
              items: { type: "string" },
              description: "Noms des contacts ciblés.",
            },
            linkedOffer: { type: ["string", "null"] },
          },
          required: ["order", "horizon", "action"],
        },
      },
    },
    required: ["syntheseNarrative", "mappingRows", "actionSteps"],
  },
};

export async function analyzeCompteOffres(
  compteId: string,
  opts: { forceRefresh?: boolean } = {}
): Promise<OffreAnalysis> {
  if (!isIntelligenceEnabled()) {
    throw new Error("Couche Intelligence inactive (DATABASE_URL).");
  }
  if (!integrations.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY absente.");
  }

  if (!opts.forceRefresh) {
    const cached = await getCachedAnalysis(compteId);
    if (cached) return cached;
  }

  // Étape 1 : compte seul (~1s) pour construire la requête RAG
  const compte = await getCompte(compteId);

  const ragQuery = [
    compte.secteur ?? "",
    compte.compte,
    "transformation digitale data excellence opérationnelle risque ESG",
  ]
    .filter(Boolean)
    .join(" ");

  // Étape 2 : relations Notion + RAG en parallèle (~3-4s au lieu de ~8s séquentiel)
  const [relationsResult, hitsResult] = await Promise.allSettled([
    Promise.all([
      listContactsByCompte(compteId),
      listOpportunitesByCompte(compteId),
      listSignauxByCompte(compteId),
    ]),
    searchKnowledge(ragQuery, {
      // Pas de filtre accountUrl : les docs RAG sont génériques (propales, offres, méthodo).
      // Pas de filtre sector : un doc cross-secteur doit remonter pour tous les comptes.
      k: 8,
    }),
  ]);

  const [contacts, opportunites, signaux] =
    relationsResult.status === "fulfilled" ? relationsResult.value : [[], [], []];
  const hits = hitsResult.status === "fulfilled" ? hitsResult.value : [];

  const ragContext =
    hits.length > 0
      ? hits
          .map(
            (h, i) =>
              `[Doc ${i + 1}] « ${h.doc.title} » (${h.doc.sourceType}${h.doc.sector ? `, ${h.doc.sector}` : ""})\n${h.chunkText.slice(0, 600)}`
          )
          .join("\n\n")
      : "Aucun document indexé trouvé pour ce compte.";

  const notionContext = {
    compte: {
      nom: compte.compte,
      secteur: compte.secteur,
      stage: compte.stage,
      priorite: compte.priorite,
      scoreAdilStar: compte.scoreAdilStar,
      effectif: compte.effectif,
      caEstime: compte.caEstime,
      planStrategique: compte.planStrategique?.slice(0, 800) || null,
    },
    contacts: contacts.slice(0, 5).map((c) => ({
      nom: c.nomComplet,
      titre: c.titre,
      influence: c.niveauInfluence,
      statut: c.statutContact,
    })),
    signaux: signaux.slice(0, 3).map((s) => ({
      titre: s.titre,
      type: s.typeSignal,
      score: s.scoreOpportunite,
    })),
    opportunites: opportunites.slice(0, 3).map((o) => ({
      nom: o.opportunite,
      stage: o.stage,
      montant: o.montant,
    })),
  };

  const userMsg = `Compte cible : ${compte.compte}${compte.secteur ? ` (${compte.secteur})` : ""}
Stage : ${compte.stage ?? "—"} | Priorité : ${compte.priorite ?? "—"} | Score : ${compte.scoreAdilStar ?? "—"}

--- Documents RAG indexés (extraits) ---
${ragContext}

--- Contexte Notion ---
${JSON.stringify(notionContext, null, 2)}

Analyse ce compte et appelle l'outil submit_offre_analysis avec 4 à 6 mappingRows
et 3 à 5 actionSteps. Sois concis et actionnable.`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: [
      {
        type: "text",
        text: SYSTEM_OFFRE,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [OFFRE_TOOL],
    tool_choice: { type: "tool", name: "submit_offre_analysis" },
    messages: [{ role: "user", content: userMsg }],
  });

  // Sortie structurée garantie via tool_use — plus de JSON markdown à parser.
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  let parsed: Record<string, unknown> | null = toolUse
    ? (toolUse.input as Record<string, unknown>)
    : null;

  // Filet de sécurité : si pas de tool_use (cas rare), tente l'ancien parsing texte.
  if (!parsed) {
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    parsed = extractJson(text) as Record<string, unknown> | null;
  }

  if (!parsed) {
    throw new Error("Réponse Claude invalide — JSON non parsable.");
  }

  const rawMappings = Array.isArray(parsed.mappingRows) ? parsed.mappingRows : [];
  const rawSteps = Array.isArray(parsed.actionSteps) ? parsed.actionSteps : [];

  const mappingRows = rawMappings
    .map(parseMappingRow)
    .filter((r): r is OffreMappingRow => r !== null);

  const actionSteps = rawSteps
    .map((s, i) => parseActionStep(s, i))
    .filter((s): s is ActionStep => s !== null)
    .sort((a, b) => a.order - b.order);

  const syntheseNarrative =
    typeof parsed.syntheseNarrative === "string"
      ? parsed.syntheseNarrative.trim()
      : "Analyse générée par Sia Partners Maroc.";

  if (mappingRows.length === 0) {
    throw new Error("Aucune ligne de mapping extraite — analyse invalide.");
  }

  const analysis: OffreAnalysis = {
    compteId,
    generatedAt: new Date().toISOString(),
    mappingRows,
    actionSteps,
    syntheseNarrative,
  };

  // Non-bloquant : si la migration 004 n'a pas été jouée, l'analyse est quand même retournée.
  void saveAnalysis(analysis, hits.length, compte.url).catch(() => {});

  void appendAccountJournal({
    accountUrl: compte.url,
    accountId: compte.id,
    eventType: "enrichment",
    source: "enrichment",
    payload: {
      type: "offre_mapping_generated",
      mappingCount: mappingRows.length,
      actionCount: actionSteps.length,
      ragHits: hits.length,
    },
  }).catch(() => {});

  return analysis;
}

export async function getOffreSynthesis(): Promise<OffreSynthesisPayload | null> {
  if (!isIntelligenceEnabled()) return null;
  try {
    const db = getDb();
    const rows = await db<
      {
        compte_id: string;
        mapping_rows: unknown;
        generated_at: Date;
      }[]
    >`
      SELECT compte_id, mapping_rows, generated_at
      FROM compte_offre_analysis
      ORDER BY generated_at DESC
    `;

    if (!rows.length) return null;

    const offerCounts = new Map<
      string,
      { count: number; coverages: CoverageIndicator[]; topics: string[] }
    >();
    const topicFreq = new Map<string, { frequency: number; sectors: string[] }>();
    const coverageSummary = { rag_indexed: 0, expertise_sia: 0, gap: 0 };

    // We need sectors — stored in the mapping_rows, not separately. Use a best-effort lookup.
    for (const row of rows) {
      const mappings = (Array.isArray(row.mapping_rows) ? row.mapping_rows : [])
        .map(parseMappingRow)
        .filter((r): r is OffreMappingRow => r !== null);

      for (const m of mappings) {
        coverageSummary[m.coverage]++;

        const existing = offerCounts.get(m.siaOffer) ?? {
          count: 0,
          coverages: [],
          topics: [],
        };
        existing.count++;
        existing.coverages.push(m.coverage);
        if (!existing.topics.includes(m.topic)) existing.topics.push(m.topic);
        offerCounts.set(m.siaOffer, existing);

        const tf = topicFreq.get(m.topic) ?? { frequency: 0, sectors: [] };
        tf.frequency++;
        topicFreq.set(m.topic, tf);
      }
    }

    const dominantCoverage = (coverages: CoverageIndicator[]): CoverageIndicator => {
      const counts: Record<CoverageIndicator, number> = {
        rag_indexed: 0,
        expertise_sia: 0,
        gap: 0,
      };
      for (const c of coverages) counts[c]++;
      return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as CoverageIndicator);
    };

    const synthesisRows: OffreSynthesisRow[] = Array.from(offerCounts.entries())
      .map(([siaOffer, data]) => ({
        siaOffer,
        accountCount: data.count,
        dominantCoverage: dominantCoverage(data.coverages),
        topTopics: data.topics.slice(0, 3),
      }))
      .sort((a, b) => b.accountCount - a.accountCount);

    const hotTopics = Array.from(topicFreq.entries())
      .map(([topic, data]) => ({ topic, frequency: data.frequency, sectors: data.sectors }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 12);

    return {
      synthesisRows,
      hotTopics,
      coverageSummary,
      accountsCovered: rows.length,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
