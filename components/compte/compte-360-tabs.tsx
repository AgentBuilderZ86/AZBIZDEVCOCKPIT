"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ExternalLink, CheckCircle2, Clock, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { valueBadgeClass } from "@/lib/compte-ui";
import { cn } from "@/lib/utils";
import { AO_STATUT_LABELS } from "@/lib/types";
import type { Contact, Opportunite, Signal, TacheRow } from "@/lib/types";
import { TacheForm } from "@/components/taches/tache-form";
import { TachesList } from "@/components/taches/taches-list";
import { useTacheActions } from "@/components/taches/use-tache-actions";

interface AoRow {
  id: string;
  titre: string;
  client: string;
  statut: string;
  score_fit: number | null;
  budget_k_eur: number | null;
  deadline: string | null;
  synthese: string;
  suggestion: string;
}

interface ActionRow {
  id: string;
  action_text: string;
  target_contacts: string;
  linked_offer: string | null;
  horizon: string;
  status: string;
  done_at: string | null;
  done_type: string | null;
  done_notes: string | null;
}

interface Props {
  contacts: Contact[];
  opportunites: Opportunite[];
  signaux: Signal[];
  aos?: AoRow[];
  actions?: ActionRow[];
  taches?: TacheRow[];
  compteId?: string;
  compteNom?: string;
}

const AO_STATUT_COLORS: Record<string, string> = {
  BO:      "bg-slate-100 text-slate-600 border-slate-200",
  BO_GO:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  BO_NOGO: "bg-red-100 text-red-600 border-red-200",
  P2P:     "bg-blue-100 text-blue-700 border-blue-200",
  PP:      "bg-violet-100 text-violet-700 border-violet-200",
  PW:      "bg-emerald-200 text-emerald-800 border-emerald-300",
  PL:      "bg-slate-200 text-slate-500 border-slate-300",
};

const HORIZON_COLORS: Record<string, string> = {
  "J+7":   "bg-red-100 text-red-700 border-red-200",
  "J+30":  "bg-amber-100 text-amber-700 border-amber-200",
  "J+90":  "bg-blue-100 text-blue-700 border-blue-200",
  "J+180": "bg-slate-100 text-slate-600 border-slate-200",
};

function scoreBadge(score: number | null) {
  if (score == null) return null;
  const cls = score >= 8 ? "bg-emerald-100 text-emerald-700" : score >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cls)}>{score}/10</span>;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">{label}</div>
  );
}

