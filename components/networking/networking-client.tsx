"use client";

import * as React from "react";
import {
  CalendarDays,
  Building2,
  MapPin,
  ExternalLink,
  Linkedin,
  Star,
  RefreshCw,
  Bookmark,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseApiJson } from "@/lib/parse-api-json";
import { SECTEURS } from "@/lib/types";

interface NetworkingEvent {
  id: string;
  name: string;
  eventType: string;
  organizer: string;
  location: string;
  city: string;
  eventDate: string | null;
  endDate: string | null;
  description: string;
  websiteUrl: string | null;
  sourceUrl: string | null;
  sector: string;
  audience: string;
  relevanceScore: number | null;
  relevanceNotes: string;
  status: string;
}

interface NetworkingAssociation {
  id: string;
  name: string;
  assocType: string;
  sector: string;
  city: string;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  description: string;
  membershipInfo: string;
  whyRelevant: string;
  keyContact: Record<string, unknown>;
  status: string;
}

interface Props {
  intelligenceEnabled: boolean;
  initialEvents: NetworkingEvent[];
  initialAssociations: NetworkingAssociation[];
}

const ALL = "__all__";

export function NetworkingClient({ intelligenceEnabled, initialEvents, initialAssociations }: Props) {
  const [events, setEvents] = React.useState(initialEvents);
  const [associations, setAssociations] = React.useState(initialAssociations);
  const [sector, setSector] = React.useState<string>(ALL);
  const [researching, setResearching] = React.useState<"events" | "associations" | null>(null);

  const sectorFilter = sector === ALL ? null : sector;

  const visibleEvents = sectorFilter
    ? events.filter((e) => e.sector === sectorFilter)
    : events;
  const visibleAssociations = sectorFilter
    ? associations.filter((a) => a.sector === sectorFilter)
    : associations;

  async function refresh() {
    try {
      const res = await fetch("/api/networking");
      const data = await parseApiJson(res);
      if (res.ok) {
        setEvents((data.events as NetworkingEvent[]) ?? []);
        setAssociations((data.associations as NetworkingAssociation[]) ?? []);
      }
    } catch {
      /* silencieux */
    }
  }

  /** Poll le job. Retourne true si "done", false si encore en cours après la fenêtre
   *  (la recherche web continue alors en arrière-plan). Lève uniquement si "failed". */
  async function pollJob(jobId: string): Promise<boolean> {
    const MAX = 40; // 40 × 3s ≈ 120s (la recherche web peut prendre 30-90s)
    for (let i = 0; i < MAX; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/intelligence/jobs/${jobId}`);
        const data = await parseApiJson(res);
        if (!res.ok) continue;
        const job = data.job as { status: string; error?: string } | undefined;
        if (!job) continue;
        if (job.status === "failed") throw new Error(String(job.error ?? "Recherche échouée."));
        if (job.status === "done") return true;
      } catch (err) {
        if (err instanceof Error && err.message.includes("échouée")) throw err;
      }
    }
    return false; // pas encore terminé — le job poursuit côté serveur
  }

  async function research(kind: "events" | "associations") {
    setResearching(kind);
    try {
      const res = await fetch("/api/networking/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, sector: sectorFilter }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(String(data.error ?? "Échec du lancement."));
      if (data.queued && data.jobId) {
        const done = await pollJob(String(data.jobId));
        await refresh();
        if (done) {
          toast.success(kind === "events" ? "Événements actualisés." : "Associations actualisées.");
        } else {
          toast.info("Recherche en cours en arrière-plan — actualisez dans une minute.");
        }
      } else {
        throw new Error(String(data.error ?? "Réponse inattendue."));
      }
    } catch (err) {
      await refresh();
      toast.error(err instanceof Error ? err.message : "Erreur recherche.");
    } finally {
      setResearching(null);
    }
  }

  async function setStatus(kind: "events" | "associations", id: string, status: "saved" | "dismissed") {
    // optimiste
    if (kind === "events") {
      setEvents((prev) =>
        status === "dismissed" ? prev.filter((e) => e.id !== id) : prev.map((e) => (e.id === id ? { ...e, status } : e))
      );
    } else {
      setAssociations((prev) =>
        status === "dismissed" ? prev.filter((a) => a.id !== id) : prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    }
    try {
      const res = await fetch(`/api/networking/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Échec");
    } catch {
      toast.error("Mise à jour impossible.");
      void refresh();
    }
  }

  if (!intelligenceEnabled) {
    return (
      <div className="rounded-xl border border-amber-300/60 bg-amber-50/80 p-5 text-sm text-amber-900 backdrop-blur-sm">
        <p className="font-semibold">Couche Intelligence inactive</p>
        <p className="mt-1.5">
          Configurez <code className="rounded bg-amber-100 px-1">DATABASE_URL</code> (Postgres) puis lancez{" "}
          <code className="rounded bg-amber-100 px-1">npm run db:migrate</code> pour activer la zone Networking.
        </p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="events" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="events" className="gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> Événements · {visibleEvents.length}
          </TabsTrigger>
          <TabsTrigger value="associations" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Associations · {visibleAssociations.length}
          </TabsTrigger>
        </TabsList>

        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous secteurs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous secteurs</SelectItem>
            {SECTEURS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Événements */}
      <TabsContent value="events" className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => research("events")} disabled={researching !== null}>
            <RefreshCw className={researching === "events" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            {researching === "events" ? "Recherche…" : "Rechercher des événements"}
          </Button>
        </div>

        {visibleEvents.length === 0 ? (
          <EmptyState label="Aucun événement. Lancez une recherche web pour pister les événements majeurs au Maroc." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleEvents.map((e) => (
              <article key={e.id} className="rounded-xl border bg-white/70 p-4 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{e.name}</h3>
                  {e.relevanceScore != null && (
                    <Badge variant="outline" className="shrink-0 gap-1 font-normal">
                      <Star className="h-3 w-3 text-amber-500" /> {e.relevanceScore}
                    </Badge>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {e.eventType && <Badge variant="secondary" className="font-normal">{e.eventType}</Badge>}
                  {e.sector && <Badge variant="outline" className="font-normal">{e.sector}</Badge>}
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {(e.eventDate || e.city) && (
                    <p className="flex items-center gap-3">
                      {e.eventDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(e.eventDate)}
                          {e.endDate && e.endDate !== e.eventDate ? ` → ${formatDate(e.endDate)}` : ""}
                        </span>
                      )}
                      {e.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {e.city}
                        </span>
                      )}
                    </p>
                  )}
                  {e.organizer && <p>Organisé par {e.organizer}</p>}
                </div>
                {e.relevanceNotes && <p className="mt-2 text-xs text-foreground/80">{e.relevanceNotes}</p>}
                {e.description && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{e.description}</p>}

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-3 text-xs">
                    {e.websiteUrl && (
                      <a href={e.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> Site
                      </a>
                    )}
                    {e.sourceUrl && e.sourceUrl !== e.websiteUrl && (
                      <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline">
                        Source
                      </a>
                    )}
                  </div>
                  <RowActions
                    saved={e.status === "saved"}
                    onSave={() => setStatus("events", e.id, "saved")}
                    onDismiss={() => setStatus("events", e.id, "dismissed")}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Associations */}
      <TabsContent value="associations" className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => research("associations")} disabled={researching !== null}>
            <RefreshCw className={researching === "associations" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            {researching === "associations" ? "Recherche…" : "Rechercher des associations"}
          </Button>
        </div>

        {visibleAssociations.length === 0 ? (
          <EmptyState label="Aucune association. Lancez une recherche web pour lister les associations professionnelles du Maroc." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleAssociations.map((a) => {
              const contact = a.keyContact ?? {};
              const contactNom = typeof contact.nom === "string" ? contact.nom : "";
              const contactEmail = typeof contact.email === "string" ? contact.email : "";
              return (
                <article key={a.id} className="rounded-xl border bg-white/70 p-4 backdrop-blur-sm">
                  <h3 className="font-semibold leading-tight">{a.name}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {a.assocType && <Badge variant="secondary" className="font-normal">{a.assocType}</Badge>}
                    {a.sector && <Badge variant="outline" className="font-normal">{a.sector}</Badge>}
                    {a.city && (
                      <Badge variant="outline" className="gap-1 font-normal">
                        <MapPin className="h-3 w-3" /> {a.city}
                      </Badge>
                    )}
                  </div>
                  {a.whyRelevant && <p className="mt-2 text-xs text-foreground/80">{a.whyRelevant}</p>}
                  {a.description && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{a.description}</p>}
                  {a.membershipInfo && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">Adhésion :</span> {a.membershipInfo}
                    </p>
                  )}
                  {(contactNom || contactEmail) && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">Contact :</span> {contactNom}
                      {contactEmail && (
                        <>
                          {contactNom ? " · " : ""}
                          <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                            {contactEmail}
                          </a>
                        </>
                      )}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-3 text-xs">
                      {a.websiteUrl && (
                        <a href={a.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> Site
                        </a>
                      )}
                      {a.linkedinUrl && (
                        <a href={a.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Linkedin className="h-3 w-3" /> LinkedIn
                        </a>
                      )}
                    </div>
                    <RowActions
                      saved={a.status === "saved"}
                      onSave={() => setStatus("associations", a.id, "saved")}
                      onDismiss={() => setStatus("associations", a.id, "dismissed")}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function RowActions({
  saved,
  onSave,
  onDismiss,
}: {
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        className={saved ? "h-7 gap-1 px-2 text-primary" : "h-7 gap-1 px-2"}
        onClick={onSave}
        title={saved ? "Enregistré" : "Enregistrer"}
      >
        <Bookmark className={saved ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={onDismiss} title="Ignorer">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
