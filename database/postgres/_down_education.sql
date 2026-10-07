DROP VIEW IF EXISTS v_course_statistics;
DROP TRIGGER IF EXISTS trg_audit_entitlement ON education_entitlement;
DROP TRIGGER IF EXISTS trg_audit_certificate ON progress_certificate;
DROP TRIGGER IF EXISTS trg_audit_grade ON assessments_grade;
DROP TRIGGER IF EXISTS trg_audit_enrollment ON education_enrollment;
DROP FUNCTION IF EXISTS baobab_course_leaderboard(uuid, integer), baobab_quiz_best_percent(uuid, uuid), baobab_course_progress(uuid, uuid),
    baobab_module_progress(uuid, uuid), baobab_chapter_unlocked(uuid, uuid);
