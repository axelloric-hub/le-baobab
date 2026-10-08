-- =====================================================================================
-- 007_commerce.sql : avis (note moyenne), grand livre equilibre, revenus vendeur.
-- =====================================================================================

-- Note moyenne : compteurs derives maintenus par trigger (insert / update de la note / delete).
CREATE OR REPLACE FUNCTION baobab_trg_review_rating() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE marketplace_product SET rating_count = rating_count + 1, rating_sum = rating_sum + NEW.rating WHERE id = NEW.product_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE marketplace_product SET rating_sum = rating_sum - OLD.rating + NEW.rating WHERE id = NEW.product_id;
    ELSE
        UPDATE marketplace_product SET rating_count = GREATEST(rating_count - 1, 0), rating_sum = GREATEST(rating_sum - OLD.rating, 0) WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END $$;

-- INVARIANT COMPTABLE : tout lot d'ecritures somme a ZERO et ne melange pas les devises. Verifie A LA VALIDATION de la transaction
-- (trigger differe) : une transaction desequilibree ne peut tout simplement pas etre commitee, quel que soit le code applicatif.
CREATE OR REPLACE FUNCTION baobab_ledger_check_batch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s bigint; c integer;
BEGIN
    SELECT COALESCE(sum(amount_minor), 0), count(DISTINCT currency) INTO s, c FROM payments_ledger_entry WHERE batch = NEW.batch;
    IF s <> 0 OR c <> 1 THEN
        RAISE EXCEPTION 'lot comptable % desequilibre (somme=%, devises=%)', NEW.batch, s, c USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END $$;

-- Solde de toutes les ecritures d'une commande : DOIT valoir 0 (charges et remboursements confondus).
CREATE OR REPLACE FUNCTION baobab_order_ledger_balance(p_order uuid) RETURNS bigint
LANGUAGE sql STABLE AS $$ SELECT COALESCE(sum(amount_minor), 0)::bigint FROM payments_ledger_entry WHERE order_id = p_order; $$;

-- Revenus d'une boutique sur une periode, calcules depuis le GRAND LIVRE (la verite), pas depuis des compteurs.
CREATE OR REPLACE FUNCTION baobab_store_revenue(p_store uuid, p_from timestamptz DEFAULT '-infinity', p_to timestamptz DEFAULT 'infinity')
RETURNS TABLE (seller_gross bigint, seller_refunds bigint, seller_net bigint)
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(sum(amount_minor) FILTER (WHERE kind = 'charge'), 0)::bigint,
           COALESCE(-sum(amount_minor) FILTER (WHERE kind = 'refund'), 0)::bigint,
           COALESCE(sum(amount_minor), 0)::bigint
      FROM payments_ledger_entry
     WHERE store_id = p_store AND account = 'seller' AND created_at >= p_from AND created_at < p_to;
$$;
