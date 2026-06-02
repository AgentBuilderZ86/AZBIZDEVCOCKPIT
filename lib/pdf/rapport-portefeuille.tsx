import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "./theme";
import { SECTEURS, STAGES, type Compte } from "../types";

interface Props {
  comptes: Compte[];
  generatedAt: string;
}

/** Rapport portefeuille : pipeline pondéré, répartitions, comptes à risque. */
export function RapportPortefeuillePdf({ comptes, generatedAt }: Props) {
  const total = comptes.length;
  const arrTotal = comptes.reduce((s, c) => s + (c.arrPondere ?? 0), 0);
  const hot = comptes.filter((c) => c.stage === "Hot" || c.stage === "Active").length;
  const dormants = comptes.filter((c) => c.statutRelation === "Dormante");
  const aRisque = comptes.filter(
    (c) => c.statutRelation === "À développer" && (c.scoreAdilStar ?? 0) < 40
  );

  const bySecteur = SECTEURS.map((sec) => {
    const list = comptes.filter((c) => c.secteur === sec);
    return {
      secteur: sec,
      count: list.length,
      arr: list.reduce((s, c) => s + (c.arrPondere ?? 0), 0),
    };
  }).filter((g) => g.count > 0);

  const byStage = STAGES.map((st) => ({
    stage: st,
    count: comptes.filter((c) => c.stage === st).length,
  })).filter((g) => g.count > 0);

  const topComptes = [...comptes]
    .sort((a, b) => (b.scoreAdilStar ?? 0) - (a.scoreAdilStar ?? 0))
    .slice(0, 10);

  return (
    <Document title="Rapport portefeuille BizDev">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.brand}>SIA PARTNERS · ADIL BIZDEV OS</Text>
            <Text style={styles.docTitle}>Rapport portefeuille</Text>
          </View>
          <Text style={styles.docMeta}>Généré le {generatedAt}</Text>
        </View>

        <View style={styles.kpiRow}>
          <Kpi label="Comptes" value={`${total}`} />
          <Kpi label="ARR pondéré total (k€)" value={arrTotal.toLocaleString("fr-FR")} />
          <Kpi label="Hot / Active" value={`${hot}`} />
          <Kpi label="Dormants" value={`${dormants.length}`} />
          <Kpi label="À risque" value={`${aRisque.length}`} />
          <Kpi
            label="Score moyen"
            value={
              total
                ? `${Math.round(
                    comptes.reduce((s, c) => s + (c.scoreAdilStar ?? 0), 0) / total
                  )}`
                : "—"
            }
          />
        </View>

        <Text style={styles.h2}>Répartition par secteur</Text>
        <View style={styles.rowHead}>
          <Text style={[styles.cellHead, { width: "55%" }]}>Secteur</Text>
          <Text style={[styles.cellHead, { width: "20%" }]}>Comptes</Text>
          <Text style={[styles.cellHead, { width: "25%" }]}>ARR pond. (k€)</Text>
        </View>
        {bySecteur.map((g) => (
          <View key={g.secteur} style={styles.row}>
            <Text style={[styles.cell, { width: "55%" }]}>{g.secteur}</Text>
            <Text style={[styles.cell, { width: "20%" }]}>{g.count}</Text>
            <Text style={[styles.cell, { width: "25%" }]}>{g.arr.toLocaleString("fr-FR")}</Text>
          </View>
        ))}

        <Text style={styles.h2}>Répartition par stage</Text>
        <View style={styles.badgeRow}>
          {byStage.map((g) => (
            <Text key={g.stage} style={styles.badge}>
              {g.stage} : {g.count}
            </Text>
          ))}
        </View>

        <Text style={styles.h2}>Top comptes (Score AdilStar)</Text>
        <View style={styles.rowHead}>
          <Text style={[styles.cellHead, { width: "44%" }]}>Compte</Text>
          <Text style={[styles.cellHead, { width: "20%" }]}>Secteur</Text>
          <Text style={[styles.cellHead, { width: "16%" }]}>Stage</Text>
          <Text style={[styles.cellHead, { width: "10%" }]}>Score</Text>
          <Text style={[styles.cellHead, { width: "10%" }]}>ARR</Text>
        </View>
        {topComptes.map((c) => (
          <View key={c.id} style={styles.row}>
            <Text style={[styles.cell, { width: "44%" }]}>{c.compte || "—"}</Text>
            <Text style={[styles.cell, styles.muted, { width: "20%" }]}>{c.secteur ?? "—"}</Text>
            <Text style={[styles.cell, { width: "16%" }]}>{c.stage ?? "—"}</Text>
            <Text style={[styles.cell, { width: "10%" }]}>{c.scoreAdilStar ?? "—"}</Text>
            <Text style={[styles.cell, { width: "10%" }]}>{c.arrPondere ?? "—"}</Text>
          </View>
        ))}

        <Text style={styles.h2}>Comptes dormants / à risque</Text>
        {dormants.length === 0 && aRisque.length === 0 ? (
          <Text style={[styles.body, styles.muted]}>Aucun compte dormant ou à risque.</Text>
        ) : (
          [...dormants, ...aRisque].map((c) => (
            <View key={c.id} style={styles.row}>
              <Text style={[styles.cell, { width: "60%" }]}>{c.compte || "—"}</Text>
              <Text style={[styles.cell, { width: "25%", color: COLORS.red }]}>
                {c.statutRelation ?? "—"}
              </Text>
              <Text style={[styles.cell, { width: "15%" }]}>{c.scoreAdilStar ?? "—"}</Text>
            </View>
          ))
        )}

        <View style={styles.footer} fixed>
          <Text>Sia Partners — Confidentiel</Text>
          <Text>Portefeuille BizDev · Adil Zriouil</Text>
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
