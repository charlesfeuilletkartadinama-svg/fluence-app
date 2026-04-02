# Résumé des corrections — Audit Architecture

> Date : 2026-04-02

## Corrections appliquées

### 1. CRITIQUE — Timer QCM côté serveur
- **Migration** : `supabase/migrations/001_add_started_at_to_test_sessions.sql`
- **RPC** : `supabase/functions/submit_qcm_individual.sql` — validation `now() > timer_ref + duree_timer + 10s`
- **Client** : `app/test/page.tsx` — gestion erreur `too_late`
- **Test** : Lancer un QCM, attendre que le timer expire, tenter de soumettre → message "temps dépassé"

### 2. CRITIQUE — Offline sync chiffré
- **Fichier** : `app/lib/offlineStorage.ts` — réécriture complète
- **Méthode** : AES-GCM 256 bits via SubtleCrypto, clé dérivée PBKDF2 depuis userId
- **Fallback** : Si SubtleCrypto indisponible (HTTP), stockage en clair avec warning
- **Test** : Couper le réseau, saisir une passation, vérifier que localStorage est chiffré (base64, pas JSON)

### 3. ÉLEVÉ — Pages orphelines
- **Fichiers** : `app/dashboard/mes-eleves/page.tsx`, `app/dashboard/sessions/page.tsx`
- **Action** : Remplacés par `redirect()` vers `/dashboard/mes-classes` et `/dashboard/passation`
- **Test** : Accéder à `/dashboard/mes-eleves` → redirigé vers `/dashboard/mes-classes`

### 4. ÉLEVÉ — Doublon routes documenté
- **Fichiers** : Commentaires JSDoc ajoutés dans `eleve/[id]/page.tsx` et `eleves/[id]/page.tsx`
- **Documentation** : `ROUTING_AUDIT.md` créé avec toutes les occurrences et recommandation de consolidation
- **Test** : Lire ROUTING_AUDIT.md pour comprendre la situation

### 5. MOYEN — Alerte normes manquantes
- **Fichier** : `app/dashboard/admin/page.tsx` — banner rouge dans NormesTab si `normes.length === 0`
- **Test** : Aller dans Admin → Normes → sélectionner une période sans normes → banner rouge visible

### 6. MOYEN — Onboarding direction
- **Migration** : `supabase/migrations/002_add_onboarding_done_to_profils.sql`
- **Fichier** : `app/lib/useProfil.ts` — champ `onboarding_done` + flag `needsOnboarding`
- **Layout** : Commentaire TODO dans `app/dashboard/layout.tsx`
- **Test** : Après migration, créer un profil directeur → `needsOnboarding === true`

## Migrations Supabase à exécuter (dans l'ordre)

```bash
# 1. Timer QCM
psql -f supabase/migrations/001_add_started_at_to_test_sessions.sql

# 2. RPC mise à jour
psql -f supabase/functions/submit_qcm_individual.sql

# 3. Onboarding flag
psql -f supabase/migrations/002_add_onboarding_done_to_profils.sql
```

## TODOs restants

- [ ] Exécuter les 3 migrations SQL ci-dessus sur Supabase
- [ ] Implémenter le redirect onboarding dans `dashboard/page.tsx` (vérifier `needsOnboarding`)
- [ ] Consolider les routes `/dashboard/eleve/` et `/dashboard/eleves/` (voir ROUTING_AUDIT.md)
- [ ] Configurer `setOfflineUserId()` dans le layout dashboard après auth (pour le chiffrement)
- [ ] Ajouter tests E2E pour les flux critiques (passation QCM, offline sync)
