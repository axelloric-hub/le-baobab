CREATE OR REPLACE VIEW v_course_statistics AS
SELECT co.id AS course_id, co.title, co.status, cl.id AS classroom_id,
       (SELECT count(*) FROM education_enrollment e WHERE e.course_id = co.id) AS enrollments,
       (SELECT count(*) FROM education_enrollment e WHERE e.course_id = co.id AND e.status = 'completed') AS completions,
       (SELECT CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE e.status = 'completed') / count(*), 2) END
          FROM education_enrollment e WHERE e.course_id = co.id) AS completion_rate,
       (SELECT count(*) FROM progress_certificate ce WHERE ce.course_id = co.id AND ce.revoked_at IS NULL) AS certificates,
       (SELECT count(*) FROM education_chapter c JOIN education_module m ON m.id = c.module_id WHERE m.course_id = co.id AND c.is_published) AS published_chapters,
       (SELECT count(*) FROM education_entitlement en WHERE en.revoked_at IS NULL AND (en.course_id = co.id OR en.module_id IN (SELECT id FROM education_module WHERE course_id = co.id))) AS active_entitlements
  FROM education_course co
  JOIN education_classroom cl ON cl.id = co.classroom_id;
