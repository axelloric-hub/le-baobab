-- =====================================================================================
-- 009_advertising.sql : coherence du portefeuille publicitaire et statistiques.
-- =====================================================================================

-- INVARIANT : le solde du portefeuille == somme de son journal. Verifie A LA VALIDATION de la transaction (differe), que la ligne modifiee
-- soit le journal ou le solde : on ne peut pas modifier l'un sans l'autre, meme avec du SQL manuel.
CREATE OR REPLACE FUNCTION baobab_adwallet_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE acc uuid; s bigint; b bigint;
BEGIN
    IF TG_TABLE_NAME = 'advertising_account' THEN acc := NEW.id; ELSE acc := NEW.account_id; END IF;
    SELECT COALESCE(sum(amount_minor), 0) INTO s FROM advertising_account_transaction WHERE account_id = acc;
    SELECT balance_minor INTO b FROM advertising_account WHERE id = acc;
    IF b IS NOT NULL AND s <> b THEN
        RAISE EXCEPTION 'portefeuille % incoherent : solde % <> somme du journal %', acc, b, s USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END $$;

-- Depense reglee d'une campagne, en micro-unites.
CREATE OR REPLACE FUNCTION baobab_campaign_settled_micro(p_campaign uuid) RETURNS bigint
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(sum(s.spend_micro), 0)::bigint
      FROM advertising_settlement s
      JOIN advertising_ad ad ON ad.id = s.ad_id
      JOIN advertising_adset a ON a.id = ad.ad_set_id
     WHERE a.campaign_id = p_campaign;
$$;
