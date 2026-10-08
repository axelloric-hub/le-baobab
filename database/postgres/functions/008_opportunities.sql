-- =====================================================================================
-- 008_opportunities.sql : invariants du recrutement et statistiques d'offres.
-- =====================================================================================

-- Une entreprise a TOUJOURS au moins un proprietaire : verifie A LA VALIDATION de la transaction (differe), donc on peut
-- transferer la propriete (ajouter un owner puis retirer l'ancien) dans une meme transaction, mais jamais laisser l'entreprise orpheline.
CREATE OR REPLACE FUNCTION baobab_company_requires_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid uuid;
BEGIN
    -- OLD n'existe pas sur INSERT et NEW n'existe pas sur DELETE : on ne lit que l'enregistrement disponible pour chaque table.
    IF TG_TABLE_NAME = 'companies_member' THEN cid := OLD.company_id; ELSE cid := NEW.id; END IF;
    IF EXISTS (SELECT 1 FROM companies_company WHERE id = cid)
       AND NOT EXISTS (SELECT 1 FROM companies_member WHERE company_id = cid AND role = 'owner') THEN
        RAISE EXCEPTION 'l''entreprise % doit conserver au moins un proprietaire', cid USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END $$;

-- Entonnoir de recrutement d'une offre : nombre de candidatures par statut.
CREATE OR REPLACE FUNCTION baobab_job_funnel(p_job uuid) RETURNS TABLE (status text, applications bigint)
LANGUAGE sql STABLE AS $$
    SELECT s.status, count(a.id)
      FROM (VALUES ('submitted'), ('reviewing'), ('shortlisted'), ('interview'), ('offer'), ('hired'), ('rejected'), ('withdrawn')) AS s(status)
      LEFT JOIN jobs_application a ON a.job_id = p_job AND a.status = s.status
     GROUP BY s.status
     ORDER BY array_position(ARRAY['submitted','reviewing','shortlisted','interview','offer','hired','rejected','withdrawn'], s.status);
$$;
