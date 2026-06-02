"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import type { Contact, Opportunite, Signal } from "@/lib/types";

interface Props {
  contacts: Contact[];
  opportunites: Opportunite[];
  signaux: Signal[];
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

export function Compte360Tabs({ contacts, opportunites, signaux }: Props) {
  return (
    <Tabs defaultValue="contacts">
      <TabsList>
        <TabsTrigger value="contacts">Contacts · {contacts.length}</TabsTrigger>
        <TabsTrigger value="opps">Opportunités · {opportunites.length}</TabsTrigger>
        <TabsTrigger value="signaux">Signaux · {signaux.length}</TabsTrigger>
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
                    <TableCell className="font-medium">{c.nomComplet || "—"}</TableCell>
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
                    <TableCell><ExtLink url={c.url} /></TableCell>
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
                  <TableHead>Next step</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunites.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.opportunite || "—"}</TableCell>
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
                    <TableCell className="max-w-[220px] truncate text-xs">
                      {o.nextStep || "—"}
                      {o.dateNextStep && (
                        <span className="block text-muted-foreground">{o.dateNextStep}</span>
                      )}
                    </TableCell>
                    <TableCell><ExtLink url={o.url} /></TableCell>
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
    </Tabs>
  );
}
