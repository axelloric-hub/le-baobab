-- =====================================================================================
-- 010_attach.sql : declaration de TOUS les triggers (une seule vue d'ensemble). Rejouable (DROP IF EXISTS).
-- Regle : un trigger = une responsabilite, SQL court, aucune logique metier (cf. DATABASE_FUNCTIONS.md).
-- =====================================================================================

-- updated_at generique
SELECT baobab_attach_updated_at_triggers();

-- --- compteurs (AFTER, ligne) -------------------------------------------------------
DROP TRIGGER IF EXISTS trg_post_reaction_count ON social_post_reaction;
CREATE TRIGGER trg_post_reaction_count AFTER INSERT OR DELETE ON social_post_reaction FOR EACH ROW EXECUTE FUNCTION baobab_trg_post_reaction();

DROP TRIGGER IF EXISTS trg_comment_count ON social_comment;
CREATE TRIGGER trg_comment_count AFTER INSERT OR UPDATE OF deleted_at ON social_comment FOR EACH ROW EXECUTE FUNCTION baobab_trg_comment_count();

DROP TRIGGER IF EXISTS trg_comment_reaction_count ON social_comment_reaction;
CREATE TRIGGER trg_comment_reaction_count AFTER INSERT OR DELETE ON social_comment_reaction FOR EACH ROW EXECUTE FUNCTION baobab_trg_comment_reaction();

DROP TRIGGER IF EXISTS trg_share_count ON social_share;
CREATE TRIGGER trg_share_count AFTER INSERT OR DELETE ON social_share FOR EACH ROW EXECUTE FUNCTION baobab_trg_share_count();

DROP TRIGGER IF EXISTS trg_save_count ON social_save;
CREATE TRIGGER trg_save_count AFTER INSERT OR DELETE ON social_save FOR EACH ROW EXECUTE FUNCTION baobab_trg_save_count();

DROP TRIGGER IF EXISTS trg_poll_vote_count ON social_poll_vote;
CREATE TRIGGER trg_poll_vote_count AFTER INSERT OR DELETE ON social_poll_vote FOR EACH ROW EXECUTE FUNCTION baobab_trg_poll_vote();

DROP TRIGGER IF EXISTS trg_hashtag_count ON social_post_hashtag;
CREATE TRIGGER trg_hashtag_count AFTER INSERT OR DELETE ON social_post_hashtag FOR EACH ROW EXECUTE FUNCTION baobab_trg_hashtag_count();

DROP TRIGGER IF EXISTS trg_group_member_count ON community_group_member;
CREATE TRIGGER trg_group_member_count AFTER INSERT OR DELETE ON community_group_member FOR EACH ROW EXECUTE FUNCTION baobab_trg_group_member_count();

-- --- messagerie ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_message_assign_seq ON messaging_message;
CREATE TRIGGER trg_message_assign_seq BEFORE INSERT ON messaging_message FOR EACH ROW EXECUTE FUNCTION baobab_message_assign_seq();

DROP TRIGGER IF EXISTS trg_message_thread_counter ON messaging_message;
CREATE TRIGGER trg_message_thread_counter AFTER INSERT ON messaging_message FOR EACH ROW EXECUTE FUNCTION baobab_message_thread_counter();

DROP TRIGGER IF EXISTS trg_message_immutable_keys ON messaging_message;
CREATE TRIGGER trg_message_immutable_keys BEFORE UPDATE OF seq, conversation_id ON messaging_message FOR EACH ROW EXECUTE FUNCTION baobab_message_immutable_keys();

-- --- tables append-only (audit & moderation) ----------------------------------------
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION baobab_forbid_mutation('actor_id');

DROP TRIGGER IF EXISTS trg_admin_action_immutable ON audit_admin_action;
CREATE TRIGGER trg_admin_action_immutable BEFORE UPDATE OR DELETE ON audit_admin_action FOR EACH ROW EXECUTE FUNCTION baobab_forbid_mutation('admin_id');

DROP TRIGGER IF EXISTS trg_moderation_action_immutable ON moderation_action;
CREATE TRIGGER trg_moderation_action_immutable BEFORE UPDATE OR DELETE ON moderation_action FOR EACH ROW EXECUTE FUNCTION baobab_forbid_mutation('moderator_id', 'target_user_id');

-- --- audit de lignes critiques ------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_user ON accounts_user;
CREATE TRIGGER trg_audit_user AFTER INSERT OR UPDATE OR DELETE ON accounts_user FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id', 'password', 'last_login');

DROP TRIGGER IF EXISTS trg_audit_profile ON profiles_profile;
CREATE TRIGGER trg_audit_profile AFTER UPDATE OR DELETE ON profiles_profile FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('user_id', 'updated_at', 'bio', 'headline');

DROP TRIGGER IF EXISTS trg_audit_privacy ON profiles_privacy;
CREATE TRIGGER trg_audit_privacy AFTER UPDATE ON profiles_privacy FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('user_id', 'updated_at');

DROP TRIGGER IF EXISTS trg_audit_group_ban ON community_group_ban;
CREATE TRIGGER trg_audit_group_ban AFTER INSERT OR UPDATE OR DELETE ON community_group_ban FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');

DROP TRIGGER IF EXISTS trg_audit_group_role ON community_group_role;
CREATE TRIGGER trg_audit_group_role AFTER UPDATE OR DELETE ON community_group_role FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');

DROP TRIGGER IF EXISTS trg_audit_restriction ON moderation_restriction;
CREATE TRIGGER trg_audit_restriction AFTER INSERT OR UPDATE OR DELETE ON moderation_restriction FOR EACH ROW EXECUTE FUNCTION baobab_audit_row('id');
