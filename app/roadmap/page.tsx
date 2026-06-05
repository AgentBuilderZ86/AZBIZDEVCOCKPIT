import { CheckCircle2, Zap, Sparkles, Database, Brain, FileText, RefreshCw, Users, MessageSquare, Bell, GitBranch, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const WAVES = [
  {
    id: 1,
    label: "Vague 1",
    title: "Fondations",
    state: "Livré",
    stateIcon: CheckCircle2,
    color: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", icon: "text-emerald-600", header: "from-emerald-600 to-emerald-500" },
    description: "Socle opérationnel du cockpit — données Notion, scoring, enrichissement IA, rapports.",
    items: [
      { icon: Database, text: "Sync Notion temps réel", detail: "Source de vérité unique, lecture/écriture" },
      { icon: Brain, text: "Score AdilStar heuristique", detail: "Formule déterministe 0–100, 5 composants" },
      { icon: Zap, text: "Enrichissement Apollo + Hunter", detail: "Firmographie, contacts, emails vérifiés" },
      { icon: Brain, text: "Enrichissement Claude Opus", detail: "Score IA, plan stratégique, signaux suggérés" },
      { icon: Zap, text: "Next Best Action (NBA)", detail: "Règles heuristiques + NBA propulsé Claude Sonnet" },
      { icon: FileText, text: "Rapports PDF", detail: "Rapport portefeuille + Focus compte 1 page" },
      { icon: Users, text: "Vue table & kanban", detail: "Édition inline, filtres, board par secteur" },
      { icon: GitBranch, text: "Plan stratégique IA", detail: "250-500 mots contextualisés Sia Partners Maroc" },
    ],
  },
  {
    id: 2,
    label: "Vague 2",
    title: "Intelligence",
    state: "En cours",
    stateIcon: Zap,
    color: { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-800", dot: "bg-orange-500", icon: "text-orange-600", header: "from-orange-500 to-amber-500" },
    description: "Couche d'intelligence continue — apprentissage, mémoire long terme, veille automatique.",
    items: [
      { icon: Brain, text: "Copilot RAG (pgvector)", detail: "Q&A contextualisé sur la base de connaissance" },
      { icon: Bell, text: "Veille commerciale auto", detail: "Monitoring signaux par compte (news, LinkedIn)" },
      { icon: FileText, text: "Journal append-only", detail: "Timeline d'activité par compte, traçabilité" },
      { icon: RefreshCw, text: "Learned scoring", detail: "Poids appris depuis les outcomes Won/Lost" },
      { icon: Brain, text: "NBA IA Claude Sonnet", detail: "Action recommandée contextualisée via LLM" },
      { icon: Database, text: "Base de connaissance RAG", detail: "Ingestion PDF/TXT/MD, indexation sémantique" },
      { icon: RefreshCw, text: "Cron scoring quotidien", detail: "Recalcul automatique 6h, mise à jour Notion" },
      { icon: GitBranch, text: "Jobs asynchrones", detail: "File de traitement, statut, retry automatique" },
    ],
  },
  {
    id: 3,
    label: "Vague 3",
    title: "Vision",
    state: "Vision",
    stateIcon: Sparkles,
    color: { bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-100 text-violet-800", dot: "bg-violet-500", icon: "text-violet-600", header: "from-violet-600 to-purple-500" },
    description: "Scale & automation — multi-utilisateurs, intégrations CRM, scoring prédictif ML.",
    items: [
      { icon: Brain, text: "Scoring prédictif ML", detail: "Modèle entraîné sur l'historique des deals" },
      { icon: Users, text: "Multi-utilisateur & rôles", detail: "Accès équipe, permissions par compte/secteur" },
      { icon: Bell, text: "Alertes Slack / Teams", detail: "Push notifications sur signaux critiques" },
      { icon: MessageSquare, text: "Séquences email Apollo", detail: "Outreach automatisé depuis le cockpit" },
      { icon: Globe, text: "Intégration CRM natif", detail: "Sync bi-directionnelle Salesforce / HubSpot" },
      { icon: RefreshCw, text: "API publique BizDev OS", detail: "Endpoints REST pour intégrations externes" },
      { icon: Database, text: "Dashboard temps réel", detail: "WebSockets, mise à jour live sans refresh" },
      { icon: Sparkles, text: "Copilot vocal & mobile", detail: "Interface mobile native + interaction voix" },
    ],
  },
];

const PROGRESS = [
  { label: "Vague 1 · Fondations", pct: 100, color: "bg-emerald-500" },
  { label: "Vague 2 · Intelligence", pct: 70, color: "bg-orange-500" },
  { label: "Vague 3 · Vision", pct: 10, color: "bg-violet-500" },
];

export default function RoadmapPage() {
  return (
    <main className="container mx-auto max-w-7xl py-6 px-4">
      {/* Header */}
      <header className="mb-8">
        <div
          className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "linear-gradient(135deg, hsl(231 72% 38% / 0.08) 0%, hsl(231 60% 55% / 0.05) 100%)",
            border: "1px solid hsl(231 72% 38% / 0.18)",
            color: "hsl(231 72% 36%)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Adil BizDev OS · Feuille de route
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Roadmap d'évolution</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          3 vagues successives pour construire un OS BizDev complet — de la fondation opérationnelle à l'intelligence continue et à l'automatisation à l'échelle.
        </p>

        {/* Progress bars */}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3 max-w-2xl">
          {PROGRESS.map((p) => (
            <div key={p.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{p.label}</span>
                <span className="text-muted-foreground">{p.pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${p.color} transition-all`} style={{ width: `${p.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* 3 colonnes */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {WAVES.map((wave) => {
          const StateIcon = wave.stateIcon;
          return (
            <div key={wave.id} className={`rounded-2xl border ${wave.color.border} ${wave.color.bg} overflow-hidden flex flex-col`}>
              {/* Card header */}
              <div className={`bg-gradient-to-r ${wave.color.header} p-5`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-white/70 uppercase tracking-widest">{wave.label}</p>
                    <h2 className="mt-0.5 text-xl font-bold text-white">{wave.title}</h2>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${wave.color.badge}`}>
                    <StateIcon className="h-3 w-3" />
                    {wave.state}
                  </span>
                </div>
                <p className="mt-2.5 text-xs text-white/80 leading-relaxed">{wave.description}</p>
              </div>

              {/* Items */}
              <ul className="flex-1 divide-y divide-white/60 px-1 py-1">
                {wave.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.text} className="flex items-start gap-3 px-3 py-2.5">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${wave.color.badge}`}>
                        <Icon className={`h-3 w-3 ${wave.color.icon}`} />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.text}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Roadmap évolutive — les priorités de la Vague 3 s'affinent selon les retours terrain et les opportunités d'intégration.
      </p>
    </main>
  );
}
