-- =====================================================================================
-- 002_counters.sql : compteurs denormalises. Une fonction par compteur, SQL explicite (prevoyable, rapide).
-- Coherence : les compteurs sont DERIVES ; baobab_recount_* permet de les reconstruire (voir 005).
-- Risque connu : ligne chaude sur un post viral -> migration prevue vers compteurs Redis + flush (SCALABILITY.md).
-- =====================================================================================

CREATE OR REPLACE FUNCTION baobab_trg_post_reaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE social_post SET reaction_count = reaction_count + 1 WHERE id = NEW.post_id;
    ELSE
        UPDATE social_post SET reaction_count = GREATEST(reaction_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION baobab_trg_comment_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.deleted_at IS NULL THEN
            UPDATE social_post SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
            IF NEW.parent_id IS NOT NULL THEN
                UPDATE social_comment SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN        -- soft delete
            UPDATE social_post SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.post_id;
            IF NEW.parent_id IS NOT NULL THEN
                UPDATE social_comment SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = NEW.parent_id;
            END IF;
        ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN     -- restauration
            UPDATE social_post SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
            IF NEW.parent_id IS NOT NULL THEN
                UPDATE social_comment SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION baobab_trg_comment_reaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE social_comment SET reaction_count = reaction_count + 1 WHERE id = NEW.comment_id;
    ELSE
        UPDATE social_comment SET reaction_count = GREATEST(reaction_count - 1, 0) WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION baobab_trg_share_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE social_post SET share_count = share_count + 1 WHERE id = NEW.post_id;
    ELSE
        UPDATE social_post SET share_count = GREATEST(share_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION baobab_trg_save_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE social_post SET save_count = save_count + 1 WHERE id = NEW.post_id;
    ELSE
        UPDATE social_post SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION baobab_trg_poll_vote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE social_poll_option SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
    ELSE
        UPDATE social_poll_option SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.option_id;
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION baobab_trg_hashtag_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE social_hashtag SET post_count = post_count + 1 WHERE id = NEW.hashtag_id;
    ELSE
        UPDATE social_hashtag SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.hashtag_id;
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION baobab_trg_group_member_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_group SET member_count = member_count + 1 WHERE id = NEW.group_id;
    ELSE
        UPDATE community_group SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
    END IF;
    RETURN NULL;
END $$;
