import {
  Star, TrendingUp, Users, Zap, Search, Brain, ChevronRight,
  Building2, Target, AlertTriangle, CheckCircle2, Clock,
  BarChart3, ArrowRight, Flame, Database, Globe
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* ─── AdilStar score components ─────────────────────────── */
const SCORE_COMPONENTS = [
  {
    name: "Stage de maturité",
    max: 92,
    color: "bg-blue-500",
    light: "bg-blue-50 text-blue-700 border-blue-200",
    rows: [
      { label: "Won", value: 92 }, { label: "Active", value: 72 },
      { label: "Hot", value: 58 }, { label: "Warm", value: 32 },
      { label: "Cold", value: 12 }, { label: "Lost", value: 5 },
    ],
  },
  {
    name: "Priorité stratégique",
    max: 20,
    color: "bg-violet-500",
    light: "bg-violet-50 text-violet-700 border-violet-200",
    rows: [
      { label: "🔴 Haute", value: "+20" }, { label: "🟡 Moyenne", value: "+10" }, { label: "🟢 Basse", value: "+2" },
    ],
  },
  {
    name: "Taille (Effectif)",
    max: 15,
    color: "bg-emerald-500",
    light: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rows: [
      { label: "≥ 5 000 pers.", value: "+15" }, { label: "≥ 1 000 pers.", value: "+10" },
      { label: "≥ 200 pers.", value: "+5" }, { label: "< 200 pers.", value: "+2" },
    ],
  },
  {
    name: "ARR pondéré",
    max: 15,
    color: "bg-amber-500",
    light: "bg-amber-50 text-amber-700 border-amber-200",
    rows: [
      { label: "≥ 750 k€", value: "+15" }, { label: "≥ 500 k€", value: "+10" },
      { label: "≥ 250 k€", value: "+5" }, { label: "≥ 50 k€", value: "+1" },
    ],
  },
  {
    name: "Signaux actifs",
    max: 15,
    color: "bg-rose-500",
    light: "bg-rose-50 text-rose-700 border-rose-200",
    rows: [
      { label: "Signal score 5 ouvert", value: "+15" }, { label: "Signal score 4 ouvert", value: "+12" },
      { label: "Signal score 3 ouvert", value: "+9" }, { label: "Aucun signal ouvert", value: "+0" },
    ],
  },
];

/* ─── Pipeline stages ────────────────────────────────────── */
const STAGES = [
  { stage: "Cold", score: 12, color: "bg-slate-400", criteria: "Contact initial identifié, aucun échange qualifié", next: "Premier contact qualifié" },
  { stage: "Warm", score: 32, color: "bg-orange-400", criteria: "Échanges en cours, intérêt détecté, pas d'opp formelle", next: "Opportunité identifiée" },
  { stage: "Hot", score: 58, color: "bg-red-500", criteria: "Opportunité qualifiée, décideur engagé, budget possible", next: "Proposition en cours" },
  { stage: "Active", score: 72, color: "bg-blue-500", criteria: "Client actif, mission(s) en cours ou renouvellement", next: "Upsell / renouvellement" },
  { stage: "Won", score: 92, color: "bg-emerald-500", criteria: "Mission signée, revenu confirmé", next: "Fidélisation" },
];

/* ─── Signal scoring ─────────────────────────────────────── */
const SIGNALS = [
  { score: "5", label: "Critique", badge: "bg-red-100 text-red-800 border-red-200", examples: ["RFP/Appel d'offres publié", "Départ d'un décideur clé concurrent", "Crise organisationnelle"] },
  { score: "4", label: "Élevé", badge: "bg-orange-100 text-orange-800 border-orange-200", examples: ["Post LinkedIn du DG sur un sujet Sia", "Recrutement massif / transformation", "Levée de fonds / acquisition"] },
  { score: "3", label: "Moyen", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", examples: ["News secteur pertinent", "Nouveau projet annoncé en presse", "Changement de direction"] },
  { score: "2", label: "Faible", badge: "bg-blue-100 text-blue-800 border-blue-200", examples: ["Conférence / événement sectoriel", "Publication générique de l'entreprise"] },
  { score: "1", label: "À surveiller", badge: "bg-slate-100 text-slate-700 border-slate-200", examples: ["Activité normale à monitorer", "Mention dans un rapport tiers"] },
];

/* ─── Sourcing pipeline ──────────────────────────────────── */
const SOURCES = [
  {
    name: "Apollo.io",
    color: "bg-indigo-600",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    provides: ["Firmographie complète", "Contacts + titres poste", "Numéros de téléphone", "Technographies"],
    limits: ["Emails non vérifiés", "Données parfois datées"],
    icon: Database,
  },
  {
    name: "Hunter.io",
    color: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    provides: ["Emails professionnels vérifiés", "Patterns de format email", "Score de confiance 0-100"],
    limits: ["Contacts seulement (pas de firmo)", "Couverture variable par pays"],
    icon: Search,
  },
  {
    name: "Explorium",
    color: "bg-teal-600",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    provides: ["Signaux commerciaux enrichis", "Données financières", "Intent data", "Technologies utilisées"],
    limits: ["Couverture Maroc limitée", "API premium"],
    icon: Globe,
  },
  {
    name: "Claude Opus",
    color: "bg-violet-600",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    provides: ["Score AdilStar IA (0-100)", "Plan stratégique 250-500 mots", "Signaux d'approche suggérés", "Justification du score"],
    limits: ["Requiert données firmographiques", "Coût par enrichissement"],
    icon: Brain,
  },
];

/* ─── Contact influence ──────────────────────────────────── */
const INFLUENCE = [
  { level: "Décideur ultime", badge: "bg-red-100 text-red-800 border-red-200", p: "P1", desc: "PDG, DG, DAF — valide le budget et signe", action: "Contact direct, relation de confiance" },
  { level: "Décideur", badge: "bg-orange-100 text-orange-800 border-orange-200", p: "P1", desc: "DSI, DRH, Directeur Pôle — sponsor de la mission", action: "Co-construction proposition de valeur" },
  { level: "Décideur technique", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", p: "P2", desc: "Chef de projet, Responsable SI — valide faisabilité", action: "Démonstration technique, PoC" },
  { level: "Influenceur clé", badge: "bg-blue-100 text-blue-800 border-blue-200", p: "P2", desc: "Conseiller interne, expert reconnu", action: "Partage d'insights, thought leadership" },
  { level: "Influenceur", badge: "bg-slate-100 text-slate-700 border-slate-200", p: "P3", desc: "Équipes opérationnelles, middle management", action: "Entretiens, recueil besoins terrain" },
  { level: "Prescripteur", badge: "bg-green-100 text-green-800 border-green-200", p: "P3", desc: "Partenaire externe, introducteur potentiel", action: "Activation réseau, co-vente" },
];

/* ─── NBA rules ─────────────────────────────────────────── */
const NBA_RULES = [
  { icon: Flame, trigger: "Signal ouvert avec score ≥ 4", action: "Exploiter le signal — contacter sous 48h", urgency: "Haute", color: "text-red-600 bg-red-50 border-red-200" },
  { icon: Target, trigger: "Opportunité en cours avec next step daté", action: "Faire avancer l'opportunité selon la date prévue", urgency: "Haute", color: "text-orange-600 bg-orange-50 border-orange-200" },
  { icon: Users, trigger: "Aucun décideur identifié (Contacts vides ou Prescripteur only)", action: "Cartographier les décideurs clés du compte", urgency: "Moyenne", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  { icon: Brain, trigger: "Plan stratégique vide ou non rédigé", action: "Rédiger le plan stratégique via l'enrichissement IA", urgency: "Moyenne", color: "text-blue-600 bg-blue-50 border-blue-200" },
  { icon: Clock, trigger: "Aucune des conditions précédentes", action: "Maintenir l'engagement — planifier une prise de contact", urgency: "Basse", color: "text-slate-600 bg-slate-50 border-slate-200" },
];

export default function MethoPage() {
  return (
    <main className="container mx-auto max-w-5xl py-6 px-4 space-y-12">

      {/* Header */}
      <header>
        <div
          className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "linear-gradient(135deg, hsl(231 72% 38% / 0.08) 0%, hsl(231 60% 55% / 0.05) 100%)",
            border: "1px solid hsl(231 72% 38% / 0.18)",
            color: "hsl(231 72% 36%)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Adil BizDev OS · Documentation méthode
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Méthode & Indicateurs</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Toute la logique du cockpit expliquée — scoring AdilStar, qualification, signaux, sourcing, contacts et actions recommandées.
        </p>
      </header>

      {/* ── A1 Score heuristique ───────────────────────── */}
      <section>
        <SectionTitle icon={Star} label="A1" title="Score AdilStar — Formule heuristique" />
        <p className="mb-4 text-sm text-muted-foreground">
          Calcul déterministe, 0–100, sans appel externe. Tourne automatiquement chaque jour à 6h via le cron.
        </p>

        {/* Formule visuelle */}
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-white/80 p-4 shadow-sm text-sm font-mono">
          <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800">STAGE_BASE</span>
          <span className="text-muted-foreground">+</span>
          <span className="rounded bg-violet-100 px-2 py-0.5 text-violet-800">PRIORITÉ</span>
          <span className="text-muted-foreground">+</span>
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">EFFECTIF</span>
          <span className="text-muted-foreground">+</span>
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">ARR</span>
          <span className="text-muted-foreground">+</span>
          <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800">SIGNAUX</span>
          <span className="text-muted-foreground">−</span>
          <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700">Dormante −20</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-bold">max(0, min(100, résultat))</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCORE_COMPONENTS.map((comp) => (
            <div key={comp.name} className={`rounded-xl border ${comp.light} p-3 transition-all duration-200 hover:shadow-md hover:scale-[1.01]`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">{comp.name}</p>
                <span className="text-xs font-bold">max +{comp.max} pts</span>
              </div>
              <div className="space-y-1">
                {comp.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-xs">
                    <span>{r.label}</span>
                    <span className="font-mono font-bold">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Exemple concret */}
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Exemple concret</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              { label: "Stage Hot", val: "58", color: "bg-red-100 text-red-800" },
              { label: "Priorité Haute", val: "+20", color: "bg-violet-100 text-violet-800" },
              { label: "1 000 emp.", val: "+10", color: "bg-emerald-100 text-emerald-800" },
              { label: "ARR 200 k€", val: "+4", color: "bg-amber-100 text-amber-800" },
              { label: "Signal score 4", val: "+12", color: "bg-rose-100 text-rose-800" },
            ].map((e) => (
              <span key={e.label} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${e.color}`}>
                {e.label} <strong>{e.val}</strong>
              </span>
            ))}
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">Score : 104 → 100</span>
          </div>
        </div>
      </section>

      {/* ── A2 Score IA Claude ─────────────────────────── */}
      <section>
        <SectionTitle icon={Brain} label="A2" title="Score AdilStar — Enrichissement Claude Opus" />
        <p className="mb-4 text-sm text-muted-foreground">
          Déclenché manuellement via le bouton "Enrichir" sur la fiche compte. Utilise <code className="rounded bg-muted px-1 py-0.5 text-xs">claude-opus-4-8</code> avec structured output (Zod).
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-violet-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">Inputs fournis au modèle</p>
            <ul className="space-y-1 text-sm text-violet-900">
              {["Nom, secteur, priorité, stage, statut relation", "Effectif, CA estimé, URL Notion", "Firmographie Apollo (industrie, domaine)", "Contacts (titres, niveaux d'influence)", "Signaux ouverts (type, score, statut)", "Plan stratégique existant (si disponible)"].map((i) => (
                <li key={i} className="flex items-start gap-1.5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />{i}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border bg-violet-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">Outputs structurés</p>
            <ul className="space-y-2 text-sm text-violet-900">
              <li className="flex items-start gap-1.5"><Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" /><div><strong>scoreAdilStar</strong> (0–100) · attractivité = taille × maturité relation × intensité signaux × fit Sia</div></li>
              <li className="flex items-start gap-1.5"><Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" /><div><strong>scoreRationale</strong> (2–3 phrases FR) · justification du score</div></li>
              <li className="flex items-start gap-1.5"><Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" /><div><strong>planStrategique</strong> (250–500 mots) · enjeux, parties prenantes, offres Sia, séquence d'approche</div></li>
              <li className="flex items-start gap-1.5"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" /><div><strong>suggestedSignaux</strong> (0–4 signaux) · type, score, angles d'approche concrets</div></li>
            </ul>
          </div>
        </div>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>Positionnement :</strong> Le modèle est instruit comme copilot BizDev d'Adil Zriouil chez Sia Partners Maroc — ses recommandations ciblent les offres transformation, data/IA, excellence opérationnelle, risk et ESG.
        </p>
      </section>

      {/* ── B Pipeline de qualification ────────────────── */}
      <section>
        <SectionTitle icon={TrendingUp} label="B" title="Tunnel de qualification — Pipeline" />
        <p className="mb-4 text-sm text-muted-foreground">Les 5 étapes actives du pipeline, avec le score base associé et les critères de passage.</p>

        <div className="relative">
          {/* Ligne horizontale de connexion */}
          <div className="absolute top-6 left-8 right-8 hidden h-0.5 bg-gradient-to-r from-slate-300 via-red-400 to-emerald-400 sm:block" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            {STAGES.map((s, i) => (
              <div key={s.stage} className="relative flex flex-col items-center text-center">
                <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full ${s.color} text-white shadow-md`}>
                  <span className="text-sm font-bold">{s.score}</span>
                </div>
                <p className="mt-2 font-semibold text-sm">{s.stage}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-tight">{s.criteria}</p>
                {i < STAGES.length - 1 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-primary sm:hidden">
                    <ChevronRight className="h-3 w-3" />
                    <span>{s.next}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── C Scoring signaux ──────────────────────────── */}
      <section>
        <SectionTitle icon={AlertTriangle} label="C" title="Scoring des signaux commerciaux" />
        <p className="mb-4 text-sm text-muted-foreground">Chaque signal est noté de 1 à 5 selon son potentiel à déboucher sur une opportunité.</p>

        <div className="overflow-hidden rounded-xl border bg-white/80 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Score</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Niveau</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exemples de signaux</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SIGNALS.map((s) => (
                <tr key={s.score} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${s.badge}`}>{s.score}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.badge}`}>{s.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.examples.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Le bonus signaux dans AdilStar est calculé comme : <code className="rounded bg-muted px-1">min(15, score_max_signal_ouvert × 3)</code>
        </p>
      </section>

      {/* ── D Sourcing pipeline ────────────────────────── */}
      <section>
        <SectionTitle icon={Search} label="D" title="Pipeline de sourcing & enrichissement" />
        <p className="mb-4 text-sm text-muted-foreground">4 sources complémentaires, déclenchées séquentiellement lors de l'enrichissement d'un compte.</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SOURCES.map((src, i) => {
            const Icon = src.icon;
            return (
              <div key={src.name} className={`relative rounded-xl border ${src.badge.split(" ")[0].replace("bg-", "border-").replace("50", "200")} bg-white/80 p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01]`}>
                {i < SOURCES.length - 1 && (
                  <div className="absolute -right-1.5 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${src.color}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </span>
                  <p className="font-semibold text-sm">{src.name}</p>
                </div>
                <div className="mb-2">
                  <p className="mb-1 text-xs font-medium text-emerald-700">Apporte</p>
                  <ul className="space-y-0.5">
                    {src.provides.map((p) => (
                      <li key={p} className="flex items-start gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Limites</p>
                  <ul className="space-y-0.5">
                    {src.limits.map((l) => (
                      <li key={l} className="flex items-start gap-1 text-xs text-muted-foreground">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />{l}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── E Contacts influence ───────────────────────── */}
      <section>
        <SectionTitle icon={Users} label="E" title="Niveaux d'influence & engagement contacts" />
        <p className="mb-4 text-sm text-muted-foreground">6 niveaux pour cartographier les parties prenantes et prioriser les efforts de relation.</p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {INFLUENCE.map((inf) => (
            <div key={inf.level} className="flex items-start gap-3 rounded-xl border bg-white/80 p-3 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01]">
              <div className="flex flex-col items-center gap-1">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${inf.badge}`}>{inf.level.split(" ")[0]}</span>
                <span className="text-xs font-bold text-muted-foreground">{inf.p}</span>
              </div>
              <div>
                <p className="text-sm font-semibold">{inf.level}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{inf.desc}</p>
                <p className="mt-1 text-xs text-primary font-medium">→ {inf.action}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── F NBA ──────────────────────────────────────── */}
      <section>
        <SectionTitle icon={Zap} label="F" title="Next Best Action — Logique de priorisation" />
        <p className="mb-4 text-sm text-muted-foreground">
          5 règles évaluées en cascade. La première qui déclenche détermine l'action recommandée. Une version IA (Claude Sonnet) contextualise le résultat.
        </p>

        <div className="space-y-2">
          {NBA_RULES.map((rule, i) => {
            const Icon = rule.icon;
            return (
              <div key={rule.trigger} className={`flex items-start gap-4 rounded-xl border p-3.5 transition-all duration-150 hover:scale-[1.005] hover:shadow-sm ${rule.color}`}>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-xs font-bold shadow-sm">{i + 1}</span>
                  <Icon className={`h-4 w-4 ${rule.color.split(" ")[0]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Si</p>
                    <p className="text-sm">{rule.trigger}</p>
                  </div>
                  <p className="text-sm font-medium">→ {rule.action}</p>
                </div>
                <Badge variant="outline" className={`shrink-0 text-xs font-medium ${rule.color}`}>{rule.urgency}</Badge>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <div className="border-t pt-4 text-center text-xs text-muted-foreground">
        Documentation interne Adil BizDev OS — mise à jour synchronisée avec les évolutions du code.
      </div>
    </main>
  );
}

function SectionTitle({ icon: Icon, label, title }: { icon: React.ElementType; label: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
        style={{ background: "linear-gradient(135deg, hsl(231 72% 42%) 0%, hsl(231 72% 30%) 100%)" }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
    </div>
  );
}
