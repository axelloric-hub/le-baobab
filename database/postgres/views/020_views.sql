-- =====================================================================================
-- 020_views.sql : vues (toujours a jour) et vues materialisees (agregats lourds, refresh planifie).
-- Refresh : `manage.py refresh_materialized_views` (REFRESH ... CONCURRENTLY, sans bloquer la lecture).
-- =====================================================================================

CREATE OR REPLACE VIEW v_user_statistics AS
SELECT u.id AS user_id,
       (SELECT count(*) FROM social_post p WHERE p.author_id = u.id AND p.status = 'published' AND p.deleted_at IS NULL) AS post_count,
       (SELECT count(*) FROM friends_follow f WHERE f.followee_id = u.id)  AS follower_count,
       (SELECT count(*) FROM friends_follow f WHERE f.follower_id = u.id)  AS following_count,
       (SELECT count(*) FROM friends_friendship fr WHERE fr.status = 'accepted' AND u.id IN (fr.user_low_id, fr.user_high_id)) AS friend_count,
       (SELECT count(*) FROM community_group_member gm WHERE gm.user_id = u.id) AS group_count
  FROM accounts_user u
 WHERE u.status IN ('active', 'pending');

CREATE OR REPLACE VIEW v_group_statistics AS
SELECT g.id AS group_id, g.name, g.member_count,
       (SELECT count(*) FROM social_post p WHERE p.group_id = g.id AND p.status = 'published' AND p.deleted_at IS NULL AND p.published_at > now() - interval '30 days') AS posts_30d,
       (SELECT count(DISTINCT p.author_id) FROM social_post p WHERE p.group_id = g.id AND p.published_at > now() - interval '30 days') AS active_authors_30d
  FROM community_group g
 WHERE g.archived_at IS NULL;

CREATE OR REPLACE VIEW v_moderation_queue AS
SELECT c.id AS case_id, c.subject_type, c.subject_id, c.subject_user_id, c.status, c.priority, c.assignee_id, c.opened_at,
       (SELECT count(*) FROM moderation_report r WHERE r.case_id = c.id) AS report_count
  FROM moderation_case c
 WHERE c.status IN ('open', 'in_review');

DROP MATERIALIZED VIEW IF EXISTS mv_platform_daily;
CREATE MATERIALIZED VIEW mv_platform_daily AS
SELECT d::date AS day,
       (SELECT count(*) FROM accounts_user    WHERE date_joined >= d AND date_joined < d + interval '1 day') AS new_users,
       (SELECT count(*) FROM social_post      WHERE created_at  >= d AND created_at  < d + interval '1 day') AS posts,
       (SELECT count(*) FROM social_comment   WHERE created_at  >= d AND created_at  < d + interval '1 day') AS comments,
       (SELECT count(*) FROM messaging_message WHERE created_at >= d AND created_at  < d + interval '1 day') AS messages
  FROM generate_series(date_trunc('day', now()) - interval '89 days', date_trunc('day', now()), interval '1 day') AS d;
CREATE UNIQUE INDEX mv_platform_daily_day_uq ON mv_platform_daily (day);

DROP MATERIALIZED VIEW IF EXISTS mv_trending_hashtags;
CREATE MATERIALIZED VIEW mv_trending_hashtags AS
SELECT h.id AS hashtag_id, h.tag, count(*) AS posts_7d, count(DISTINCT p.author_id) AS authors_7d
  FROM social_post_hashtag ph
  JOIN social_hashtag h ON h.id = ph.hashtag_id
  JOIN social_post p ON p.id = ph.post_id
 WHERE p.published_at > now() - interval '7 days' AND p.status = 'published' AND p.deleted_at IS NULL AND p.visibility = 'public'
 GROUP BY h.id, h.tag;
CREATE UNIQUE INDEX mv_trending_hashtags_uq ON mv_trending_hashtags (hashtag_id);
CREATE INDEX mv_trending_hashtags_rank ON mv_trending_hashtags (posts_7d DESC);
