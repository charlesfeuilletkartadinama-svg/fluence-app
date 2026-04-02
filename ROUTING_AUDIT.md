# Audit de routing — Routes doublons

> Audit : 2026-04-02

## Problème

Deux routes avec des segments similaires coexistent :

| Route | Type | Fichier |
|-------|------|---------|
| `/dashboard/eleve/[id]` | Fiche **ÉLÈVE** individuelle (graphe progression) | `app/dashboard/eleve/[id]/page.tsx` |
| `/dashboard/eleves/[id]` | Fiche **CLASSE** détaillée (liste élèves + scores) | `app/dashboard/eleves/[id]/page.tsx` |

Le segment singulier (`eleve`) vs pluriel (`eleves`) est confusant.

## Occurrences dans le code

### Liens vers `/dashboard/eleve/[id]` (fiche élève)
| Fichier | Ligne | Contexte |
|---------|-------|---------|
| `app/components/Sidebar.tsx` | ~182 | Résultat recherche élève |
| `app/dashboard/groupes/page.tsx` | ~482 | Clic sur élève dans groupe |
| `app/dashboard/groupes/page.tsx` | ~531 | Clic sur élève fragile |
| `app/dashboard/eleves/page.tsx` | ~339 | Résultat recherche INE |
| `app/dashboard/eleves/page.tsx` | ~384 | Clic sur élève dans liste |

### Liens vers `/dashboard/eleves/[id]` (fiche classe)
| Fichier | Ligne | Contexte |
|---------|-------|---------|
| `app/dashboard/page.tsx` | ~1533 | Clic sur classe dans tableau direction |
| `app/dashboard/eleves/page.tsx` | ~422 | Clic sur classe dans explorateur |

## Recommandation de consolidation (futur)

1. **Renommer** `/dashboard/eleves/[id]` → `/dashboard/classes/[id]` pour éviter la confusion
2. **Garder** `/dashboard/eleve/[id]` comme route canonique pour les fiches élèves
3. **Mettre à jour** les 2 liens vers `/dashboard/eleves/[id]` pour pointer vers `/dashboard/classes/[id]`
4. Ajouter un **redirect** dans l'ancien `/dashboard/eleves/[id]`

**Priorité** : basse (pas de bug fonctionnel, juste de la confusion pour les développeurs)