function ExtLink({ url }: { url: string }) {
  if (!url) return null;
  return (
    <Link href={url} target="_blank" className="text-muted-foreground hover:text-foreground">
      <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  );
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

export function Compte360Tabs({
  contacts,
  opportunites,
  signaux,
  aos = [],
  actions = [],
  taches = [],
  compteId = "",
  compteNom = "",
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = searchParams.get("tab") ?? "contacts";

  const [localActions, setLocalActions] = React.useState<ActionRow[]>(actions);
  const [localTaches, setLocalTaches] = React.useState<TacheRow[]>(taches);
  const tachesEnabled = Boolean(compteId);
  const tacheActions = useTacheActions(localTaches, setLocalTaches);

  async function markAction(id: string, status: "done" | "skipped") {
    await fetch(`/api/revue-actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLocalActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status, done_at: new Date().toISOString() } : a))
    );
  }

  function onTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const pendingActions = localActions.filter((a) => a.status === "pending");
  const doneActions = localActions.filter((a) => a.status !== "pending");

  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="contacts">Contacts · {contacts.length}</TabsTrigger>
        <TabsTrigger value="opps">Opportunités · {opportunites.length}</TabsTrigger>
        <TabsTrigger value="signaux">Signaux · {signaux.length}</TabsTrigger>
        {aos.length > 0 && <TabsTrigger value="aos">AOs · {aos.length}</TabsTrigger>}
        {tachesEnabled && (
          <TabsTrigger value="taches">
            Tâches{localTaches.length > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[10px] font-bold text-white">{localTaches.length}</span>}
          </TabsTrigger>
        )}
        {localActions.length > 0 && (
          <TabsTrigger value="actions">
            Actions{pendingActions.length > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0 text-[10px] font-bold text-white">{pendingActions.length}</span>}
          </TabsTrigger>
        )}
      </TabsList>

      {/* Contacts */}
      <TabsContent value="contacts">
        <div className="rounded-md border">
          {contacts.length === 0 ? (
            <Empty label="Aucun contact rattaché." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Influence</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="min-w-[160px]">
                      <p className="font-medium leading-tight">{c.nomComplet || "—"}</p>
                      {(c.direction || c.roleDecisionnel) && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70 leading-tight">
                          {[c.direction, c.roleDecisionnel].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {c.derniereInteraction && (
                        <p className={cn(
                          "mt-0.5 text-xs leading-tight",
                          daysSince(c.derniereInteraction) > 30 ? "text-orange-500" : "text-muted-foreground/50"
                        )}>
                          ↩ {fmtDate(c.derniereInteraction)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{c.titre || "—"}</TableCell>
                    <TableCell>{c.niveauInfluence ?? "—"}</TableCell>
                    <TableCell>
                      {c.prioriteEngagement && (
                        <Badge className={cn("font-normal", valueBadgeClass(c.prioriteEngagement))}>
                          {c.prioriteEngagement}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.statutContact && (
                        <Badge className={cn("font-normal", valueBadgeClass(c.statutContact))}>
                          {c.statutContact}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 text-xs">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-primary hover:underline">
                          {c.email}
                        </a>
                      )}
                      {c.telephone && (
                        <a href={`tel:${c.telephone}`} className="text-primary hover:underline">
                          {c.telephone}
                        </a>
                      )}
                      {c.linkedin && (
                        <Link href={c.linkedin} target="_blank" className="text-primary hover:underline">
                          in
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {tachesEnabled && (
                          <TacheForm
                            compteId={compteId}
                            compteNom={compteNom}
                            target={{ scope: "contact", cibleId: c.id, cibleNom: c.nomComplet }}
                            onCreated={(t) => setLocalTaches((prev) => [t, ...prev])}
                            trigger={
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Ajouter une tâche">
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        )}
                        <ExtLink url={c.url} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>

      {/* Opportunités */}
      <TabsContent value="opps">
        <div className="rounded-md border">
          {opportunites.length === 0 ? (
            <Empty label="Aucune opportunité." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunité</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Montant (k€)</TableHead>
                  <TableHead className="text-right">Prob. %</TableHead>
                  <TableHead className="text-right">ARR pond. (k€)</TableHead>
                  <TableHead>Clôture</TableHead>
                  <TableHead>Next step</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunites.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="min-w-[180px]">
                      <p className="font-medium leading-tight">{o.opportunite || "—"}</p>
                      {o.notes && (
                        <p className="mt-0.5 max-w-[240px] truncate text-xs text-muted-foreground/70 leading-tight line-clamp-1">
                          {o.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {o.stage && (
                        <Badge className={cn("font-normal", valueBadgeClass(o.stage))}>
                          {o.stage}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{o.montant ?? "—"}</TableCell>
                    <TableCell className="text-right">{o.probabilite ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {o.arrPondere != null ? o.arrPondere.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {o.dateClose ? (
                        <span className={cn(
                          daysUntil(o.dateClose) < 0
                            ? "text-muted-foreground/40 line-through"
                            : daysUntil(o.dateClose) < 30
                              ? "font-medium text-orange-600"
                              : ""
                        )}>
                          {fmtDate(o.dateClose)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs">
                      {o.nextStep || "—"}
                      {o.dateNextStep && (
                        <span className="block text-muted-foreground">{o.dateNextStep}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {tachesEnabled && (
                          <TacheForm
                            compteId={compteId}
                            compteNom={compteNom}
                            target={{ scope: "opportunite", cibleId: o.id, cibleNom: o.opportunite }}
                            onCreated={(t) => setLocalTaches((prev) => [t, ...prev])}
                            trigger={
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Ajouter une tâche">
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        )}
                        <ExtLink url={o.url} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>

      {/* Signaux */}
      <TabsContent value="signaux">
        <div className="rounded-md border">
          {signaux.length === 0 ? (
            <Empty label="Aucun signal." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signal</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {signaux.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-[260px] font-medium">
                      {s.sourceUrl ? (
                        <Link href={s.sourceUrl} target="_blank" className="hover:underline">
                          {s.titre || "—"}
                        </Link>
                      ) : (
                        s.titre || "—"
                      )}
                      {s.auteur && (
                        <span className="block text-xs text-muted-foreground">{s.auteur}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{s.typeSignal ?? "—"}</TableCell>
                    <TableCell>
                      {s.scoreOpportunite && (
                        <Badge className={cn("font-normal", valueBadgeClass(s.scoreOpportunite))}>
                          {s.scoreOpportunite}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.statut && (
                        <Badge className={cn("font-normal", valueBadgeClass(s.statut))}>
                          {s.statut}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{s.dateSignal ?? "—"}</TableCell>
                    <TableCell><ExtLink url={s.url} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>
      {/* AOs liés */}
      <TabsContent value="aos">
        <div className="rounded-md border">
          {aos.length === 0 ? (
            <Empty label="Aucun appel d'offres lié à ce compte." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Appel d'offres</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Score IA</TableHead>
                  <TableHead className="text-right">Budget (k€)</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aos.map((ao) => (
                  <TableRow key={ao.id}>
                    <TableCell className="min-w-[200px]">
                      <p className="font-medium leading-tight">{ao.titre || "—"}</p>
                      {ao.synthese && (
                        <p className="mt-0.5 max-w-[280px] truncate text-xs text-muted-foreground/70 leading-tight">
                          {ao.synthese}
                        </p>
                      )}
                      {ao.client && ao.client !== ao.titre && (
                        <p className="mt-0.5 text-xs text-muted-foreground/50">{ao.client}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs font-medium border", AO_STATUT_COLORS[ao.statut] ?? "")}>
                        {AO_STATUT_LABELS[ao.statut as keyof typeof AO_STATUT_LABELS] ?? ao.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>{scoreBadge(ao.score_fit)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {ao.budget_k_eur != null ? ao.budget_k_eur.toLocaleString("fr") : "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {ao.deadline ? (
                        <span className={cn(
                          daysUntil(ao.deadline) < 30 && daysUntil(ao.deadline) >= 0
                            ? "font-medium text-orange-600"
                            : daysUntil(ao.deadline) < 0
                              ? "text-muted-foreground/40 line-through"
                              : ""
                        )}>
                          {fmtDate(ao.deadline)}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <Link href="/ao" className="text-xs text-primary hover:underline">
            Voir le pipeline AO complet →
          </Link>
        </div>
      </TabsContent>

      {/* Tâches (TODO & appels manuels) */}
      <TabsContent value="taches">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            TODO &amp; appels à réaliser pour ce compte.
          </p>
          {tachesEnabled && (
            <TacheForm
              compteId={compteId}
              compteNom={compteNom}
              target={{ scope: "compte", cibleId: null, cibleNom: "" }}
              onCreated={(t) => setLocalTaches((prev) => [t, ...prev])}
            />
          )}
        </div>
        <TachesList
          taches={localTaches}
          onSetStatus={tacheActions.setStatus}
          onDelete={tacheActions.remove}
          emptyLabel="Aucune tâche. Ajoutez-en une, ou via les onglets Contacts / Opportunités."
        />
        <div className="mt-2 flex justify-end">
          <Link href="/semaine" className="text-xs text-primary hover:underline">
            Voir ma semaine →
          </Link>
        </div>
      </TabsContent>

      {/* Actions recommandées */}
      <TabsContent value="actions">
        <div className="space-y-1.5">
          {localActions.length === 0 ? (
            <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
              Aucune action recommandée pour ce compte.
            </div>
          ) : (
            <>
              {pendingActions.length > 0 && (
                <div className="space-y-1.5">
                  {pendingActions.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 rounded-xl border bg-amber-50/40 px-4 py-3">
                      <Badge variant="outline" className={cn("mt-0.5 shrink-0 text-[11px] border", HORIZON_COLORS[a.horizon] ?? "")}>
                        {a.horizon}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{a.action_text}</p>
                        {(a.target_contacts || a.linked_offer) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {a.target_contacts && <span>{a.target_contacts}</span>}
                            {a.target_contacts && a.linked_offer && " · "}
                            {a.linked_offer && <span className="italic">{a.linked_offer}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => void markAction(a.id, "skipped")}
                        >
                          <Clock className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => void markAction(a.id, "done")}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {doneActions.length > 0 && (
                <div className="space-y-1">
                  {doneActions.map((a) => (
                    <div key={a.id} className={cn(
                      "flex items-start gap-3 rounded-xl border px-4 py-2.5 opacity-50",
                      a.status === "done" ? "bg-emerald-50/30" : "bg-muted/20"
                    )}>
                      <CheckCircle2 className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", a.status === "done" ? "text-emerald-600" : "text-muted-foreground")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground line-through">{a.action_text}</p>
                        {a.done_at && (
                          <p className="text-[11px] text-muted-foreground/50">
                            {a.done_type ?? "fait"} · {fmtDate(a.done_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <Link href="/revue-actions" className="text-xs text-primary hover:underline">
            Ouvrir la revue complète →
          </Link>
        </div>
      </TabsContent>
    </Tabs>
  );
}
