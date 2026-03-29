# Checklist mise en service beta — Fluence+

## Supabase

### Auth
- [ ] Aller dans **Authentication → Settings**
  - Confirm email : **ON** (obligatoire pour la production)
  - Email rate limit : `5 emails / heure / IP`
  - Password minimum length : `8`
- [ ] Personnaliser les templates email en français
  - **Confirmation** : "Bienvenue sur Fluence+ — confirmez votre adresse email"
  - **Password reset** : "Fluence+ — Réinitialisation de votre mot de passe"
  - **Invite** : si utilisé

### Base de données
- [ ] Vérifier la **région** : Settings → General → Region → `eu-west-3 (Paris)`
- [ ] Activer **PITR** (Point-in-Time Recovery) : Settings → Database → Backups
- [ ] Vérifier que les extensions utilisées sont actives : `uuid-ossp`, `pgcrypto`
- [ ] Exécuter `scripts/seed-demo.sql` pour créer les données DEMO (optionnel)

### Sécurité
- [ ] Vérifier que **RLS est activé** sur toutes les tables (Authentication → Policies)
- [ ] Vérifier que `get_current_user_role()` a `SET search_path = public`
- [ ] Révoquer accès public aux fonctions sensibles (`delete_my_account`)

### Monitoring
- [ ] Aller dans **Logs → Edge Functions** pour surveiller les erreurs
- [ ] Configurer une **alerte email** sur erreurs DB : Settings → Alerts

---

## Vercel

### Déploiement
- [ ] Configurer les variables d'environnement :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Domaine custom : Settings → Domains → Add Domain
- [ ] Vérifier que le domaine utilise HTTPS (auto via Vercel)
- [ ] Activer **Web Analytics** (optionnel, privacy-friendly)

### Performance
- [ ] Vérifier les **Core Web Vitals** après premier déploiement
- [ ] Vérifier le score Lighthouse (objectif : > 90)

---

## Application

### Page légale `/legal`
- [ ] Remplacer `[votre email de contact]` par l'email réel (3 occurrences dans `app/legal/page.tsx`)
- [ ] Mettre à jour la date "Dernière mise à jour"

### Test du flux complet
- [ ] Créer un compte via un code d'invitation DEMO
- [ ] Compléter l'onboarding (classes, périodes, normes)
- [ ] Saisir des scores via Mode Saisie
- [ ] Passer une évaluation via Mode Passation
- [ ] Vérifier les statistiques générées
- [ ] Générer un rapport PDF
- [ ] Vérifier la page Groupes de besoin
- [ ] Tester l'export RGPD (Profil → Télécharger mes données)
- [ ] Tester le endpoint `/api/health` (doit retourner `{"status":"ok"}`)

### Rôles à tester
- [ ] `enseignant` — flux saisie/passation
- [ ] `directeur` — tableau de bord multi-classes
- [ ] `admin` — gestion établissements, invitations, périodes

---

## Communications

- [ ] Rédiger l'email d'introduction pour les directeurs pilotes
- [ ] Préparer le guide utilisateur (Mode Saisie vs Mode Passation)
- [ ] Définir le contact support pour la phase beta

---

*Dernière mise à jour : mars 2026*
