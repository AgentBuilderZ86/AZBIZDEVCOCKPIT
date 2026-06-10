import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { parseAoFile } from "@/lib/intelligence/parse-ao-excel";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_EXT = new Set(["xlsx", "csv"]);
const ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",
  "application/octet-stream", // certains navigateurs n'envoient pas de type fiable
  "",
]);

export async function POST(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive (DATABASE_URL)." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête multipart invalide." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Champ 'file' manquant." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 5 Mo)." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: "Format non supporté. Acceptés : xlsx, csv." },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.has((file.type ?? "").toLowerCase())) {
    return NextResponse.json(
      { error: "Type de fichier non autorisé." },
      { status: 400 }
    );
  }

  let rows: Awaited<ReturnType<typeof parseAoFile>>;
  try {
    const buffer = await file.arrayBuffer();
    rows = await parseAoFile(buffer, file.name);
  } catch (err) {
    return NextResponse.json(
      { error: `Erreur de parsing : ${err instanceof Error ? err.message : "inconnu"}` },
      { status: 422 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Aucune ligne détectée dans le fichier. Vérifiez les en-têtes de colonnes." },
      { status: 422 }
    );
  }

  try {
    const db = getDb();

    // 1. Créer le batch
    const batches = await db<{ id: string }[]>`
      INSERT INTO ao_import_batches (file_name, ao_count)
      VALUES (${file.name}, ${rows.length})
      RETURNING id
    `;
    const batchId = batches[0].id;

    // 2. Insérer les AOs (bulk)
    for (const r of rows) {
      const datePublication = r.datePublication || null;
      const deadline = r.deadline || null;
      const budgetKEur = r.budgetKEur ? parseFloat(r.budgetKEur.replace(/[^\d.,]/g, "").replace(",", ".")) || null : null;

      await db`
        INSERT INTO ao_submissions
          (batch_id, titre, client, date_publication, deadline, budget_k_eur, description, source_url, secteur)
        VALUES
          (${batchId}, ${r.titre}, ${r.client}, ${datePublication}, ${deadline}, ${budgetKEur}, ${r.description}, ${r.sourceUrl}, ${r.secteur})
      `;
    }

    // 3. Enqueue AI qualification si ANTHROPIC_API_KEY disponible
    let jobId: string | null = null;
    if (process.env.ANTHROPIC_API_KEY) {
      jobId = await enqueueJob("ao.qualify", { batchId }, `ao.qualify:${batchId}`);
      if (jobId) {
        await db`UPDATE ao_import_batches SET qualify_job_id = ${jobId} WHERE id = ${batchId}`;
      }
    }

    return NextResponse.json({ ok: true, batchId, count: rows.length, jobId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur DB." },
      { status: 500 }
    );
  }
}
