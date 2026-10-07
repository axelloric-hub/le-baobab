-- =====================================================================================
-- 006_education.sql : acces payant et progression, calcules en SQL (une seule definition, utilisable par vues, jobs et futur AI Gateway).
-- =====================================================================================

-- Le chapitre est-il debloque cote PAIEMENT ? Gratuit, ou droit valide sur le chapitre, son module, son cours ou sa classroom.
-- (Les autres barrieres - appartenance a la classroom, inscription - sont portees par apps.education.access.)
CREATE OR REPLACE FUNCTION baobab_chapter_unlocked(p_user uuid, p_chapter uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT c.is_free OR EXISTS (
        SELECT 1 FROM education_entitlement e
         WHERE e.user_id = p_user AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())
           AND (e.chapter_id = c.id OR e.module_id = c.module_id OR e.course_id = m.course_id OR e.classroom_id = co.classroom_id))
      FROM education_chapter c
      JOIN education_module m ON m.id = c.module_id
      JOIN education_course co ON co.id = m.course_id
     WHERE c.id = p_chapter;
$$;

-- Progression d'un module : seuls les chapitres PUBLIES d'un module PUBLIE comptent.
CREATE OR REPLACE FUNCTION baobab_module_progress(p_user uuid, p_module uuid)
RETURNS TABLE (total_chapters integer, completed_chapters integer, percent numeric, time_spent_seconds bigint)
LANGUAGE sql STABLE AS $$
    SELECT t.total::integer, t.done::integer,
           CASE WHEN t.total = 0 THEN 0 ELSE round(100.0 * t.done / t.total, 2) END,
           t.secs
      FROM (
        SELECT count(c.id) AS total,
               count(cp.id) FILTER (WHERE cp.status = 'completed') AS done,
               COALESCE(sum(cp.time_spent_seconds), 0)::bigint AS secs
          FROM education_chapter c
          JOIN education_module m ON m.id = c.module_id AND m.is_published
          LEFT JOIN progress_chapter_progress cp ON cp.chapter_id = c.id AND cp.user_id = p_user
         WHERE c.module_id = p_module AND c.is_published) t;
$$;

CREATE OR REPLACE FUNCTION baobab_course_progress(p_user uuid, p_course uuid)
RETURNS TABLE (total_chapters integer, completed_chapters integer, percent numeric, time_spent_seconds bigint)
LANGUAGE sql STABLE AS $$
    SELECT t.total::integer, t.done::integer,
           CASE WHEN t.total = 0 THEN 0 ELSE round(100.0 * t.done / t.total, 2) END,
           t.secs
      FROM (
        SELECT count(c.id) AS total,
               count(cp.id) FILTER (WHERE cp.status = 'completed') AS done,
               COALESCE(sum(cp.time_spent_seconds), 0)::bigint AS secs
          FROM education_chapter c
          JOIN education_module m ON m.id = c.module_id AND m.is_published
          LEFT JOIN progress_chapter_progress cp ON cp.chapter_id = c.id AND cp.user_id = p_user
         WHERE m.course_id = p_course AND c.is_published) t;
$$;

-- Meilleur score (en %) d'un utilisateur sur un quiz, parmi les tentatives corrigees.
CREATE OR REPLACE FUNCTION baobab_quiz_best_percent(p_user uuid, p_quiz uuid) RETURNS numeric
LANGUAGE sql STABLE AS $$
    SELECT max(CASE WHEN max_score = 0 THEN 0 ELSE round(100.0 * score / max_score, 2) END)
      FROM assessments_quiz_attempt
     WHERE user_id = p_user AND quiz_id = p_quiz AND status = 'graded';
$$;

-- Classement d'un cours : chapitres termines puis temps passe (egalites -> meme rang).
CREATE OR REPLACE FUNCTION baobab_course_leaderboard(p_course uuid, p_limit integer DEFAULT 20)
RETURNS TABLE (user_id uuid, completed_chapters bigint, time_spent_seconds bigint, rank bigint)
LANGUAGE sql STABLE AS $$
    SELECT s.user_id, s.done, s.secs, rank() OVER (ORDER BY s.done DESC, s.secs DESC)
      FROM (
        SELECT cp.user_id,
               count(*) FILTER (WHERE cp.status = 'completed') AS done,
               sum(cp.time_spent_seconds)::bigint AS secs
          FROM progress_chapter_progress cp
          JOIN education_chapter c ON c.id = cp.chapter_id AND c.is_published
          JOIN education_module m ON m.id = c.module_id AND m.is_published
         WHERE m.course_id = p_course
         GROUP BY cp.user_id) s
     ORDER BY 4, 1
     LIMIT p_limit;
$$;
