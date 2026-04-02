-- RPC: submit_qcm_individual — avec validation timer côté serveur
-- Remplace la version précédente

CREATE OR REPLACE FUNCTION submit_qcm_individual(p_code text, p_answers text[])
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_se record;
  v_session record;
  v_classe record;
  v_test record;
  v_q record;
  v_results text[];
  v_i int;
  v_temps int;
  v_timer_ref timestamptz;
BEGIN
  -- Trouver l'élève via son code
  SELECT * INTO v_se FROM session_eleves WHERE code_individuel = p_code;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Code invalide'); END IF;

  -- Vérifier la session
  SELECT * INTO v_session FROM test_sessions WHERE id = v_se.session_id AND active = true AND expires_at > now();
  IF NOT FOUND THEN RETURN json_build_object('error', 'Session expirée ou inactive'); END IF;

  -- ★ VALIDATION TIMER CÔTÉ SERVEUR
  -- Référence = timer_reset_at (si reset) ou debut_test (sinon)
  v_timer_ref := COALESCE(v_se.timer_reset_at, v_se.debut_test);
  IF v_timer_ref IS NOT NULL AND
     now() > v_timer_ref + (v_session.duree_timer + 10) * interval '1 second' THEN
    -- 10 secondes de tolérance réseau
    RETURN json_build_object('error', 'too_late', 'message', 'Le temps imparti est dépassé.');
  END IF;

  -- Trouver le niveau de la classe
  SELECT c.* INTO v_classe FROM classes c JOIN eleves e ON e.classe_id = c.id WHERE e.id = v_se.eleve_id;

  -- Trouver le test QCM
  SELECT * INTO v_test FROM qcm_tests WHERE periode_id = v_session.periode_id AND niveau = v_classe.niveau;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Aucun test QCM configuré'); END IF;

  -- Corriger chaque réponse (gérer les réponses vides = non répondu)
  v_results := ARRAY[]::text[];
  FOR v_i IN 1..6 LOOP
    IF v_i > array_length(p_answers, 1) OR p_answers[v_i] IS NULL OR p_answers[v_i] = '' THEN
      v_results := array_append(v_results, 'Non répondu');
    ELSE
      SELECT * INTO v_q FROM qcm_questions WHERE qcm_test_id = v_test.id AND numero = v_i;
      IF NOT FOUND THEN v_results := array_append(v_results, NULL);
      ELSIF v_q.reponse_correcte = p_answers[v_i] THEN v_results := array_append(v_results, 'Correct');
      ELSE v_results := array_append(v_results, 'Incorrect');
      END IF;
    END IF;
  END LOOP;

  -- Calculer temps total (cappé à duree_timer)
  v_temps := EXTRACT(EPOCH FROM (now() - COALESCE(v_se.timer_reset_at, v_se.debut_test)))::int;
  IF v_temps > v_session.duree_timer THEN v_temps := v_session.duree_timer; END IF;

  -- Upsert passation
  INSERT INTO passations (eleve_id, periode_id, hors_periode, q1, q2, q3, q4, q5, q6, mode)
  VALUES (v_se.eleve_id, v_session.periode_id, false,
    v_results[1], v_results[2], v_results[3], v_results[4], v_results[5], v_results[6], 'qcm_eleve')
  ON CONFLICT (eleve_id, periode_id, hors_periode)
  DO UPDATE SET q1=EXCLUDED.q1, q2=EXCLUDED.q2, q3=EXCLUDED.q3, q4=EXCLUDED.q4, q5=EXCLUDED.q5, q6=EXCLUDED.q6, mode=EXCLUDED.mode;

  -- Marquer l'élève comme terminé avec temps cappé
  UPDATE session_eleves SET
    termine = true,
    fin_test = now(),
    reponses = to_jsonb(p_answers),
    temps_total_secondes = v_temps
  WHERE id = v_se.id;

  RETURN json_build_object('success', true, 'results', to_json(v_results));
END;
$$;
