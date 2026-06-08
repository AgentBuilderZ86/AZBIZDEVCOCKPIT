"use client";

import * as React from "react";
import { Sparkles, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { parseApiJson } from "@/lib/parse-api-json";
import { namesMatch, normalizeName } from "@/lib/enrichment-match";
import {
  NIVEAUX_INFLUENCE,
  PRIORITES_ENGAGEMENT,
  STATUTS_CONTACT,
} from "@/lib/types";
import type { Contact } from "@/lib/types";

const NONE = "__none";

interface RecoAction {
  id: string;
  compteId: string;
  compteNom: string;
  actionText: string;
  targetContacts: string;
}

interface Props {
  action: RecoAction;
  contacts?: Contact[];
  onResolved: (actionId: string) => void;
  trigger?: React.ReactNode;
}

/** État éditable d'une carte contact (string partout, "" = vide). */
interface CardState {
  contactId: string | null; // null = à créer
  nomComplet: string;
  titre: string;
  roleDecisionnel: string;
  direction: string;
  linkedin: string;
  email: string;
  telephone: string;
  niveauInfluence: string;
  prioriteEngagement: string;
  statutContact: string;
}

function fromContact(c: Contact): CardState {
  return {
    contactId: c.id,
    nomComplet: c.nomComplet,
    titre: c.titre ?? "",
    roleDecisionnel: c.roleDecisionnel ?? "",
    direction: c.direction ?? "",
    linkedin: c.linkedin ?? "",
    email: c.email ?? "",
    telephone: c.telephone ?? "",
    niveauInfluence: c.niveauInfluence ?? "",
    prioriteEngagement: c.prioriteEngagement ?? "",
    statutContact: c.statutContact ?? "",
  };
}

function emptyCard(nomComplet: string): CardState {
  return {
    contactId: null,
    nomComplet,
    titre: "",
    roleDecisionnel: "",
    direction: "",
    linkedin: "",
    email: "",
    telephone: "",
    niveauInfluence: "",
    prioriteEngagement: "",
    statutContact: "",
  };
}

/** Construit la liste des cartes à partir des contacts cités et de la fiche. */
function buildCards(action: RecoAction, contacts: Contact[]): CardState[] {
  const names = action.targetContacts
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const cards: CardState[] = [];
  const usedIds = new Set<string>();

  for (const name of names) {
    const match = contacts.find((c) => namesMatch(c.nomComplet, name));
    if (match && !usedIds.has(match.id)) {
      usedIds.add(match.id);
      cards.push(fromContact(match));
    } else if (!match) {
      cards.push(emptyCard(name));
    }
  }

  // Bonus : contacts de la fiche dont le nom apparaît dans le texte de l'action.
  const txt = normalizeName(action.actionText);
  for (const c of contacts) {
    if (usedIds.has(c.id)) continue;
    const n = normalizeName(c.nomComplet);
    if (n && n.length > 3 && txt.includes(n)) {
      usedIds.add(c.id);
      cards.push(fromContact(c));
    }
  }

  return cards;
}

export function RecoResolveDialog({ action, contacts, onResolved, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [cards, setCards] = React.useState<CardState[]>([]);
  const [doneType, setDoneType] = React.useState("autre");
  const [notes, setNotes] = React.useState("");

  // Charge / prépare les cartes à l'ouverture.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let list = contacts;
      if (!list) {
        setLoading(true);
        try {
          const res = await fetch(`/api/compte/${action.compteId}/contacts`);
          const data = await parseApiJson(res);
          list = (data.contacts as Contact[]) ?? [];
        } catch {
          list = [];
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      if (!cancelled) setCards(buildCards(action, list ?? []));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, action, contacts]);

  function patch(i: number, field: keyof CardState, value: string) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  async function resolve() {
    setSaving(true);
    try {
      const original = contacts
        ? new Map(contacts.map((c) => [c.id, fromContact(c)]))
        : new Map<string, CardState>();

      const ops: Promise<void>[] = [];

      for (const card of cards) {
        if (card.contactId) {
          // PATCH des champs modifiés uniquement
          const ref = original.get(card.contactId);
          const body: Record<string, string> = {};
          (
            [
              "titre",
              "roleDecisionnel",
              "direction",
              "linkedin",
              "email",
              "telephone",
              "niveauInfluence",
              "prioriteEngagement",
              "statutContact",
            ] as const
          ).forEach((f) => {
            if (!ref || card[f] !== ref[f]) body[f] = card[f];
          });
          if (Object.keys(body).length > 0) {
            ops.push(
              fetch(`/api/contacts/${card.contactId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }).then(async (res) => {
                if (!res.ok) {
                  const d = await parseApiJson(res);
                  throw new Error(typeof d.error === "string" ? d.error : "Échec MAJ contact.");
                }
              })
            );
          }
        } else {
          // Création
          ops.push(
            fetch(`/api/compte/${action.compteId}/contacts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nomComplet: card.nomComplet,
                titre: card.titre,
                roleDecisionnel: card.roleDecisionnel,
                direction: card.direction,
                linkedin: card.linkedin,
                email: card.email,
                telephone: card.telephone,
                niveauInfluence: card.niveauInfluence,
                prioriteEngagement: card.prioriteEngagement,
                statutContact: card.statutContact,
              }),
            }).then(async (res) => {
              if (!res.ok) {
                const d = await parseApiJson(res);
                throw new Error(typeof d.error === "string" ? d.error : "Échec création contact.");
              }
            })
          );
        }
      }

      await Promise.all(ops);

      // Clôture de la recommandation
      const doneContact = cards.map((c) => c.nomComplet).join(", ");
      const res = await fetch(`/api/revue-actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "done",
          doneType: cards.length > 0 ? "autre" : doneType,
          doneContact,
          doneNotes: notes,
        }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Échec clôture.");

      toast.success("Recommandation traitée.");
      setOpen(false);
      onResolved(action.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {trigger ?? (
          <Button size="sm" className="h-7 gap-1 bg-primary text-white hover:bg-primary/90">
            <Sparkles className="h-3 w-3" /> Traiter
          </Button>
        )}
      </span>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Traiter la recommandation</DialogTitle>
          <DialogDescription className="text-xs">{action.actionText}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement des contacts…
          </div>
        ) : (
          <div className="space-y-4">
            {cards.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Solution proposée : qualifier / enrichir {cards.length} contact(s) cité(s).
                </p>
                {cards.map((card, i) => (
                  <ContactCard key={card.contactId ?? `new-${i}`} card={card} onPatch={(f, v) => patch(i, f, v)} />
                ))}
              </>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Comment as-tu traité cette action ?</Label>
                <Select value={doneType} onValueChange={setDoneType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="appel">Appel</SelectItem>
                    <SelectItem value="reunion">Réunion</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Notes (optionnel)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Résumé, prochaine étape…" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={() => void resolve()} disabled={saving || loading}>
            {saving ? "Enregistrement…" : "Enregistrer & clôturer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactCard({
  card,
  onPatch,
}: {
  card: CardState;
  onPatch: (field: keyof CardState, value: string) => void;
}) {
  const isNew = card.contactId === null;
  return (
    <div className="rounded-xl border bg-white/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        {isNew ? (
          <UserPlus className="h-4 w-4 text-primary" />
        ) : (
          <UserCheck className="h-4 w-4 text-emerald-600" />
        )}
        <span className="text-sm font-semibold">{card.nomComplet || "Nouveau contact"}</span>
        <Badge variant="outline" className="text-[10px]">
          {isNew ? "À créer" : "Fiche existante"}
        </Badge>
      </div>

      {isNew && (
        <div className="mb-2 space-y-1">
          <Label className="text-[11px]">Nom complet</Label>
          <Input value={card.nomComplet} onChange={(e) => onPatch("nomComplet", e.target.value)} className="h-8" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Titre" value={card.titre} onChange={(v) => onPatch("titre", v)} />
        <Field label="Rôle décisionnel" value={card.roleDecisionnel} onChange={(v) => onPatch("roleDecisionnel", v)} />
        <Field label="Direction" value={card.direction} onChange={(v) => onPatch("direction", v)} />
        <Field label="LinkedIn" value={card.linkedin} onChange={(v) => onPatch("linkedin", v)} />
        <Field label="Email" value={card.email} onChange={(v) => onPatch("email", v)} />
        <Field label="Téléphone" value={card.telephone} onChange={(v) => onPatch("telephone", v)} />
        <SelectField
          label="Niveau d'influence"
          value={card.niveauInfluence}
          options={NIVEAUX_INFLUENCE}
          onChange={(v) => onPatch("niveauInfluence", v)}
        />
        <SelectField
          label="Priorité engagement"
          value={card.prioriteEngagement}
          options={PRIORITES_ENGAGEMENT}
          onChange={(v) => onPatch("prioriteEngagement", v)}
        />
        <SelectField
          label="Statut"
          value={card.statutContact}
          options={STATUTS_CONTACT}
          onChange={(v) => onPatch("statutContact", v)}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8" />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Select
        value={value === "" ? NONE : value}
        onValueChange={(v) => onChange(v === NONE ? "" : v)}
      >
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
