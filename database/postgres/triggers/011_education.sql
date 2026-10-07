-- Triggers du domaine education : mises a jour automatiques d'updated_at + audit des objets sensibles (acces payants, certificats, notes).
SELECT baobab_attach_updated_at_triggers();

DROP TRIGGER IF EXISTS trg_audit_entitlement ON education_entitlement;
CREATE TRIGGER trg_audit_entitlement AFTER INSERT OR UPDATE OR DELETE ON education_entitlement FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');

DROP TRIGGER IF EXISTS trg_audit_certificate ON progress_certificate;
CREATE TRIGGER trg_audit_certificate AFTER INSERT OR UPDATE OR DELETE ON progress_certificate FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');

DROP TRIGGER IF EXISTS trg_audit_grade ON assessments_grade;
CREATE TRIGGER trg_audit_grade AFTER INSERT OR UPDATE OR DELETE ON assessments_grade FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');

DROP TRIGGER IF EXISTS trg_audit_enrollment ON education_enrollment;
CREATE TRIGGER trg_audit_enrollment AFTER UPDATE OR DELETE ON education_enrollment FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');
