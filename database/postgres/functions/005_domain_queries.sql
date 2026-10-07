-- =====================================================================================
-- 005_domain_queries.sql : fonctions de lecture/calcul reutilisables (SQL pur, STABLE/IMMUTABLE).
-- Elles NE REMPLACENT PAS la logique metier des services : elles servent aux requetes SQL, vues, jobs et au futur AI Gateway
-- (acces en lecture seule via fonctions plutot que via les tables).
-- =====================================================================================

CREATE OR REPLACE FUNCTION baobab_are_friends(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM friends_friendship
         WHERE user_low_id = LEAST(a, b) AND user_high_id = GREATEST(a, b) AND status = 'accepted');
$$;

CREATE OR REPLACE FUNCTION baobab_group_has_permission(p_user uuid, p_group uuid, p_code text) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1
          FROM community_group_member m
          JOIN community_group_role_permission rp ON rp.grouprole_id = m.role_id
         WHERE m.user_id = p_user AND m.group_id = p_group AND rp.grouppermission_id = p_code);
$$;

-- Meme formule que apps.social.feed.rank_score (test de parite dans tests/).
CREATE OR REPLACE FUNCTION baobab_feed_score(age_hours double precision, reactions integer, comments integer, shares integer, affinity double precision DEFAULT 0)
RETURNS double precision LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT (1.0 + ln(1 + GREATEST(reactions, 0) + 3 * GREATEST(comments, 0) + 5 * GREATEST(shares, 0)))
           * power(0.5, GREATEST(age_hours, 0) / 24.0)
           * (1.0 + GREATEST(affinity, 0));
$$;

CREATE OR REPLACE FUNCTION baobab_unread_count(p_conversation uuid, p_user uuid) RETURNS bigint
LANGUAGE sql STABLE AS $$
    SELECT GREATEST(c.message_seq - m.last_read_seq, 0)
      FROM messaging_conversation c
      JOIN messaging_conversation_member m ON m.conversation_id = c.id
     WHERE c.id = p_conversation AND m.user_id = p_user AND m.left_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION baobab_user_stats(p_user uuid)
RETURNS TABLE (post_count bigint, follower_count bigint, following_count bigint, friend_count bigint, group_count bigint)
LANGUAGE sql STABLE AS $$
    SELECT
        (SELECT count(*) FROM social_post WHERE author_id = p_user AND status = 'published' AND deleted_at IS NULL),
        (SELECT count(*) FROM friends_follow WHERE followee_id = p_user),
        (SELECT count(*) FROM friends_follow WHERE follower_id = p_user),
        (SELECT count(*) FROM friends_friendship WHERE status = 'accepted' AND p_user IN (user_low_id, user_high_id)),
        (SELECT count(*) FROM community_group_member WHERE user_id = p_user);
$$;

-- Reconstruction des compteurs denormalises (apres incident, restauration partielle, import).
CREATE OR REPLACE FUNCTION baobab_recount_post_counters(p_post uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
    UPDATE social_post p SET
        reaction_count = (SELECT count(*) FROM social_post_reaction r WHERE r.post_id = p.id),
        comment_count  = (SELECT count(*) FROM social_comment c WHERE c.post_id = p.id AND c.deleted_at IS NULL),
        share_count    = (SELECT count(*) FROM social_share s WHERE s.post_id = p.id),
        save_count     = (SELECT count(*) FROM social_save v WHERE v.post_id = p.id)
    WHERE p_post IS NULL OR p.id = p_post;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END $$;

-- Agregats quotidiens (idempotent : UPSERT). Appele par `manage.py refresh_metrics` (cron).
CREATE OR REPLACE FUNCTION baobab_refresh_daily_metrics(p_day date) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
    d0 timestamptz := p_day::timestamptz;
    d1 timestamptz := (p_day + 1)::timestamptz;
    n integer := 0;
BEGIN
    INSERT INTO analytics_daily_metric (day, metric, dimension, value, computed_at)
    SELECT p_day, m.metric, '', m.value, now() FROM (
        SELECT 'new_users'     AS metric, (SELECT count(*) FROM accounts_user WHERE date_joined >= d0 AND date_joined < d1)::numeric AS value
        UNION ALL SELECT 'posts',     (SELECT count(*) FROM social_post WHERE created_at >= d0 AND created_at < d1)
        UNION ALL SELECT 'comments',  (SELECT count(*) FROM social_comment WHERE created_at >= d0 AND created_at < d1)
        UNION ALL SELECT 'messages',  (SELECT count(*) FROM messaging_message WHERE created_at >= d0 AND created_at < d1)
        UNION ALL SELECT 'groups_created', (SELECT count(*) FROM community_group WHERE created_at >= d0 AND created_at < d1)
        UNION ALL SELECT 'friendships', (SELECT count(*) FROM friends_friendship WHERE status = 'accepted' AND responded_at >= d0 AND responded_at < d1)
        UNION ALL SELECT 'active_posters', (SELECT count(DISTINCT author_id) FROM social_post WHERE created_at >= d0 AND created_at < d1)
        UNION ALL SELECT 'active_messagers', (SELECT count(DISTINCT sender_id) FROM messaging_message WHERE created_at >= d0 AND created_at < d1)
    ) m
    ON CONFLICT (day, metric, dimension) DO UPDATE SET value = EXCLUDED.value, computed_at = EXCLUDED.computed_at;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END $$;

-- Maintenance : purge bornee (par lots) des donnees techniques expirees.
CREATE OR REPLACE FUNCTION baobab_housekeeping(p_batch integer DEFAULT 5000) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    idem integer; outb integer; login integer;
BEGIN
    WITH d AS (SELECT id FROM core_idempotency_record WHERE expires_at < now() LIMIT p_batch)
    DELETE FROM core_idempotency_record WHERE id IN (SELECT id FROM d);
    GET DIAGNOSTICS idem = ROW_COUNT;

    WITH d AS (SELECT id FROM core_outbox_event WHERE status = 'processed' AND processed_at < now() - interval '7 days' LIMIT p_batch)
    DELETE FROM core_outbox_event WHERE id IN (SELECT id FROM d);
    GET DIAGNOSTICS outb = ROW_COUNT;

    WITH d AS (SELECT id FROM accounts_login_attempt WHERE created_at < now() - interval '90 days' LIMIT p_batch)
    DELETE FROM accounts_login_attempt WHERE id IN (SELECT id FROM d);
    GET DIAGNOSTICS login = ROW_COUNT;

    RETURN jsonb_build_object('idempotency_records', idem, 'outbox_events', outb, 'login_attempts', login);
END $$;
