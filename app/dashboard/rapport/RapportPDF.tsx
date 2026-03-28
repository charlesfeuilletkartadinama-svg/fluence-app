import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ── Types nouveaux PDF ─────────────────────────────────────────────────────

type ClasseEtabData = {
  nom: string; niveau: string; nbEleves: number; nbEvalues: number; nbNE: number
  moyenne: number|null; min: number|null; max: number|null; fragiles: number
}

type DonneesEtab = {
  etablissement: string; periode: string; dateGeneration: string; directeur: string
  classes: ClasseEtabData[]
  totaux: { nbEleves: number; nbEvalues: number; moyenne: number|null; fragiles: number }
}

type DonneesComplet = {
  etablissement: string; dateGeneration: string; directeur: string
  periodes: string[]
  classes: {
    nom: string; niveau: string
    periodes: { code: string; nbEleves: number; nbEvalues: number; moyenne: number|null; fragiles: number }[]
  }[]
}

const styles = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 10, padding: 40, backgroundColor: '#ffffff' },
  header:      { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#003189', paddingBottom: 12 },
  titre:       { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#003189', marginBottom: 4 },
  sousTitre:   { fontSize: 11, color: '#5A6275' },
  infoGrid:    { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 8 },
  infoCard:    { backgroundColor: '#F0F4FF', borderRadius: 6, padding: 8, flex: 1, minWidth: '22%' },
  infoLabel:   { fontSize: 8, color: '#5A6275', textTransform: 'uppercase', marginBottom: 2 },
  infoVal:     { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#003189' },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox:     { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  statNum:     { fontSize: 24, fontFamily: 'Helvetica-Bold' },
  statLabel:   { fontSize: 8, marginTop: 2, textTransform: 'uppercase' },
  sectionTitle:{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#003189', marginBottom: 8, marginTop: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#003189', borderRadius: 4, padding: '6 8', marginBottom: 2 },
  tableHeaderCell: { color: '#ffffff', fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  tableRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', padding: '5 8' },
  tableRowAlt: { backgroundColor: '#F8FAFC' },
  cell:        { fontSize: 9, color: '#1E293B' },
  cellBold:    { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#003189' },
  groupeCard:  { borderRadius: 6, padding: 10, marginBottom: 8, borderLeftWidth: 4 },
  groupeNom:   { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  groupeEleves:{ fontSize: 9, color: '#475569', marginBottom: 4 },
  groupeSugg:  { fontSize: 8, color: '#64748B', fontStyle: 'italic' },
  footer:      { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8 },
  footerText:  { fontSize: 8, color: '#94A3B8' },
  normeBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 6, padding: 8, marginBottom: 16, borderWidth: 1 },
  normeBadge:  { fontSize: 8, fontFamily: 'Helvetica-Bold', padding: '3 8', borderRadius: 4 },
})

type Donnees = {
  classe: string
  niveau: string
  etablissement: string
  periode: string
  periodeComp: string | null
  enseignant: string
  dateGeneration: string
  eleves: {
    nom: string
    prenom: string
    score: number | null
    ne: boolean
    groupe: string
    progression: number | null
    q1: string | null
    q2: string | null
    q3: string | null
    q4: string | null
    q5: string | null
    q6: string | null
  }[]
  stats: {
    moyenne: number | null
    min: number | null
    max: number | null
    nbEvalues: number
    nbNE: number
    total: number
  }
  normes: { seuil_min: number; seuil_attendu: number } | null
  groupesBesoins: {
    nom: string
    couleur: string
    eleves: string[]
    suggestions: string
  }[]
}

// ── PDF Par établissement ─────────────────────────────────────────────────

export function RapportEtabPDF({ donnees }: { donnees: DonneesEtab }) {
  const pctEval = donnees.totaux.nbEleves > 0
    ? Math.round(donnees.totaux.nbEvalues / donnees.totaux.nbEleves * 100)
    : 0
  const pctFrag = donnees.totaux.nbEvalues > 0
    ? Math.round(donnees.totaux.fragiles / donnees.totaux.nbEvalues * 100)
    : 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.titre}>Rapport d'établissement — Fluence</Text>
          <Text style={styles.sousTitre}>{donnees.etablissement} · Période {donnees.periode}</Text>
        </View>

        <View style={styles.infoGrid}>
          {[
            { label: 'Établissement', val: donnees.etablissement },
            { label: 'Période',       val: donnees.periode },
            { label: 'Directeur',     val: donnees.directeur },
            { label: 'Généré le',     val: donnees.dateGeneration },
          ].map(item => (
            <View key={item.label} style={styles.infoCard}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoVal}>{item.val}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.statNum, { color: '#003189' }]}>{donnees.totaux.nbEleves}</Text>
            <Text style={[styles.statLabel, { color: '#003189' }]}>Élèves total</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[styles.statNum, { color: '#16A34A' }]}>{donnees.totaux.nbEvalues}</Text>
            <Text style={[styles.statLabel, { color: '#16A34A' }]}>Évalués ({pctEval}%)</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.statNum, { color: '#DC2626' }]}>{donnees.totaux.fragiles}</Text>
            <Text style={[styles.statLabel, { color: '#DC2626' }]}>Fragiles ({pctFrag}%)</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#F8FAFC' }]}>
            <Text style={[styles.statNum, { color: '#475569' }]}>{donnees.totaux.moyenne ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#475569' }]}>Score moyen m/min</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Détail par classe</Text>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Classe</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Niveau</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Élèves</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Évalués</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Moyenne</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Fragiles</Text>
          </View>
          {donnees.classes.map((c, i) => {
            const pctF = c.nbEvalues > 0 ? Math.round(c.fragiles / c.nbEvalues * 100) : 0
            return (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.cellBold, { flex: 2 }]}>{c.nom}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{c.niveau}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>{c.nbEleves}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>
                  {c.nbEvalues} {c.nbEleves > 0 ? `(${Math.round(c.nbEvalues / c.nbEleves * 100)}%)` : ''}
                </Text>
                <Text style={[styles.cellBold, { flex: 1, textAlign: 'center', color: '#003189' }]}>
                  {c.moyenne ?? '—'} {c.moyenne ? 'm/min' : ''}
                </Text>
                <Text style={[styles.cell, { flex: 1, textAlign: 'center', color: pctF > 40 ? '#DC2626' : pctF > 20 ? '#D97706' : '#16A34A' }]}>
                  {c.fragiles} ({pctF}%)
                </Text>
              </View>
            )
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Fluence+ — Académie de Guyane</Text>
          <Text style={styles.footerText}>Généré le {donnees.dateGeneration}</Text>
        </View>
      </Page>
    </Document>
  )
}

// ── PDF Rapport complet ───────────────────────────────────────────────────

export function RapportCompletPDF({ donnees }: { donnees: DonneesComplet }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.titre}>Rapport complet — Fluence</Text>
          <Text style={styles.sousTitre}>{donnees.etablissement} · {donnees.periodes.join(' / ')}</Text>
        </View>

        <View style={styles.infoGrid}>
          {[
            { label: 'Établissement', val: donnees.etablissement },
            { label: 'Périodes',      val: donnees.periodes.join(', ') },
            { label: 'Directeur',     val: donnees.directeur },
            { label: 'Généré le',     val: donnees.dateGeneration },
          ].map(item => (
            <View key={item.label} style={styles.infoCard}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoVal}>{item.val}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Progression par classe et par période</Text>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Classe</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Niveau</Text>
            {donnees.periodes.map(p => (
              <Text key={p} style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>
                {p} moy.
              </Text>
            ))}
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Évol.</Text>
          </View>
          {donnees.classes.map((c, i) => {
            const perMap: Record<string, number|null> = {}
            c.periodes.forEach(p => { perMap[p.code] = p.moyenne })
            const scores  = donnees.periodes.map(p => perMap[p] ?? null).filter(s => s !== null) as number[]
            const evol    = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null
            return (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.cellBold, { flex: 2 }]}>{c.nom}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{c.niveau}</Text>
                {donnees.periodes.map(p => (
                  <Text key={p} style={[styles.cellBold, { flex: 1, textAlign: 'center', color: perMap[p] != null ? '#003189' : '#94A3B8' }]}>
                    {perMap[p] ?? '—'}
                  </Text>
                ))}
                <Text style={[styles.cellBold, { flex: 1, textAlign: 'center', color: evol == null ? '#94A3B8' : evol > 0 ? '#16A34A' : evol < 0 ? '#DC2626' : '#475569' }]}>
                  {evol == null ? '—' : evol > 0 ? `+${evol}` : `${evol}`}
                </Text>
              </View>
            )
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Fluence+ — Académie de Guyane</Text>
          <Text style={styles.footerText}>Généré le {donnees.dateGeneration}</Text>
        </View>
      </Page>
    </Document>
  )
}

// ── PDF Par classe (existant) ─────────────────────────────────────────────

export function RapportPDF({ donnees }: { donnees: Donnees }) {
  const { stats, normes } = donnees

  const normeStatut = !stats.moyenne || !normes ? null
    : stats.moyenne >= normes.seuil_attendu
      ? { label: 'Au-dessus de la norme', color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' }
      : stats.moyenne >= normes.seuil_min
        ? { label: 'Entre seuil et norme', color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' }
        : { label: 'Sous le seuil critique', color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' }

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        <View style={styles.header}>
          <Text style={styles.titre}>Rapport de Fluence</Text>
          <Text style={styles.sousTitre}>Académie de Guyane — Test de fluence en lecture</Text>
        </View>

        <View style={styles.infoGrid}>
          {[
            { label: 'Classe',         val: donnees.classe },
            { label: 'Niveau',         val: donnees.niveau },
            { label: 'Période',        val: donnees.periode },
            { label: 'Établissement',  val: donnees.etablissement },
            { label: 'Enseignant',     val: donnees.enseignant },
            { label: 'Généré le',      val: donnees.dateGeneration },
          ].map(item => (
            <View key={item.label} style={styles.infoCard}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoVal}>{item.val}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.statNum, { color: '#1D4ED8' }]}>{stats.moyenne ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#1D4ED8' }]}>Score moyen m/min</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[styles.statNum, { color: '#16A34A' }]}>{stats.nbEvalues}</Text>
            <Text style={[styles.statLabel, { color: '#16A34A' }]}>Évalués</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FFF7ED' }]}>
            <Text style={[styles.statNum, { color: '#D97706' }]}>{stats.nbNE}</Text>
            <Text style={[styles.statLabel, { color: '#D97706' }]}>Non évalués</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#F8FAFC' }]}>
            <Text style={[styles.statNum, { color: '#475569' }]}>{stats.min ?? '—'}/{stats.max ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: '#475569' }]}>Min / Max</Text>
          </View>
        </View>

        {normeStatut && normes && (
          <View style={[styles.normeBar, { backgroundColor: normeStatut.bg, borderColor: normeStatut.border }]}>
            <Text style={[styles.normeBadge, { backgroundColor: normeStatut.color, color: '#fff' }]}>
              {normeStatut.label}
            </Text>
            <Text style={{ fontSize: 8, color: '#475569' }}>
              Norme : {normes.seuil_attendu} m/min · Seuil min : {normes.seuil_min} m/min
            </Text>
          </View>
        )}

        {donnees.groupesBesoins.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Groupes de besoin</Text>
            {donnees.groupesBesoins.map(g => (
              <View key={g.nom} style={[styles.groupeCard, { backgroundColor: g.couleur + '15', borderLeftColor: g.couleur }]}>
                <Text style={[styles.groupeNom, { color: g.couleur }]}>
                  {g.nom} — {g.eleves.length} élève{g.eleves.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.groupeEleves}>{g.eleves.join(' · ')}</Text>
                {g.suggestions ? <Text style={styles.groupeSugg}>→ {g.suggestions}</Text> : null}
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>
          Détail par élève{donnees.periodeComp ? ` (évolution vs ${donnees.periodeComp})` : ''}
        </Text>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Nom</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Prénom</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Score</Text>
            {donnees.periodeComp && (
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Évol.</Text>
            )}
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Statut</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Groupe</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Compréh.</Text>
          </View>
          {donnees.eleves.map((e, i) => {
            const qOk    = [e.q1,e.q2,e.q3,e.q4,e.q5,e.q6].filter(q => q === 'Correct').length
            const qTotal = [e.q1,e.q2,e.q3,e.q4,e.q5,e.q6].filter(q => q !== null).length
            const statut = e.ne ? '—'
              : e.score && normes
                ? e.score >= normes.seuil_attendu ? '✓' : e.score >= normes.seuil_min ? '~' : '!'
                : ''
            const evolStr = e.progression == null ? '—'
              : e.progression > 0 ? `+${e.progression}`
              : `${e.progression}`
            const evolColor = e.progression == null ? '#94A3B8'
              : e.progression > 0 ? '#16A34A'
              : e.progression < 0 ? '#DC2626'
              : '#475569'
            return (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.cellBold, { flex: 2 }]}>{e.nom}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{e.prenom}</Text>
                <Text style={[styles.cellBold, { flex: 1, textAlign: 'center', color: e.ne ? '#D97706' : '#003189' }]}>
                  {e.ne ? 'N.É.' : `${e.score}`}
                </Text>
                {donnees.periodeComp && (
                  <Text style={[styles.cellBold, { flex: 1, textAlign: 'center', color: evolColor }]}>
                    {evolStr}
                  </Text>
                )}
                <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>{statut}</Text>
                <Text style={[styles.cell, { flex: 2, color: '#475569' }]}>{e.groupe}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>
                  {qTotal > 0 ? `${qOk}/${qTotal}` : '—'}
                </Text>
              </View>
            )
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Application Test de Fluence — Académie de Guyane</Text>
          <Text style={styles.footerText}>Généré le {donnees.dateGeneration}</Text>
        </View>
      </Page>
    </Document>
  )
}