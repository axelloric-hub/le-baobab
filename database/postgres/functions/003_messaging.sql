-- =====================================================================================
-- 003_messaging.sql : numerotation gapless des messages par conversation.
-- UPDATE ... RETURNING pose un verrou de ligne sur la conversation => les INSERT concurrents d'UNE conversation
-- sont serialises (ordre total garanti), ceux de conversations differentes restent paralleles.
-- =====================================================================================

CREATE OR REPLACE FUNCTION baobab_message_assign_seq() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    s bigint;
BEGIN
    UPDATE messaging_conversation
       SET message_seq = message_seq + 1, last_message_at = NEW.created_at, last_message_id = NEW.id
     WHERE id = NEW.conversation_id
    RETURNING message_seq INTO s;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'conversation % introuvable', NEW.conversation_id USING ERRCODE = 'foreign_key_violation';
    END IF;
    NEW.seq := s;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION baobab_message_thread_counter() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.thread_root_id IS NOT NULL THEN
        UPDATE messaging_message SET reply_count = reply_count + 1, last_reply_at = NEW.created_at WHERE id = NEW.thread_root_id;
    END IF;
    RETURN NULL;
END $$;

-- seq et conversation sont immuables apres insertion (l'ordre ne doit jamais changer).
CREATE OR REPLACE FUNCTION baobab_message_immutable_keys() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.seq IS DISTINCT FROM OLD.seq OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
        RAISE EXCEPTION 'seq et conversation_id d''un message sont immuables' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END $$;
