-- =====================================================================================
-- 001_common.sql : briques generiques. Toutes les fonctions sont CREATE OR REPLACE (rejouables).
-- =====================================================================================

-- updated_at fiable meme pour les UPDATE hors ORM (bulk, SQL brut, scripts d'admin).
CREATE OR REPLACE FUNCTION baobab_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

-- Table append-only : interdit UPDATE/DELETE. Exception unique : mettre a NULL des colonnes FK listees
-- (TG_ARGV) afin que ON DELETE SET NULL (suppression d'un utilisateur) ne soit pas bloque.
CREATE OR REPLACE FUNCTION baobab_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    nullable_cols text[] := TG_ARGV;
BEGIN
    IF TG_OP = 'UPDATE' AND nullable_cols IS NOT NULL AND array_length(nullable_cols, 1) > 0 THEN
        IF (to_jsonb(NEW) - nullable_cols) = (to_jsonb(OLD) - nullable_cols)
           AND NOT EXISTS (SELECT 1 FROM unnest(nullable_cols) c WHERE (to_jsonb(NEW) -> c) <> 'null'::jsonb) THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION '% est en ecriture seule : % interdit', TG_TABLE_NAME, TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;

-- (Re)attache le trigger updated_at a TOUTE table publique possedant une colonne updated_at.
-- A rappeler apres chaque migration qui ajoute une table (idempotent).
CREATE OR REPLACE FUNCTION baobab_attach_updated_at_triggers() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
    t record;
    n integer := 0;
BEGIN
    FOR t IN
        SELECT c.table_name
          FROM information_schema.columns c
          JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
         WHERE c.table_schema = current_schema() AND c.column_name = 'updated_at' AND tb.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I', t.table_name);
        EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION baobab_set_updated_at()', t.table_name);
        n := n + 1;
    END LOOP;
    RETURN n;
END $$;
