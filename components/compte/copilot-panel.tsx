"use client";

import * as React from "react";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseApiJson } from "@/lib/parse-api-json";
import type {
  CopilotCitation,
  CopilotMessage,
} from "@/lib/intelligence/copilot-types";
import { citationTypeLabel } from "@/lib/intelligence/copilot-types";

interface Props {
  compteId: string;
  compteName: string;
  enabled: boolean;
  disabledReason?: string;
}

function CitationBadge({ citation: c }: { citation: CopilotCitation }) {
  const label = `${citationTypeLabel(c.type)} · ${c.label}`;
  const extra =
    c.similarity != null ? ` · ${Math.round(c.similarity * 100)} %` : "";
  if (c.url) {
    return (
      <a href={c.url} target="_blank" rel="noreferrer">
        <Badge variant="outline" className="text-xs font-normal hover:bg-muted">
          {label}
          {extra}
        </Badge>
      </a>
    );
  }
  return (
    <Badge variant="outline" className="text-xs font-normal" title={c.excerpt}>
      {label}
      {extra}
    </Badge>
  );
}

export function CopilotPanel({
  compteId,
  compteName,
  enabled,
  disabledReason,
}: Props) {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<CopilotMessage[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setMessages((m) => [...m, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch(`/api/compte/${compteId}/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error ?? "Échec du copilote.");

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations as CopilotCitation[],
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur copilote.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageCircle className="h-4 w-4" />
          Copilote · {compteName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!enabled && (
          <p className="text-xs text-muted-foreground">
            {disabledReason ??
              "Requiert DATABASE_URL, EMBEDDINGS_API_KEY et documents indexés dans /connaissance."}
          </p>
        )}

        {messages.length > 0 && (
          <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === "user"
                    ? "ml-4 rounded-md bg-primary/10 p-2 text-sm"
                    : "mr-2 rounded-md border bg-card p-2 text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.citations.map((c, j) => (
                      <CitationBadge key={j} citation={c} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex. Quelles références Sia sur un compte Banque similaire ont converti ?"
            rows={3}
            disabled={!enabled || loading}
            className="text-sm"
          />
          <Button type="submit" size="sm" disabled={!enabled || loading || !question.trim()}>
            <Send className="h-3.5 w-3.5" />
            {loading ? "Réflexion…" : "Demander au copilote"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
