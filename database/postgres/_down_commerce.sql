DROP VIEW IF EXISTS v_store_statistics;
DROP TRIGGER IF EXISTS trg_review_rating ON marketplace_review;
DROP TRIGGER IF EXISTS trg_ledger_immutable ON payments_ledger_entry;
DROP TRIGGER IF EXISTS trg_ledger_balanced ON payments_ledger_entry;
DROP TRIGGER IF EXISTS trg_audit_order ON marketplace_order;
DROP TRIGGER IF EXISTS trg_audit_payment ON payments_payment;
DROP TRIGGER IF EXISTS trg_audit_refund ON payments_refund;
DROP TRIGGER IF EXISTS trg_audit_license ON marketplace_license;
DROP FUNCTION IF EXISTS baobab_store_revenue(uuid, timestamptz, timestamptz), baobab_order_ledger_balance(uuid), baobab_ledger_check_batch(), baobab_trg_review_rating();
