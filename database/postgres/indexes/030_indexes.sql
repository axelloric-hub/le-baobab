-- =====================================================================================
-- 030_indexes.sql : index et contraintes que l'ORM ne sait pas (ou pas bien) exprimer.
-- =====================================================================================

-- Recherche plein texte des publications ('simple' = multilingue fr/en/sw..., sans stemming erronne).
CREATE INDEX IF NOT EXISTS post_fts_idx ON social_post
    USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || body))
    WHERE status = 'published' AND deleted_at IS NULL;

-- BRIN : tables append-only enormes -> index ~1000x plus petit qu'un B-tree pour les plages de dates (stats, retention).
CREATE INDEX IF NOT EXISTS audit_log_created_brin ON audit_log USING brin (created_at) WITH (pages_per_range = 32);
CREATE INDEX IF NOT EXISTS message_created_brin   ON messaging_message USING brin (created_at) WITH (pages_per_range = 32);
CREATE INDEX IF NOT EXISTS loginatt_created_brin  ON accounts_login_attempt USING brin (created_at) WITH (pages_per_range = 32);
CREATE INDEX IF NOT EXISTS loginhist_created_brin ON accounts_login_history USING brin (created_at) WITH (pages_per_range = 32);

-- Contrainte d'EXCLUSION : un utilisateur ne peut avoir qu'une seule suspension/bannissement actif a un instant donne.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'excl_restriction_no_overlap') THEN
        ALTER TABLE moderation_restriction
            ADD CONSTRAINT excl_restriction_no_overlap
            EXCLUDE USING gist (user_id WITH =, tstzrange(starts_at, COALESCE(ends_at, 'infinity'::timestamptz)) WITH &&)
            WHERE (kind IN ('suspension', 'ban') AND revoked_at IS NULL);
    END IF;
END $$;
