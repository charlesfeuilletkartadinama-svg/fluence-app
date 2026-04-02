-- ══════════════════════════════════════════════════════════════
-- VALIDATION — 15 requêtes post-seed
-- ══════════════════════════════════════════════════════════════

-- 1. Élèves uniques par année et établissement
SELECT a.annee_scolaire, e2.nom as etablissement, count(DISTINCT a.eleve_id) as nb_eleves
FROM affectations a
JOIN classes c ON c.id = a.classe_id
JOIN etablissements e2 ON e2.id = c.etablissement_id
GROUP BY a.annee_scolaire, e2.nom ORDER BY a.annee_scolaire, e2.nom;

-- 2. Passations par année / période / niveau
SELECT p2.annee_scolaire, p2.code, c.niveau, count(*) as nb_passations
FROM passations p
JOIN periodes p2 ON p2.id = p.periode_id
JOIN classes c ON c.id = p.classe_id
GROUP BY p2.annee_scolaire, p2.code, c.niveau ORDER BY p2.annee_scolaire, p2.code, c.niveau;

-- 3. Score moyen par niveau et période
SELECT c.niveau, p2.code, round(avg(p.score)) as moy
FROM passations p
JOIN periodes p2 ON p2.id = p.periode_id
JOIN classes c ON c.id = p.classe_id
WHERE p.score IS NOT NULL AND p.non_evalue = false
GROUP BY c.niveau, p2.code ORDER BY c.niveau, p2.code;

-- 4. Distribution des 4 groupes de besoin (année 2025-2026, T3)
SELECT
  CASE
    WHEN p.score < cn.seuil_min * 0.7 THEN 'Très fragile'
    WHEN p.score < cn.seuil_min THEN 'Fragile'
    WHEN p.score < cn.seuil_attendu THEN 'En cours'
    ELSE 'Attendu'
  END as groupe, count(*) as nb
FROM passations p
JOIN periodes per ON per.id = p.periode_id
JOIN classes c ON c.id = p.classe_id
LEFT JOIN config_normes cn ON cn.niveau = c.niveau AND cn.periode_id = p.periode_id
WHERE per.annee_scolaire = '2025-2026' AND per.code = 'T3' AND p.score IS NOT NULL
GROUP BY groupe ORDER BY nb DESC;

-- 5. Cas Stevenson Apiku — passations 3 ans
SELECT e.nom, e.prenom, e.numero_ine, per.annee_scolaire, per.code, p.score, c.niveau
FROM passations p
JOIN eleves e ON e.id = p.eleve_id
JOIN periodes per ON per.id = p.periode_id
JOIN classes c ON c.id = p.classe_id
WHERE e.numero_ine = '1234567AA'
ORDER BY per.annee_scolaire, per.code;

-- 6. Cas Windys Bambou — 2 affectations CP
SELECT e.nom, e.prenom, a.annee_scolaire, c.niveau, c.nom as classe
FROM affectations a
JOIN eleves e ON e.id = a.eleve_id
JOIN classes c ON c.id = a.classe_id
WHERE e.numero_ine = '2345678BB'
ORDER BY a.annee_scolaire;

-- 7. Élèves sans aucune passation
SELECT count(*) as eleves_sans_passation
FROM eleves e
WHERE NOT EXISTS (SELECT 1 FROM passations p WHERE p.eleve_id = e.id);

-- 8. Passations sans classe_id
SELECT count(*) as passations_sans_classe FROM passations WHERE classe_id IS NULL;

-- 9. Classes sans annee_scolaire
SELECT count(*) as classes_sans_annee FROM classes WHERE annee_scolaire IS NULL;

-- 10. Cohérence affectations vs eleves.classe_id
SELECT count(*) as incoherences
FROM eleves e
JOIN affectations a ON a.eleve_id = e.id AND a.annee_scolaire = '2025-2026'
WHERE e.classe_id != a.classe_id;

-- 11. Sessions QCM avec started_at non null
SELECT count(*) as sessions_avec_started_at FROM test_sessions WHERE started_at IS NOT NULL;

-- 12. Couverture normes niveau × période
SELECT count(DISTINCT niveau || '_' || periode_id) as combos_normes FROM config_normes;

-- 13. Top 5 progressions sur 3 ans
SELECT e.nom, e.prenom, e.numero_ine,
  min(p.score) as score_min, max(p.score) as score_max, max(p.score) - min(p.score) as progression
FROM passations p
JOIN eleves e ON e.id = p.eleve_id
WHERE p.score IS NOT NULL AND p.non_evalue = false
GROUP BY e.id, e.nom, e.prenom, e.numero_ine
HAVING count(DISTINCT p.periode_id) >= 6
ORDER BY progression DESC LIMIT 5;

-- 14. Établissements avec le moins de passations
SELECT et.nom, count(p.id) as nb_passations
FROM etablissements et
LEFT JOIN classes c ON c.etablissement_id = et.id
LEFT JOIN passations p ON p.classe_id = c.id
GROUP BY et.id, et.nom ORDER BY nb_passations ASC;

-- 15. Unicité INE
SELECT numero_ine, count(*) as doublons
FROM eleves GROUP BY numero_ine HAVING count(*) > 1;
