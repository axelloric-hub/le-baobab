-- Annulation de dbobjects 0001 (ordre inverse). Les tables restent (gerees par les migrations des apps).
ALTER TABLE IF EXISTS moderation_restriction DROP CONSTRAINT IF EXISTS excl_restriction_no_overlap;
DROP INDEX IF EXISTS post_fts_idx, audit_log_created_brin, message_created_brin, loginatt_created_brin, loginhist_created_brin;
DROP MATERIALIZED VIEW IF EXISTS mv_trending_hashtags;
DROP MATERIALIZED VIEW IF EXISTS mv_platform_daily;
DROP VIEW IF EXISTS v_moderation_queue, v_group_statistics, v_user_statistics;
DROP TRIGGER IF EXISTS trg_post_reaction_count ON social_post_reaction;
DROP TRIGGER IF EXISTS trg_comment_count ON social_comment;
DROP TRIGGER IF EXISTS trg_comment_reaction_count ON social_comment_reaction;
DROP TRIGGER IF EXISTS trg_share_count ON social_share;
DROP TRIGGER IF EXISTS trg_save_count ON social_save;
DROP TRIGGER IF EXISTS trg_poll_vote_count ON social_poll_vote;
DROP TRIGGER IF EXISTS trg_hashtag_count ON social_post_hashtag;
DROP TRIGGER IF EXISTS trg_group_member_count ON community_group_member;
DROP TRIGGER IF EXISTS trg_message_assign_seq ON messaging_message;
DROP TRIGGER IF EXISTS trg_message_thread_counter ON messaging_message;
DROP TRIGGER IF EXISTS trg_message_immutable_keys ON messaging_message;
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
DROP TRIGGER IF EXISTS trg_admin_action_immutable ON audit_admin_action;
DROP TRIGGER IF EXISTS trg_moderation_action_immutable ON moderation_action;
DROP TRIGGER IF EXISTS trg_audit_user ON accounts_user;
DROP TRIGGER IF EXISTS trg_audit_profile ON profiles_profile;
DROP TRIGGER IF EXISTS trg_audit_privacy ON profiles_privacy;
DROP TRIGGER IF EXISTS trg_audit_group_ban ON community_group_ban;
DROP TRIGGER IF EXISTS trg_audit_group_role ON community_group_role;
DROP TRIGGER IF EXISTS trg_audit_restriction ON moderation_restriction;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT event_object_table AS t FROM information_schema.triggers WHERE trigger_name = 'trg_set_updated_at' AND trigger_schema = current_schema() GROUP BY 1
  LOOP EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I', r.t); END LOOP; END $$;
DROP FUNCTION IF EXISTS baobab_housekeeping(integer), baobab_refresh_daily_metrics(date), baobab_recount_post_counters(uuid),
    baobab_user_stats(uuid), baobab_unread_count(uuid, uuid), baobab_feed_score(double precision, integer, integer, integer, double precision),
    baobab_group_has_permission(uuid, uuid, text), baobab_are_friends(uuid, uuid), baobab_audit_row(), baobab_message_immutable_keys(),
    baobab_message_thread_counter(), baobab_message_assign_seq(), baobab_trg_group_member_count(), baobab_trg_hashtag_count(),
    baobab_trg_poll_vote(), baobab_trg_save_count(), baobab_trg_share_count(), baobab_trg_comment_reaction(), baobab_trg_comment_count(),
    baobab_trg_post_reaction(), baobab_attach_updated_at_triggers(), baobab_forbid_mutation(), baobab_set_updated_at();
