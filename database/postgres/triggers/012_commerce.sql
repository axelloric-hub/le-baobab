SELECT baobab_attach_updated_at_triggers();

DROP TRIGGER IF EXISTS trg_review_rating ON marketplace_review;
CREATE TRIGGER trg_review_rating AFTER INSERT OR UPDATE OF rating OR DELETE ON marketplace_review FOR EACH ROW EXECUTE FUNCTION baobab_trg_review_rating();

-- Grand livre : ecriture seule + equilibre verifie au commit.
DROP TRIGGER IF EXISTS trg_ledger_immutable ON payments_ledger_entry;
CREATE TRIGGER trg_ledger_immutable BEFORE UPDATE OR DELETE ON payments_ledger_entry FOR EACH ROW EXECUTE FUNCTION baobab_forbid_mutation();
DROP TRIGGER IF EXISTS trg_ledger_balanced ON payments_ledger_entry;
CREATE CONSTRAINT TRIGGER trg_ledger_balanced AFTER INSERT ON payments_ledger_entry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION baobab_ledger_check_batch();

-- Audit des objets financiers.
DROP TRIGGER IF EXISTS trg_audit_order ON marketplace_order;
CREATE TRIGGER trg_audit_order AFTER INSERT OR UPDATE OF status, total_minor OR DELETE ON marketplace_order FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');
DROP TRIGGER IF EXISTS trg_audit_payment ON payments_payment;
CREATE TRIGGER trg_audit_payment AFTER INSERT OR UPDATE OR DELETE ON payments_payment FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id', 'updated_at');
DROP TRIGGER IF EXISTS trg_audit_refund ON payments_refund;
CREATE TRIGGER trg_audit_refund AFTER INSERT OR UPDATE OR DELETE ON payments_refund FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');
DROP TRIGGER IF EXISTS trg_audit_license ON marketplace_license;
CREATE TRIGGER trg_audit_license AFTER INSERT OR UPDATE OR DELETE ON marketplace_license FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');
