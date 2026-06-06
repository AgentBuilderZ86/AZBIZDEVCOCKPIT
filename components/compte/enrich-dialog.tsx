"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { parseApiJson } from "@/lib/parse-api-json";
import type {
  CompteFieldProposal,
  EnrichmentApply,
  EnrichmentProposal,
} from "@/lib/types";

interface Props {
  compteId: string;
}

type FieldKey = keyof CompteFieldProposal;

const FIELD_LABELS: Record<string, string> = {
  effectif: "Effectif",
  caEstime: "CA estimé",
  secteur: "Secteur",
  scoreAdilStar: "Score AdilStar",
  planStrategique: "Plan stratégique",
};

const CONTACT_FIELD_LABELS: Record<string, string> = {
  prenom: "Prénom",
  nom: "Nom",
  titre: "Titre",
  email: "Email",
  linkedin: "LinkedIn",
  telephone: "Téléphone",
  direction: "Direction",
  niveauInfluence: "Influence",
};

export function EnrichDialog({ compteId }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadingStatus, setLoadingStatus] = React.useState<string>("");
  const [loadingProgress, setLoadingProgress] = React.useState<number>(0);
  const [applying, setApplying] = React.useState(false);
  const [proposal, setProposal] = React.useState<EnrichmentProposal | null>(null);

  const [fields, setFields] = React.useState<Set<FieldKey>>(new Set());
  const [contactsSel, setContactsSel] = React.useState<boolean[]>([]);
  const [contactUpdatesSel, setContactUpdatesSel] = React.useState<boolean[]>([]);
  const [signauxSel, setSignauxSel] = React.useState<boolean[]>([]);

  async function runEnrich() {
    setOpen(true);
    setLoading(true);
    setProposal(null);
    setLoadingProgress(0);
    setLoadingStatus("Collecte des sources (Apollo · Hunter · Explorium)…");
    try {
      // Lance un timer d'avancement visuel pendant l'attente (~20s)
      const steps = [
        { at: 2000, pct: 20, label: "Collecte Apollo · Hunter · Explorium…" },
        { at: 5000, pct: 45, label: "Analyse des données firmographiques…" },
        { at: 8000, pct: 65, label: "Analyse Claude Sonnet en cours…" },
        { at: 12000, pct: 85, label: "Calcul du score & plan stratégique…" },
      ];
      const timers = steps.map(({ at, pct, label }) =>
        setTimeout(() => {
          setLoadingProgress(pct);
          setLoadingStatus(label);
        }, at)
      );

      const res = await fetch(`/api/comptes/${compteId}/enrich`, { method: "POST" });
      timers.forEach(clearTimeout);

      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(String(data.error ?? "Échec de l'enrichissement."));

      const p = data.proposal as EnrichmentProposal;
      if (!p) throw new Error("Proposition absente de la réponse.");

      setLoadingProgress(100);
      setProposal(p);
      setFields(new Set(Object.keys(p.proposed) as FieldKey[]));
      setContactsSel(p.newContacts.map(() => true));
      setContactUpdatesSel((p.contactUpdates ?? []).map(() => true));
      setSignauxSel(p.newSignaux.map(() => true));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur enrichissement.");
      setOpen(false);
    } finally {
      setLoading(false);
      setLoadingProgress(0);
      setLoadingStatus("");
    }
  }

  function toggleField(k: FieldKey) {
    setFields((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  async function apply() {
    if (!proposal) return;
    const compteUpdate: CompteFieldProposal = {};
    Array.from(fields).forEach((k) => {
      // @ts-expect-error index assignment across union
      compteUpdate[k] = proposal.proposed[k];
    });
    const payload: EnrichmentApply = {
      compteUpdate,
      contacts: proposal.newContacts.filter((_, i) => contactsSel[i]),
      contactUpdates: (proposal.contactUpdates ?? [])
        .filter((_, i) => contactUpdatesSel[i])
        .map((u) => ({ contactId: u.contactId, patch: u.proposed })),
      signaux: proposal.newSignaux.filter((_, i) => signauxSel[i]),
    };

    setApplying(true);
    try {
      const res = await fetch(`/api/comptes/${compteId}/enrich`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error ?? "Échec de l'application.");
      const r = data.result as { updatedCompte?: boolean; contactsCreated?: number; contactsUpdated?: number; signauxCreated?: number };
      const parts: string[] = [];
      if (r.updatedCompte) parts.push("compte mis à jour");
      if (r.contactsCreated) parts.push(`${r.contactsCreated} contact(s) créé(s)`);
      if (r.contactsUpdated) parts.push(`${r.contactsUpdated} contact(s) complété(s)`);
      if (r.signauxCreated) parts.push(`${r.signauxCreated} signal/aux`);
      toast.success(parts.length ? `Appliqué : ${parts.join(", ")}.` : "Appliqué.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'application.");
    } finally {
      setApplying(false);
    }
  }

  const proposedKeys = proposal
    ? (Object.keys(proposal.proposed) as FieldKey[])
    : [];
  const nothingToApply =
    proposal != null &&
    fields.size === 0 &&
    !contactsSel.some(Boolean) &&
    !contactUpdatesSel.some(Boolean) &&
    !signauxSel.some(Boolean);

  return (
    <>
      <Button size="sm" onClick={runEnrich} disabled={loading}>
        <Sparkles className="h-4 w-4" />
        {loading ? "Enrichissement…" : "Enrichir"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposition d&apos;enrichissement</DialogTitle>
            <DialogDescription>
              Sélectionnez les éléments à écrire dans Notion. Rien n&apos;est
              appliqué tant que vous ne validez pas.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 animate-pulse text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {loadingStatus || "Enrichissement en cours…"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Apollo · Hunter · Claude Sonnet — 12–20 secondes
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progression</span>
                  <span>{loadingProgress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-700"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {proposal && !loading && (
            <div className="space-y-5">
              {proposal.warnings.length > 0 && (
                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <ul className="space-y-0.5">
                    {proposal.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Champs compte */}
              {proposedKeys.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Champs du compte</h3>
                  <div className="space-y-2">
                    {proposedKeys.map((k) => (
                      <label
                        key={k}
                        className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={fields.has(k)}
                          onChange={() => toggleField(k)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{FIELD_LABELS[k] ?? k}</div>
                          {k === "planStrategique" ? (
                            <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
                              {String(proposal.proposed[k])}
                            </p>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              <span className="line-through">
                                {fmt(proposal.current[k])}
                              </span>{" "}
                              → <span className="text-foreground">{fmt(proposal.proposed[k])}</span>
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  {proposal.rationale && (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      {proposal.rationale}
                    </p>
                  )}
                </section>
              )}

              {/* Contacts existants à compléter */}
              {(proposal.contactUpdates ?? []).length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    Contacts à compléter · {(proposal.contactUpdates ?? []).length}
                  </h3>
                  <div className="space-y-1">
                    {(proposal.contactUpdates ?? []).map((u, i) => (
                      <label
                        key={u.contactId}
                        className="flex cursor-pointer items-start gap-2 rounded-md border border-blue-200 bg-blue-50/50 p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={contactUpdatesSel[i] ?? false}
                          onChange={() =>
                            setContactUpdatesSel((s) =>
                              s.map((v, idx) => (idx === i ? !v : v))
                            )
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{u.nomComplet}</div>
                          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {Object.entries(u.proposed).map(([key, val]) => (
                              <li key={key}>
                                <span className="font-medium text-foreground">
                                  {CONTACT_FIELD_LABELS[key] ?? key}
                                </span>
                                :{" "}
                                <span className="line-through">
                                  {fmt(u.current[key as keyof typeof u.current])}
                                </span>{" "}
                                → {fmt(val)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {/* Nouveaux contacts */}
              {proposal.newContacts.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    Nouveaux contacts · {proposal.newContacts.length}
                  </h3>
                  <div className="space-y-1">
                    {proposal.newContacts.map((c, i) => (
                      <label
                        key={i}
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={contactsSel[i] ?? false}
                          onChange={() =>
                            setContactsSel((s) =>
                              s.map((v, idx) => (idx === i ? !v : v))
                            )
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div>
                            <span className="font-medium">{c.nomComplet}</span>
                            {c.titre && (
                              <span className="text-muted-foreground"> — {c.titre}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            {c.email && <span>✉ {c.email}</span>}
                            {c.telephone && <span>📞 {c.telephone}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {c.direction === "Achats" && (
                            <Badge className="bg-amber-100 font-normal text-amber-800">
                              Achats
                            </Badge>
                          )}
                          {c.niveauInfluence && (
                            <Badge variant="outline" className="font-normal">
                              {c.niveauInfluence}
                            </Badge>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {/* Signaux */}
              {proposal.newSignaux.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    Signaux suggérés · {proposal.newSignaux.length}
                  </h3>
                  <div className="space-y-1">
                    {proposal.newSignaux.map((s, i) => (
                      <label
                        key={i}
                        className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={signauxSel[i] ?? false}
                          onChange={() =>
                            setSignauxSel((s2) =>
                              s2.map((v, idx) => (idx === i ? !v : v))
                            )
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{s.titre}</div>
                          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                            {s.typeSignal && <span>{s.typeSignal}</span>}
                            {s.scoreOpportunite && <span>· {s.scoreOpportunite}</span>}
                          </div>
                          {s.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{s.notes}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {proposedKeys.length === 0 &&
                proposal.newContacts.length === 0 &&
                (proposal.contactUpdates ?? []).length === 0 &&
                proposal.newSignaux.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucune proposition d&apos;enrichissement disponible.
                  </p>
                )}

              {proposal.sources.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Sources : {proposal.sources.join(" · ")}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={applying}>
              Annuler
            </Button>
            <Button
              onClick={apply}
              disabled={!proposal || loading || applying || nothingToApply}
            >
              {applying ? "Application…" : "Appliquer la sélection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}
