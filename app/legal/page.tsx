export default function Legal() {
  return (
    <div style={{ minHeight: '100vh', background: '#F4F2ED', padding: '48px 24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <a href="/" style={{
          display: 'inline-block', marginBottom: 32, fontSize: 13,
          color: '#8A8680', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif',
        }}>
          ← Retour
        </a>

        <h1 style={{
          fontFamily: 'DM Serif Display, serif', fontSize: 36,
          color: '#001845', marginBottom: 8,
        }}>
          Mentions légales & Confidentialité
        </h1>
        <p style={{ fontSize: 14, color: '#8A8680', fontFamily: 'DM Sans, sans-serif', marginBottom: 48 }}>
          Dernière mise à jour : mars 2026
        </p>

        {[
          {
            titre: '1. Éditeur',
            contenu: `Fluence+ est un outil pédagogique numérique développé pour les établissements
scolaires de l'Académie de Guyane. Développé par M. FEUILLET.
Contact : [votre email de contact]`,
          },
          {
            titre: '2. Hébergement',
            contenu: `L'application est hébergée sur Vercel (infrastructure cloud, région Europe).
Les données sont stockées sur Supabase (PostgreSQL, région Europe West).
Supabase est signataire d'un Data Processing Agreement (DPA) conforme au RGPD.`,
          },
          {
            titre: '3. Données collectées',
            contenu: `Données des comptes utilisateurs :
— Nom, prénom, adresse email (obligatoires pour la création du compte)
— Rôle au sein de l'établissement
— Établissement de rattachement

Données pédagogiques :
— Scores de fluence en lecture (mots/minute) par élève et par période
— Résultats aux questions de compréhension (Q1-Q6)
— Statut non-évalué / absent

Les élèves sont identifiés par nom, prénom et classe uniquement.
Aucune donnée biométrique, aucune donnée de santé, aucun numéro INE n'est requis.`,
          },
          {
            titre: '4. Finalité des traitements',
            contenu: `Les données collectées ont pour unique finalité :
— Le suivi des scores de fluence en lecture des élèves
— La production de statistiques pédagogiques par classe, niveau et établissement
— La génération de rapports PDF destinés aux équipes enseignantes
— L'identification de groupes de besoin pour la remédiation

Base légale : intérêt légitime dans le cadre de la mission de service public d'éducation (article 6.1.e du RGPD).`,
          },
          {
            titre: '5. Durée de conservation',
            contenu: `— Données de compte : conservées pendant la durée d'utilisation active + 1 an après la dernière connexion
— Données pédagogiques (scores élèves) : conservées pendant la durée de scolarité de l'élève dans l'établissement
— Journaux d'activité : 6 mois glissants

À la demande de l'établissement, toutes les données peuvent être supprimées définitivement.`,
          },
          {
            titre: '6. Vos droits (RGPD)',
            contenu: `Conformément au Règlement Général sur la Protection des Données (RGPD, règlement UE 2016/679), vous disposez des droits suivants :

Droit d'accès : vous pouvez télécharger l'ensemble de vos données depuis votre page profil (bouton "Télécharger mes données").

Droit de rectification : vous pouvez modifier votre nom et prénom depuis votre page profil.

Droit à l'effacement : vous pouvez supprimer votre compte et vos données personnelles depuis votre page profil (bouton "Supprimer mon compte"). Les données pédagogiques des élèves (scores) sont conservées car elles appartiennent à l'établissement.

Droit à la portabilité : vos données sont exportées au format JSON standard.

Pour exercer ces droits ou pour toute question, contactez : [votre email de contact]

Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr).`,
          },
          {
            titre: '7. Sécurité des données',
            contenu: `Les mesures suivantes sont mises en place :
— Chiffrement des communications (HTTPS/TLS)
— Authentification sécurisée par Supabase Auth (bcrypt, JWT)
— Contrôle d'accès par rôle (RLS — Row Level Security) sur toutes les tables
— En-têtes HTTP de sécurité (HSTS, CSP, X-Frame-Options)
— Aucun stockage de mot de passe en clair
— Accès aux données limité aux utilisateurs autorisés de l'établissement`,
          },
          {
            titre: '8. Cookies',
            contenu: `L'application utilise uniquement des cookies de session nécessaires au fonctionnement de l'authentification (cookies Supabase Auth).
Aucun cookie publicitaire, aucun tracker tiers, aucun outil d'analyse comportementale n'est utilisé.`,
          },
          {
            titre: '9. Contact & réclamations',
            contenu: `Pour toute question relative à vos données personnelles :
Email : [votre email de contact]

Pour toute réclamation auprès de l'autorité de contrôle française :
CNIL — Commission Nationale de l'Informatique et des Libertés
www.cnil.fr — 3 Place de Fontenoy, 75007 Paris`,
          },
        ].map(section => (
          <div key={section.titre} style={{
            background: 'white', borderRadius: 16,
            padding: '28px 32px', marginBottom: 16,
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <h2 style={{
              fontSize: 16, fontWeight: 700, color: '#001845',
              fontFamily: 'DM Sans, sans-serif', marginBottom: 14,
            }}>
              {section.titre}
            </h2>
            <p style={{
              fontSize: 13, color: '#4A4540', lineHeight: 1.8,
              fontFamily: 'DM Sans, sans-serif', whiteSpace: 'pre-line', margin: 0,
            }}>
              {section.contenu}
            </p>
          </div>
        ))}

        <p style={{ fontSize: 12, color: '#A8A49D', textAlign: 'center', marginTop: 32, fontFamily: 'DM Sans, sans-serif' }}>
          © 2026 Fluence+ · Développé par M. FEUILLET · Académie de Guyane
        </p>
      </div>
    </div>
  )
}
