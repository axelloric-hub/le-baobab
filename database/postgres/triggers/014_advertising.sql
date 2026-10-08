SELECT baobab_attach_updated_at_triggers();

DROP TRIGGER IF EXISTS trg_adtx_immutable ON advertising_account_transaction;
CREATE TRIGGER trg_adtx_immutable BEFORE UPDATE OR DELETE ON advertising_account_transaction FOR EACH ROW EXECUTE FUNCTION baobab_forbid_mutation();
DROP TRIGGER IF EXISTS trg_settlement_immutable ON advertising_settlement;
CREATE TRIGGER trg_settlement_immutable BEFORE UPDATE OR DELETE ON advertising_settlement FOR EACH ROW EXECUTE FUNCTION baobab_forbid_mutation();

DROP TRIGGER IF EXISTS trg_adwallet_check_tx ON advertising_account_transaction;
CREATE CONSTRAINT TRIGGER trg_adwallet_check_tx AFTER INSERT ON advertising_account_transaction DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION baobab_adwallet_check();
DROP TRIGGER IF EXISTS trg_adwallet_check_account ON advertising_account;
CREATE CONSTRAINT TRIGGER trg_adwallet_check_account AFTER UPDATE OF balance_minor ON advertising_account DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION baobab_adwallet_check();

DROP TRIGGER IF EXISTS trg_audit_ad ON advertising_ad;
CREATE TRIGGER trg_audit_ad AFTER INSERT OR UPDATE OF status OR DELETE ON advertising_ad FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');
DROP TRIGGER IF EXISTS trg_audit_campaign ON advertising_campaign;
CREATE TRIGGER trg_audit_campaign AFTER INSERT OR UPDATE OF status, daily_budget_minor, total_budget_minor OR DELETE ON advertising_campaign FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id', 'updated_at');
