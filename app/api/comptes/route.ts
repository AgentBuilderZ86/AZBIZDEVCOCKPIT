import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listComptes, createCompte, type CompteFilters } from "@/lib/notion";
import type { CompteCreate } from "@/lib/types";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  compte: z.string().trim().min(1).max(300),
  secteur: z.string().max(120).nullish(),
  priorite: z.string().max(60).nullish(),
  stage: z.string().max(60).nullish(),
  statutRelation: z.string().max(60).nullish(),
  categorie: z.string().max(120).nullish(),
});

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filters: CompteFilters = {
      secteur: sp.get("secteur") ?? undefined,
      priorite: sp.get("priorite") ?? undefined,
      stage: sp.get("stage") ?? undefined,
      statutRelation: sp.get("statutRelation") ?? undefined,
    };
    const comptes = await listComptes(filters);
    return NextResponse.json({ comptes });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Le nom du compte est requis." },
        { status: 400 }
      );
    }
    const compte = await createCompte(parsed.data as CompteCreate);
    return NextResponse.json({ compte }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  const message =
    err instanceof Error ? err.message : "Erreur inconnue côté serveur.";
  const status = (err as { status?: number })?.status ?? 500;
  // eslint-disable-next-line no-console
  console.error("[api/comptes] error:", message);
  return NextResponse.json({ error: message }, { status });
}
