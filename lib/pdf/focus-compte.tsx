import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./theme";
import type { Compte360 } from "../types";
import type { NextBestAction } from "../next-best-action";

interface Props {
  data: Compte360;
  nba: NextBestAction;
  generatedAt: string;
}

/** One-pager « Focus compte » (vue 360 + next best action), charte Sia/AZ. */
export function FocusComptePdf({ data, nba, generatedAt }: Props) {
  const { compte, contacts, opportunites, signaux } = data;
  const pipeline = opportunites
    .filter((o) => o.stage && o.stage !== "Lost")
    .reduce((s, o) => s + (o.arrPondere ?? 0), 0);

  const badges = [compte.secteur, compte.priorite, compte.stage, compte.statutRelation].filter(
    Boolean
  ) as string[];

  return (
    <Document title={`Focus compte — ${compte.compte}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.brand}>SIA PARTNERS · ADIL BIZDEV OS</Text>
            <Text style={styles.docTitle}>Focus compte</Text>
          </View>
          <Text style={styles.docMeta}>
            Généré le {generatedAt}
            {compte.accountId != null ? `\nAccount #${compte.accountId}` : ""}
          </Text>
        </View>

        <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0B2A4A" }}>
          {compte.compte || "—"}
        </Text>
        <View style={styles.badgeRow}>
          {badges.map((b, i) => (
            <Text key={i} style={styles.badge}>
              {b}
            </Text>
          ))}
        </View>

        <View style={styles.kpiRow}>
          <Kpi label="Score AdilStar" value={compte.scoreAdilStar != null ? `${compte.scoreAdilStar}` : "—"} />
          <Kpi label="ARR pondéré (k€)" value={compte.arrPondere != null ? `${compte.arrPondere}` : "—"} />
          <Kpi label="Pipeline opps (k€)" value={pipeline ? pipeline.toFixed(1) : "—"} />
          <Kpi label="Effectif" value={compte.effectif != null ? `${compte.effectif}` : "—"} />
          <Kpi label="CA estimé" value={compte.caEstime || "—"} />
          <Kpi label="Contacts" value={`${contacts.length}`} />
        </View>

        <Text style={styles.h2}>Next Best Action</Text>
        <View style={styles.nbaBox}>
          <Text style={styles.nbaTitle}>{nba.title}</Text>
          <Text style={[styles.body, { marginTop: 2 }]}>{nba.detail}</Text>
        </View>

        <Text style={styles.h2}>Plan stratégique</Text>
        <Text style={styles.body}>
          {compte.planStrategique?.trim() || "Plan stratégique non encore rédigé."}
        </Text>

        <Text style={styles.h2}>Contacts clés</Text>
        {contacts.length === 0 ? (
          <Text style={[styles.body, styles.muted]}>Aucun contact rattaché.</Text>
        ) : (
          <>
            <View style={styles.rowHead}>
              <Text style={[styles.cellHead, { width: "34%" }]}>Nom</Text>
              <Text style={[styles.cellHead, { width: "40%" }]}>Titre</Text>
              <Text style={[styles.cellHead, { width: "26%" }]}>Influence</Text>
            </View>
            {contacts.slice(0, 8).map((c) => (
              <View key={c.id} style={styles.row}>
                <Text style={[styles.cell, { width: "34%" }]}>{c.nomComplet || "—"}</Text>
                <Text style={[styles.cell, { width: "40%" }]}>{c.titre || "—"}</Text>
                <Text style={[styles.cell, { width: "26%" }]}>{c.niveauInfluence ?? "—"}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.h2}>Signaux récents</Text>
        {signaux.length === 0 ? (
          <Text style={[styles.body, styles.muted]}>Aucun signal.</Text>
        ) : (
          signaux.slice(0, 6).map((s) => (
            <View key={s.id} style={styles.row}>
              <Text style={[styles.cell, { width: "62%" }]}>{s.titre || "—"}</Text>
              <Text style={[styles.cell, styles.muted, { width: "23%" }]}>{s.typeSignal ?? ""}</Text>
              <Text style={[styles.cell, { width: "15%" }]}>{s.scoreOpportunite?.split(" ")[0] ?? ""}</Text>
            </View>
          ))
        )}

        <View style={styles.footer} fixed>
          <Text>Sia Partners — Confidentiel</Text>
          <Text>Adil Zriouil · Senior Manager TEC</Text>
        </View>
      </Page>
    </Document>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}
