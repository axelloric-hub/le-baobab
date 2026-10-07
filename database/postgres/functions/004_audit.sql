-- =====================================================================================
-- 004_audit.sql : audit au niveau LIGNE, capture meme les modifications hors ORM.
-- Arguments du trigger : TG_ARGV[0] = colonne PK ; TG_ARGV[1..] = colonnes exclues (secrets, bruit).
-- Contexte (acteur/IP/correlation) : set_config('baobab.actor_id'|'baobab.ip'|'baobab.correlation_id', ..., true)
-- depuis apps.audit.services.audit_context(). Absent => acteur NULL (modification systeme).
-- =====================================================================================

CREATE OR REPLACE FUNCTION baobab_audit_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    pk_col   text   := TG_ARGV[0];
    excluded text[] := CASE WHEN TG_NARGS > 1 THEN TG_ARGV[1:TG_NARGS - 1] ELSE ARRAY[]::text[] END;
    old_j    jsonb;
    new_j    jsonb;
    old_diff jsonb;
    new_diff jsonb;
    pk_val   text;
    v_actor  uuid;
    v_label  text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        old_j := to_jsonb(OLD) - excluded;
        pk_val := to_jsonb(OLD) ->> pk_col;
    ELSIF TG_OP = 'INSERT' THEN
        new_j := to_jsonb(NEW) - excluded;
        pk_val := to_jsonb(NEW) ->> pk_col;
    ELSE
        old_j := to_jsonb(OLD) - excluded;
        new_j := to_jsonb(NEW) - excluded;
        pk_val := to_jsonb(NEW) ->> pk_col;
        SELECT jsonb_object_agg(key, value) INTO new_diff FROM jsonb_each(new_j) WHERE old_j -> key IS DISTINCT FROM value;
        IF new_diff IS NULL THEN
            RETURN NULL;                       -- rien d'auditable n'a change
        END IF;
        SELECT jsonb_object_agg(key, value) INTO old_diff FROM jsonb_each(old_j) WHERE new_j -> key IS DISTINCT FROM value;
        old_j := old_diff;
        new_j := new_diff;
    END IF;

    v_actor := NULLIF(current_setting('baobab.actor_id', true), '')::uuid;
    IF v_actor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts_user WHERE id = v_actor) THEN
        v_actor := NULL;
    END IF;
    v_label := CASE WHEN v_actor IS NULL THEN 'system' ELSE (SELECT username FROM accounts_user WHERE id = v_actor) END;

    INSERT INTO audit_log (actor_id, actor_label, action, object_type, object_id, old_values, new_values, source, ip_address, user_agent, correlation_id, created_at)
    VALUES (v_actor, COALESCE(v_label, 'system'), lower(TG_TABLE_NAME) || '.' || lower(TG_OP), TG_TABLE_NAME, pk_val, old_j, new_j, 'trigger',
            NULLIF(current_setting('baobab.ip', true), '')::inet, '', COALESCE(current_setting('baobab.correlation_id', true), ''), now());
    RETURN NULL;
END $$;
