DROP VIEW IF EXISTS v_campaign_statistics;
DROP TRIGGER IF EXISTS trg_adtx_immutable ON advertising_account_transaction;
DROP TRIGGER IF EXISTS trg_settlement_immutable ON advertising_settlement;
DROP TRIGGER IF EXISTS trg_adwallet_check_tx ON advertising_account_transaction;
DROP TRIGGER IF EXISTS trg_adwallet_check_account ON advertising_account;
DROP TRIGGER IF EXISTS trg_audit_ad ON advertising_ad;
DROP TRIGGER IF EXISTS trg_audit_campaign ON advertising_campaign;
DROP FUNCTION IF EXISTS baobab_campaign_settled_micro(uuid), baobab_adwallet_check();
