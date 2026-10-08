SELECT baobab_attach_updated_at_triggers();

DROP TRIGGER IF EXISTS trg_company_requires_owner_member ON companies_member;
CREATE CONSTRAINT TRIGGER trg_company_requires_owner_member AFTER DELETE OR UPDATE OF role ON companies_member
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION baobab_company_requires_owner();
DROP TRIGGER IF EXISTS trg_company_requires_owner_company ON companies_company;
CREATE CONSTRAINT TRIGGER trg_company_requires_owner_company AFTER INSERT ON companies_company
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION baobab_company_requires_owner();

DROP TRIGGER IF EXISTS trg_application_history_immutable ON jobs_application_status_event;
CREATE TRIGGER trg_application_history_immutable BEFORE UPDATE OR DELETE ON jobs_application_status_event FOR EACH ROW EXECUTE FUNCTION baobab_forbid_mutation('changed_by_id');

DROP TRIGGER IF EXISTS trg_audit_company_member ON companies_member;
CREATE TRIGGER trg_audit_company_member AFTER INSERT OR UPDATE OF role OR DELETE ON companies_member FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');
DROP TRIGGER IF EXISTS trg_audit_company_verification ON companies_verification;
CREATE TRIGGER trg_audit_company_verification AFTER INSERT OR UPDATE OR DELETE ON companies_verification FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');
DROP TRIGGER IF EXISTS trg_audit_offer ON jobs_offer;
CREATE TRIGGER trg_audit_offer AFTER INSERT OR UPDATE OR DELETE ON jobs_offer FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');
DROP TRIGGER IF EXISTS trg_audit_contract ON jobs_contract;
CREATE TRIGGER trg_audit_contract AFTER INSERT OR UPDATE OR DELETE ON jobs_contract FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');

-- Contrainte d'EXCLUSION : un recruteur ne peut pas avoir deux creneaux d'entretien qui se chevauchent.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'excl_slot_no_overlap') THEN
        ALTER TABLE jobs_interview_slot ADD CONSTRAINT excl_slot_no_overlap
            EXCLUDE USING gist (interviewer_id WITH =, tstzrange(starts_at, ends_at) WITH &&);
    END IF;
END $$;
