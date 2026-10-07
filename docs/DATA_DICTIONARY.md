# DATA_DICTIONARY

> Genere automatiquement par `scripts/gen_data_dictionary.py` depuis les modeles. Ne pas editer a la main.

## accounts

**Source of truth :** PostgreSQL — identite, securite du compte

### `accounts_user` (User)

User(password, last_login, is_superuser, id, email, username, status, email_verified_at, is_staff, date_joined, password_changed_at, suspended_until, suspension_reason, deleted_at, anonymized_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `password` | CharField(128) | non |  |  |
| `last_login` | DateTimeField | oui |  |  |
| `is_superuser` | BooleanField | non |  | False |
| `id` | UUIDField(32) | non | PK | (fonction) |
| `email` | CharField(254) | non | oui |  |
| `username` | CharField(30) | non | oui |  |
| `status` | CharField(12) | non |  | pending |
| `email_verified_at` | DateTimeField | oui |  |  |
| `is_staff` | BooleanField | non |  | False |
| `date_joined` | DateTimeField | non |  | (fonction) |
| `password_changed_at` | DateTimeField | oui |  |  |
| `suspended_until` | DateTimeField | oui |  |  |
| `suspension_reason` | CharField(255) | non |  |  |
| `deleted_at` | DateTimeField | oui |  |  |
| `anonymized_at` | DateTimeField | oui |  |  |
| `groups` | M2M -> auth.Group | - | - | - |
| `user_permissions` | M2M -> auth.Permission | - | - | - |

**Contraintes :** `chk_user_email_lower` ; `chk_user_username_format` ; `chk_user_suspension_documented`

**Index :** `user_nonactive_idx` ; `user_joined_idx`

### `accounts_security_settings` (SecuritySettings)

SecuritySettings(user, two_factor_enabled, login_alerts, active_session_limit, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `user` | FK -> accounts.User | non | PK |  |
| `two_factor_enabled` | BooleanField | non |  | False |
| `login_alerts` | BooleanField | non |  | True |
| `active_session_limit` | PositiveSmallIntegerField | non |  | 10 |
| `updated_at` | DateTimeField | non |  | (fonction) |

### `accounts_device` (Device)

Device(id, user, fingerprint, platform, label, push_token, is_trusted, first_seen_at, last_seen_at, revoked_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `fingerprint` | CharField(128) | non |  |  |
| `platform` | CharField(10) | non |  |  |
| `label` | CharField(100) | non |  |  |
| `push_token` | CharField(512) | non |  |  |
| `is_trusted` | BooleanField | non |  | False |
| `first_seen_at` | DateTimeField | non |  | (fonction) |
| `last_seen_at` | DateTimeField | non |  | (fonction) |
| `revoked_at` | DateTimeField | oui |  |  |

**Contraintes :** `uniq_device_user_fp`

**Index :** `device_pushable_idx`

### `accounts_login_history` (LoginHistory)

Journal des connexions reussies/echouees d'un utilisateur connu. Table append-only,

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `user` | FK -> accounts.User | non |  |  |
| `device` | FK -> accounts.Device | oui |  |  |
| `success` | BooleanField | non |  |  |
| `method` | CharField(20) | non |  | password |
| `ip_address` | GenericIPAddressField(39) | oui |  |  |
| `user_agent` | CharField(400) | non |  |  |
| `country_code` | CharField(2) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `loginhist_user_idx`

### `accounts_login_attempt` (LoginAttempt)

Tentatives par identifiant (meme inconnu) pour detection de brute force. Le comptage temps reel

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `identifier` | CharField(254) | non |  |  |
| `ip_address` | GenericIPAddressField(39) | oui |  |  |
| `success` | BooleanField | non |  | False |
| `reason` | CharField(40) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `loginatt_ident_idx` ; `loginatt_ip_idx`

## profiles

**Source of truth :** PostgreSQL — profil, referentiels, confidentialite

### `profiles_country` (Country)

Country(code, name, region, is_african)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `code` | CharField(2) | non | PK |  |
| `name` | CharField(100) | non |  |  |
| `region` | CharField(40) | non |  |  |
| `is_african` | BooleanField | non |  | False |

### `profiles_skill` (Skill)

Skill(id, slug, name, kind, is_technology, is_active)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `slug` | SlugField(80) | non | oui |  |
| `name` | CharField(80) | non |  |  |
| `kind` | CharField(12) | non |  | tool |
| `is_technology` | BooleanField | non |  | True |
| `is_active` | BooleanField | non |  | True |

**Index :** `skill_name_trgm`

### `profiles_interest` (Interest)

Interest(id, slug, name, is_active)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `slug` | SlugField(80) | non | oui |  |
| `name` | CharField(80) | non |  |  |
| `is_active` | BooleanField | non |  | True |

### `profiles_profession` (Profession)

Profession(id, slug, name)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `slug` | SlugField(80) | non | oui |  |
| `name` | CharField(100) | non |  |  |

### `profiles_profile` (Profile)

1-1 avec User, PK = user_id (pas de jointure d'identifiant supplementaire).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `user` | FK -> accounts.User | non | PK |  |
| `display_name` | CharField(80) | non |  |  |
| `headline` | CharField(160) | non |  |  |
| `bio` | TextField(2000) | non |  |  |
| `avatar_key` | CharField(300) | non |  |  |
| `cover_key` | CharField(300) | non |  |  |
| `country` | FK -> profiles.Country | oui |  |  |
| `region` | CharField(80) | non |  |  |
| `city` | CharField(80) | non |  |  |
| `languages` | ArrayField | non |  | (fonction) |
| `profession` | FK -> profiles.Profession | oui |  |  |
| `availability` | CharField(14) | non |  | none |
| `is_verified` | BooleanField | non |  | False |
| `verified_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_profile_display_name_nonempty` ; `chk_profile_verified_dated`

**Index :** `profile_name_trgm` ; `profile_country_avail_idx` ; `profile_languages_gin`

### `profiles_user_skill` (UserSkill)

UserSkill(id, user, skill, level, years_experience, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `skill` | FK -> profiles.Skill | non |  |  |
| `level` | PositiveSmallIntegerField | non |  | 1 |
| `years_experience` | DecimalField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_userskill` ; `chk_userskill_level` ; `chk_userskill_years`

**Index :** `userskill_skill_level_idx`

### `profiles_user_interest` (UserInterest)

UserInterest(id, user, interest, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `interest` | FK -> profiles.Interest | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_userinterest`

**Index :** `userinterest_interest_idx`

### `profiles_social_link` (SocialLink)

SocialLink(id, user, provider, url, handle, is_verified)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `provider` | CharField(12) | non |  |  |
| `url` | CharField(300) | non |  |  |
| `handle` | CharField(100) | non |  |  |
| `is_verified` | BooleanField | non |  | False |

**Contraintes :** `uniq_sociallink`

**Index :** `sociallink_user_idx`

### `profiles_preferences` (UserPreferences)

UserPreferences(user, language, time_zone, theme, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `user` | FK -> accounts.User | non | PK |  |
| `language` | CharField(8) | non |  | fr |
| `time_zone` | CharField(64) | non |  | Africa/Douala |
| `theme` | CharField(10) | non |  | system |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_pref_theme`

### `profiles_privacy` (PrivacySettings)

Controle de la confidentialite. Lu par TOUTES les verifications de visibilite (cache Redis 10 min).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `user` | FK -> accounts.User | non | PK |  |
| `profile_visibility` | CharField(14) | non |  | public |
| `portfolio_visibility` | CharField(14) | non |  | public |
| `default_post_visibility` | CharField(14) | non |  | public |
| `default_status_visibility` | CharField(14) | non |  | friends |
| `activity_visibility` | CharField(14) | non |  | friends |
| `who_can_message` | CharField(10) | non |  | everyone |
| `who_can_send_friend_request` | CharField(10) | non |  | everyone |
| `show_presence` | BooleanField | non |  | True |
| `show_read_receipts` | BooleanField | non |  | True |
| `searchable` | BooleanField | non |  | True |
| `updated_at` | DateTimeField | non |  | (fonction) |

## friends

**Source of truth :** PostgreSQL — graphe social (amis, abonnements, blocages)

### `friends_friendship` (Friendship)

Friendship(id, user_low, user_high, requested_by, status, responded_at, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user_low` | FK -> accounts.User | non |  |  |
| `user_high` | FK -> accounts.User | non |  |  |
| `requested_by` | FK -> accounts.User | non |  |  |
| `status` | CharField(10) | non |  | pending |
| `responded_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_friendship_ordered` ; `chk_friendship_requester_in_pair` ; `uniq_friendship_pair`

**Index :** `friend_low_acc_idx` ; `friend_high_acc_idx` ; `friend_low_pend_idx` ; `friend_high_pend_idx`

### `friends_follow` (Follow)

Follow(id, follower, followee, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `follower` | FK -> accounts.User | non |  |  |
| `followee` | FK -> accounts.User | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_follow` ; `chk_follow_not_self`

**Index :** `follow_followee_idx`

### `friends_close_friend` (CloseFriend)

CloseFriend(id, owner, friend, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `owner` | FK -> accounts.User | non |  |  |
| `friend` | FK -> accounts.User | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_closefriend` ; `chk_closefriend_not_self`

**Index :** `closefriend_friend_idx`

### `friends_block` (Block)

Block(id, blocker, blocked, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `blocker` | FK -> accounts.User | non |  |  |
| `blocked` | FK -> accounts.User | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_block` ; `chk_block_not_self`

**Index :** `block_blocked_idx`

### `friends_mute` (Mute)

Mute(id, muter, muted, scope, expires_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `muter` | FK -> accounts.User | non |  |  |
| `muted` | FK -> accounts.User | non |  |  |
| `scope` | CharField(14) | non |  | all |
| `expires_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_mute` ; `chk_mute_not_self`

### `friends_restriction` (Restriction)

'Restreindre' : l'autre peut commenter/ecrire mais ses interactions sont masquees (moderation douce).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `restrictor` | FK -> accounts.User | non |  |  |
| `restricted` | FK -> accounts.User | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_restriction` ; `chk_restriction_not_self`

## community

**Source of truth :** PostgreSQL — communautes, groupes, roles, channels

### `community_community` (Community)

Community(id, slug, name, description, privacy, owner, avatar_key, cover_key, country, archived_at, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `slug` | SlugField(80) | non | oui |  |
| `name` | CharField(120) | non |  |  |
| `description` | TextField(3000) | non |  |  |
| `privacy` | CharField(10) | non |  | public |
| `owner` | FK -> accounts.User | non |  |  |
| `avatar_key` | CharField(300) | non |  |  |
| `cover_key` | CharField(300) | non |  |  |
| `country` | FK -> profiles.Country | oui |  |  |
| `archived_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Index :** `community_priv_idx`

### `community_group` (Group)

Group(id, community, slug, name, description, privacy, join_policy, owner, avatar_key, cover_key, member_count, archived_at, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `community` | FK -> community.Community | oui |  |  |
| `slug` | SlugField(80) | non | oui |  |
| `name` | CharField(120) | non |  |  |
| `description` | TextField(3000) | non |  |  |
| `privacy` | CharField(10) | non |  | public |
| `join_policy` | CharField(12) | non |  | open |
| `owner` | FK -> accounts.User | non |  |  |
| `avatar_key` | CharField(300) | non |  |  |
| `cover_key` | CharField(300) | non |  |  |
| `member_count` | PositiveIntegerField | non |  | 0 |
| `archived_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Index :** `group_community_size_idx` ; `group_discover_idx`

### `community_group_permission` (GroupPermission)

Catalogue ferme de permissions (ex: post.create, post.delete_any, member.ban, member.invite, group.edit).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `code` | CharField(60) | non | PK |  |
| `description` | CharField(200) | non |  |  |

### `community_group_role` (GroupRole)

GroupRole(id, group, name, position, is_default, is_owner_role)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `group` | FK -> community.Group | non |  |  |
| `name` | CharField(50) | non |  |  |
| `position` | PositiveSmallIntegerField | non |  | 0 |
| `is_default` | BooleanField | non |  | False |
| `is_owner_role` | BooleanField | non |  | False |
| `permissions` | M2M -> community.GroupPermission | - | - | - |

**Contraintes :** `uniq_grouprole_name` ; `uniq_grouprole_default` ; `uniq_grouprole_owner`

### `community_group_member` (GroupMember)

GroupMember(id, group, user, role, invited_by, joined_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `group` | FK -> community.Group | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `role` | FK -> community.GroupRole | non |  |  |
| `invited_by` | FK -> accounts.User | oui |  |  |
| `joined_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_group_member`

**Index :** `groupmember_user_idx`

### `community_group_invitation` (GroupInvitation)

GroupInvitation(id, group, invited_user, invited_by, status, expires_at, created_at, responded_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `group` | FK -> community.Group | non |  |  |
| `invited_user` | FK -> accounts.User | non |  |  |
| `invited_by` | FK -> accounts.User | non |  |  |
| `status` | CharField(10) | non |  | pending |
| `expires_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `responded_at` | DateTimeField | oui |  |  |

**Contraintes :** `uniq_group_invite_pending`

**Index :** `groupinvite_user_idx`

### `community_group_join_request` (GroupJoinRequest)

GroupJoinRequest(id, group, user, message, status, reviewed_by, reviewed_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `group` | FK -> community.Group | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `message` | CharField(500) | non |  |  |
| `status` | CharField(10) | non |  | pending |
| `reviewed_by` | FK -> accounts.User | oui |  |  |
| `reviewed_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_group_joinreq_pending`

**Index :** `groupjoinreq_group_idx`

### `community_group_ban` (GroupBan)

GroupBan(id, group, user, banned_by, reason, expires_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `group` | FK -> community.Group | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `banned_by` | FK -> accounts.User | oui |  |  |
| `reason` | CharField(500) | non |  |  |
| `expires_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_group_ban`

### `community_group_mute` (GroupMute)

Sourdine de MODERATION : le membre reste dans le groupe mais ne peut plus publier jusqu'a expiration.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `group` | FK -> community.Group | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `muted_by` | FK -> accounts.User | oui |  |  |
| `reason` | CharField(500) | non |  |  |
| `expires_at` | DateTimeField | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_group_mute`

### `community_channel` (Channel)

Channel(id, group, community, classroom_ref, slug, name, topic, type, created_by, archived_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `group` | FK -> community.Group | oui |  |  |
| `community` | FK -> community.Community | oui |  |  |
| `classroom_ref` | UUIDField(32) | oui |  |  |
| `slug` | SlugField(80) | non |  |  |
| `name` | CharField(100) | non |  |  |
| `topic` | CharField(300) | non |  |  |
| `type` | CharField(14) | non |  | discussion |
| `created_by` | FK -> accounts.User | oui |  |  |
| `archived_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_channel_single_parent` ; `uniq_channel_group_slug` ; `uniq_channel_comm_slug`

**Index :** `channel_classroom_idx`

### `community_channel_member` (ChannelMember)

ChannelMember(id, channel, user, role, notifications_muted, joined_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `channel` | FK -> community.Channel | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `role` | CharField(10) | non |  | member |
| `notifications_muted` | BooleanField | non |  | False |
| `joined_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_channel_member`

**Index :** `channelmember_user_idx`

## messaging

**Source of truth :** PostgreSQL — messages (ordre total par `seq`) ; Redis = presence/typing/non-lus chauds seulement

### `messaging_conversation` (Conversation)

Conversation(id, type, title, group, channel, classroom_ref, organization_ref, direct_key, created_by, message_seq, last_message_id, last_message_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `type` | CharField(14) | non |  |  |
| `title` | CharField(150) | non |  |  |
| `group` | FK -> community.Group | oui |  |  |
| `channel` | FK -> community.Channel | oui | oui |  |
| `classroom_ref` | UUIDField(32) | oui |  |  |
| `organization_ref` | UUIDField(32) | oui |  |  |
| `direct_key` | CharField(73) | oui |  |  |
| `created_by` | FK -> accounts.User | oui |  |  |
| `message_seq` | BigIntegerField | non |  | 0 |
| `last_message_id` | UUIDField(32) | oui |  |  |
| `last_message_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_conversation_direct_key` ; `chk_conversation_direct_key`

**Index :** `conversation_last_msg_idx` ; `conversation_group_idx` ; `conversation_classroom_idx`

### `messaging_conversation_member` (ConversationMember)

ConversationMember(id, conversation, user, role, last_delivered_seq, last_read_seq, muted_until, is_archived, joined_at, left_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `conversation` | FK -> messaging.Conversation | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `role` | CharField(8) | non |  | member |
| `last_delivered_seq` | BigIntegerField | non |  | 0 |
| `last_read_seq` | BigIntegerField | non |  | 0 |
| `muted_until` | DateTimeField | oui |  |  |
| `is_archived` | BooleanField | non |  | False |
| `joined_at` | DateTimeField | non |  | (fonction) |
| `left_at` | DateTimeField | oui |  |  |

**Contraintes :** `uniq_conversation_member` ; `chk_convmember_seq_nonneg`

**Index :** `convmember_inbox_idx`

### `messaging_message` (Message)

Message(id, deleted_at, deleted_by, deletion_reason, conversation, sender, seq, kind, body, metadata, reply_to, thread_root, reply_count, last_reply_at, client_msg_id, edited_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `deleted_at` | DateTimeField | oui |  |  |
| `deleted_by` | FK -> accounts.User | oui |  |  |
| `deletion_reason` | CharField(255) | non |  |  |
| `conversation` | FK -> messaging.Conversation | non |  |  |
| `sender` | FK -> accounts.User | oui |  |  |
| `seq` | BigIntegerField | non |  | 0 |
| `kind` | CharField(8) | non |  | text |
| `body` | TextField(10000) | non |  |  |
| `metadata` | JSONField | non |  | (fonction) |
| `reply_to` | FK -> messaging.Message | oui |  |  |
| `thread_root` | FK -> messaging.Message | oui |  |  |
| `reply_count` | PositiveIntegerField | non |  | 0 |
| `last_reply_at` | DateTimeField | oui |  |  |
| `client_msg_id` | UUIDField(32) | oui |  |  |
| `edited_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_message_conv_seq` ; `uniq_message_client_id` ; `chk_message_text_nonempty`

**Index :** `message_thread_idx` ; `message_sender_idx`

### `messaging_attachment` (MessageAttachment)

MessageAttachment(id, message, storage_key, filename, mime_type, size_bytes, width, height, duration_seconds, checksum_sha256, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `message` | FK -> messaging.Message | non |  |  |
| `storage_key` | CharField(400) | non |  |  |
| `filename` | CharField(255) | non |  |  |
| `mime_type` | CharField(120) | non |  |  |
| `size_bytes` | BigIntegerField | non |  |  |
| `width` | PositiveIntegerField | oui |  |  |
| `height` | PositiveIntegerField | oui |  |  |
| `duration_seconds` | PositiveIntegerField | oui |  |  |
| `checksum_sha256` | CharField(64) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_attachment_size`

**Index :** `attachment_message_idx`

### `messaging_reaction` (MessageReaction)

MessageReaction(id, message, user, emoji, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `message` | FK -> messaging.Message | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `emoji` | CharField(32) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_message_reaction`

### `messaging_edit_history` (MessageEditHistory)

MessageEditHistory(id, message, previous_body, edited_by, edited_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `message` | FK -> messaging.Message | non |  |  |
| `previous_body` | TextField | non |  |  |
| `edited_by` | FK -> accounts.User | oui |  |  |
| `edited_at` | DateTimeField | non |  | (fonction) |

**Index :** `msgedit_message_idx`

### `messaging_deletion` (MessageDeletion)

'Supprimer pour moi' : masque le message pour UN utilisateur. (Suppression pour tous = champs

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `message` | FK -> messaging.Message | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `deleted_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_message_hidden`

### `messaging_mention` (Mention)

Mention(id, message, mentioned_user, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `message` | FK -> messaging.Message | non |  |  |
| `mentioned_user` | FK -> accounts.User | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_message_mention`

**Index :** `mention_user_idx`

## social

**Source of truth :** PostgreSQL — posts/commentaires/reactions/statuts ; MongoDB `post_cards` = read-model ; Redis = timeline + vues

### `social_post` (Post)

Post(id, deleted_at, deleted_by, deletion_reason, author, kind, status, title, body, language, visibility, group, community, payload, ref_type, ref_id, reaction_count, comment_count, share_count, save_count, view_count, is_pinned, comments_enabled, published_at, edited_at, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `deleted_at` | DateTimeField | oui |  |  |
| `deleted_by` | FK -> accounts.User | oui |  |  |
| `deletion_reason` | CharField(255) | non |  |  |
| `author` | FK -> accounts.User | non |  |  |
| `kind` | CharField(12) | non |  | text |
| `status` | CharField(14) | non |  | published |
| `title` | CharField(200) | non |  |  |
| `body` | TextField(20000) | non |  |  |
| `language` | CharField(8) | non |  |  |
| `visibility` | CharField(14) | non |  | public |
| `group` | FK -> community.Group | oui |  |  |
| `community` | FK -> community.Community | oui |  |  |
| `payload` | JSONField | non |  | (fonction) |
| `ref_type` | CharField(30) | non |  |  |
| `ref_id` | UUIDField(32) | oui |  |  |
| `reaction_count` | PositiveIntegerField | non |  | 0 |
| `comment_count` | PositiveIntegerField | non |  | 0 |
| `share_count` | PositiveIntegerField | non |  | 0 |
| `save_count` | PositiveIntegerField | non |  | 0 |
| `view_count` | PositiveBigIntegerField | non |  | 0 |
| `is_pinned` | BooleanField | non |  | False |
| `comments_enabled` | BooleanField | non |  | True |
| `published_at` | DateTimeField | non |  | (fonction) |
| `edited_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_post_group_visibility` ; `chk_post_ref_pair` ; `chk_post_text_has_body`

**Index :** `post_author_pub_idx` ; `post_group_pub_idx` ; `post_public_pub_idx` ; `post_kind_pub_idx` ; `post_payload_gin` ; `post_ref_idx`

### `social_post_media` (PostMedia)

PostMedia(id, post, kind, storage_key, mime_type, size_bytes, width, height, duration_seconds, alt_text, position)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `post` | FK -> social.Post | non |  |  |
| `kind` | CharField(10) | non |  |  |
| `storage_key` | CharField(400) | non |  |  |
| `mime_type` | CharField(120) | non |  |  |
| `size_bytes` | BigIntegerField | non |  |  |
| `width` | PositiveIntegerField | oui |  |  |
| `height` | PositiveIntegerField | oui |  |  |
| `duration_seconds` | PositiveIntegerField | oui |  |  |
| `alt_text` | CharField(300) | non |  |  |
| `position` | PositiveSmallIntegerField | non |  | 0 |

**Contraintes :** `uniq_postmedia_position` ; `chk_postmedia_size`

### `social_hashtag` (Hashtag)

Hashtag(id, tag, post_count)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `tag` | CharField(60) | non | oui |  |
| `post_count` | PositiveIntegerField | non |  | 0 |

**Contraintes :** `chk_hashtag_lower`

**Index :** `hashtag_trgm` ; `hashtag_popular_idx`

### `social_post_hashtag` (PostHashtag)

PostHashtag(id, post, hashtag)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `post` | FK -> social.Post | non |  |  |
| `hashtag` | FK -> social.Hashtag | non |  |  |

**Contraintes :** `uniq_post_hashtag`

**Index :** `posthashtag_tag_idx`

### `social_post_mention` (PostMention)

PostMention(id, post, user)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `post` | FK -> social.Post | non |  |  |
| `user` | FK -> accounts.User | non |  |  |

**Contraintes :** `uniq_post_mention`

**Index :** `postmention_user_idx`

### `social_post_audience` (PostAudience)

Audience personnalisee (visibility='custom') : liste blanche d'utilisateurs.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `post` | FK -> social.Post | non |  |  |
| `user` | FK -> accounts.User | non |  |  |

**Contraintes :** `uniq_post_audience`

**Index :** `postaudience_user_idx`

### `social_post_reaction` (PostReaction)

PostReaction(id, post, user, type, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `post` | FK -> social.Post | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `type` | CharField(12) | non |  | like |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_post_reaction`

**Index :** `postreaction_user_idx`

### `social_comment` (Comment)

Comment(id, deleted_at, deleted_by, deletion_reason, post, author, parent, depth, body, reaction_count, reply_count, edited_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `deleted_at` | DateTimeField | oui |  |  |
| `deleted_by` | FK -> accounts.User | oui |  |  |
| `deletion_reason` | CharField(255) | non |  |  |
| `post` | FK -> social.Post | non |  |  |
| `author` | FK -> accounts.User | non |  |  |
| `parent` | FK -> social.Comment | oui |  |  |
| `depth` | PositiveSmallIntegerField | non |  | 0 |
| `body` | TextField(5000) | non |  |  |
| `reaction_count` | PositiveIntegerField | non |  | 0 |
| `reply_count` | PositiveIntegerField | non |  | 0 |
| `edited_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_comment_depth` ; `chk_comment_parent_depth` ; `chk_comment_body`

**Index :** `comment_post_root_idx` ; `comment_replies_idx` ; `comment_author_idx`

### `social_comment_reaction` (CommentReaction)

CommentReaction(id, comment, user, type, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `comment` | FK -> social.Comment | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `type` | CharField(12) | non |  | like |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_comment_reaction`

### `social_share` (Share)

Share(id, user, post, comment, visibility, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `post` | FK -> social.Post | non |  |  |
| `comment` | CharField(1000) | non |  |  |
| `visibility` | CharField(14) | non |  | public |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_share`

**Index :** `share_post_idx`

### `social_save` (Save)

Save(id, user, post, collection, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `user` | FK -> accounts.User | non |  |  |
| `post` | FK -> social.Post | non |  |  |
| `collection` | CharField(60) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_save`

**Index :** `save_user_idx`

### `social_poll` (Poll)

Poll(post, question, allows_multiple, is_anonymous, closes_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `post` | FK -> social.Post | non | PK |  |
| `question` | CharField(300) | non |  |  |
| `allows_multiple` | BooleanField | non |  | False |
| `is_anonymous` | BooleanField | non |  | False |
| `closes_at` | DateTimeField | oui |  |  |

### `social_poll_option` (PollOption)

PollOption(id, poll, label, position, vote_count)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `poll` | FK -> social.Poll | non |  |  |
| `label` | CharField(200) | non |  |  |
| `position` | PositiveSmallIntegerField | non |  | 0 |
| `vote_count` | PositiveIntegerField | non |  | 0 |

**Contraintes :** `uniq_polloption_position`

### `social_poll_vote` (PollVote)

PollVote(id, poll, option, user, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `poll` | FK -> social.Poll | non |  |  |
| `option` | FK -> social.PollOption | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_pollvote_option_user`

**Index :** `pollvote_poll_user_idx`

### `social_post_edit_history` (PostEditHistory)

PostEditHistory(id, post, previous_title, previous_body, previous_payload, edited_by, edited_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `post` | FK -> social.Post | non |  |  |
| `previous_title` | CharField(200) | non |  |  |
| `previous_body` | TextField | non |  |  |
| `previous_payload` | JSONField | non |  | (fonction) |
| `edited_by` | FK -> accounts.User | oui |  |  |
| `edited_at` | DateTimeField | non |  | (fonction) |

**Index :** `postedit_post_idx`

### `social_status` (Status)

Publication ephemere (24 h par defaut). Persistee en PostgreSQL (audience, vues, moderation) ;

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `deleted_at` | DateTimeField | oui |  |  |
| `deleted_by` | FK -> accounts.User | oui |  |  |
| `deletion_reason` | CharField(255) | non |  |  |
| `author` | FK -> accounts.User | non |  |  |
| `kind` | CharField(10) | non |  | text |
| `body` | CharField(700) | non |  |  |
| `storage_key` | CharField(400) | non |  |  |
| `mime_type` | CharField(120) | non |  |  |
| `link_url` | CharField(500) | non |  |  |
| `style` | JSONField | non |  | (fonction) |
| `visibility` | CharField(14) | non |  | friends |
| `expires_at` | DateTimeField | non |  |  |
| `archived_at` | DateTimeField | oui |  |  |
| `view_count` | PositiveIntegerField | non |  | 0 |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_status_expiry` ; `chk_status_no_group_visibility` ; `chk_status_text_body`

**Index :** `status_author_idx` ; `status_expiry_idx`

### `social_status_audience` (StatusAudience)

StatusAudience(id, status, user)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `status` | FK -> social.Status | non |  |  |
| `user` | FK -> accounts.User | non |  |  |

**Contraintes :** `uniq_status_audience`

**Index :** `statusaud_user_idx`

### `social_status_view` (StatusView)

StatusView(id, status, viewer, viewed_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `status` | FK -> social.Status | non |  |  |
| `viewer` | FK -> accounts.User | non |  |  |
| `viewed_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_status_view`

**Index :** `statusview_viewer_idx`

### `social_status_reaction` (StatusReaction)

StatusReaction(id, status, user, emoji, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `status` | FK -> social.Status | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `emoji` | CharField(32) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_status_reaction`

### `social_status_reply` (StatusReply)

Reponse privee a un statut : livree comme message direct a l'auteur (conversation_ref/message_ref).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `status` | FK -> social.Status | non |  |  |
| `author` | FK -> accounts.User | non |  |  |
| `body` | CharField(1000) | non |  |  |
| `message_ref` | UUIDField(32) | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `statusreply_status_idx`

## notifications

**Source of truth :** PostgreSQL — liste, preferences, livraisons ; Redis = compteur non-lus

### `notifications_type` (NotificationType)

NotificationType(code, category, description, default_channels, is_critical, is_active)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `code` | CharField(50) | non | PK |  |
| `category` | CharField(30) | non |  |  |
| `description` | CharField(200) | non |  |  |
| `default_channels` | ArrayField | non |  | (fonction) |
| `is_critical` | BooleanField | non |  | False |
| `is_active` | BooleanField | non |  | True |

### `notifications_template` (NotificationTemplate)

NotificationTemplate(id, type, channel, language, subject, body)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `type` | FK -> notifications.NotificationType | non |  |  |
| `channel` | CharField(10) | non |  |  |
| `language` | CharField(8) | non |  | fr |
| `subject` | CharField(200) | non |  |  |
| `body` | TextField | non |  |  |

**Contraintes :** `uniq_notif_template`

### `notifications_preference` (NotificationPreference)

NotificationPreference(id, user, type, channel, enabled, quiet_hours_start, quiet_hours_end)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `user` | FK -> accounts.User | non |  |  |
| `type` | FK -> notifications.NotificationType | oui |  |  |
| `channel` | CharField(10) | non |  |  |
| `enabled` | BooleanField | non |  | True |
| `quiet_hours_start` | TimeField | oui |  |  |
| `quiet_hours_end` | TimeField | oui |  |  |

**Contraintes :** `uniq_notif_pref`

### `notifications_notification` (Notification)

Notification(id, recipient, type, actor, target_type, target_id, data, dedupe_key, seen_at, read_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `recipient` | FK -> accounts.User | non |  |  |
| `type` | FK -> notifications.NotificationType | non |  |  |
| `actor` | FK -> accounts.User | oui |  |  |
| `target_type` | CharField(40) | non |  |  |
| `target_id` | UUIDField(32) | oui |  |  |
| `data` | JSONField | non |  | (fonction) |
| `dedupe_key` | CharField(120) | non |  |  |
| `seen_at` | DateTimeField | oui |  |  |
| `read_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_notification_dedupe`

**Index :** `notif_inbox_idx` ; `notif_unread_idx`

### `notifications_delivery` (NotificationDelivery)

NotificationDelivery(id, notification, channel, status, attempts, provider_message_id, error, sent_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `notification` | FK -> notifications.Notification | non |  |  |
| `channel` | CharField(10) | non |  |  |
| `status` | CharField(8) | non |  | pending |
| `attempts` | PositiveSmallIntegerField | non |  | 0 |
| `provider_message_id` | CharField(200) | non |  |  |
| `error` | CharField(500) | non |  |  |
| `sent_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_delivery_channel`

**Index :** `delivery_pending_idx`

## audit

**Source of truth :** PostgreSQL — journal inalterable (triggers)

### `audit_log` (AuditLog)

AuditLog(id, actor, actor_label, action, object_type, object_id, old_values, new_values, source, ip_address, user_agent, correlation_id, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `actor` | FK -> accounts.User | oui |  |  |
| `actor_label` | CharField(150) | non |  |  |
| `action` | CharField(60) | non |  |  |
| `object_type` | CharField(80) | non |  |  |
| `object_id` | CharField(64) | non |  |  |
| `old_values` | JSONField | oui |  |  |
| `new_values` | JSONField | oui |  |  |
| `source` | CharField(10) | non |  | app |
| `ip_address` | GenericIPAddressField(39) | oui |  |  |
| `user_agent` | CharField(400) | non |  |  |
| `correlation_id` | CharField(64) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `audit_object_idx` ; `audit_actor_idx` ; `audit_corr_idx`

### `audit_admin_action` (AdminAction)

AdminAction(id, admin, action, target_type, target_id, reason, payload, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `admin` | FK -> accounts.User | oui |  |  |
| `action` | CharField(60) | non |  |  |
| `target_type` | CharField(80) | non |  |  |
| `target_id` | CharField(64) | non |  |  |
| `reason` | CharField(500) | non |  |  |
| `payload` | JSONField | non |  | (fonction) |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `adminaction_admin_idx` ; `adminaction_target_idx`

### `audit_security_event` (SecurityEvent)

SecurityEvent(id, user, event_type, severity, ip_address, data, correlation_id, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `user` | FK -> accounts.User | oui |  |  |
| `event_type` | CharField(60) | non |  |  |
| `severity` | CharField(10) | non |  | info |
| `ip_address` | GenericIPAddressField(39) | oui |  |  |
| `data` | JSONField | non |  | (fonction) |
| `correlation_id` | CharField(64) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `secevent_user_idx` ; `secevent_sev_idx`

### `audit_system_event` (SystemEvent)

SystemEvent(id, level, component, message, data, correlation_id, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `level` | CharField(8) | non |  | info |
| `component` | CharField(60) | non |  |  |
| `message` | CharField(500) | non |  |  |
| `data` | JSONField | non |  | (fonction) |
| `correlation_id` | CharField(64) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `sysevent_component_idx`

## moderation

**Source of truth :** PostgreSQL — signalements, dossiers, sanctions, journal immuable

### `moderation_report_reason` (ReportReason)

ReportReason(code, label, severity, is_active)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `code` | CharField(40) | non | PK |  |
| `label` | CharField(120) | non |  |  |
| `severity` | PositiveSmallIntegerField | non |  | 1 |
| `is_active` | BooleanField | non |  | True |

**Contraintes :** `chk_reason_severity`

### `moderation_case` (ModerationCase)

ModerationCase(id, subject_type, subject_id, subject_user, status, priority, assignee, opened_at, resolved_at, resolution)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `subject_type` | CharField(40) | non |  |  |
| `subject_id` | UUIDField(32) | non |  |  |
| `subject_user` | FK -> accounts.User | oui |  |  |
| `status` | CharField(10) | non |  | open |
| `priority` | PositiveSmallIntegerField | non |  | 1 |
| `assignee` | FK -> accounts.User | oui |  |  |
| `opened_at` | DateTimeField | non |  | (fonction) |
| `resolved_at` | DateTimeField | oui |  |  |
| `resolution` | CharField(500) | non |  |  |

**Contraintes :** `uniq_case_open_subject` ; `chk_case_resolved_dated`

**Index :** `case_queue_idx` ; `case_assignee_idx`

### `moderation_report` (Report)

Report(id, reporter, target_type, target_id, target_user, reason, details, status, case, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `reporter` | FK -> accounts.User | non |  |  |
| `target_type` | CharField(40) | non |  |  |
| `target_id` | UUIDField(32) | non |  |  |
| `target_user` | FK -> accounts.User | oui |  |  |
| `reason` | FK -> moderation.ReportReason | non |  |  |
| `details` | CharField(1000) | non |  |  |
| `status` | CharField(10) | non |  | open |
| `case` | FK -> moderation.ModerationCase | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_report_open_per_reporter`

**Index :** `report_target_idx` ; `report_open_idx`

### `moderation_action` (ModerationAction)

ModerationAction(id, case, moderator, action, target_type, target_id, target_user, reason, expires_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `case` | FK -> moderation.ModerationCase | oui |  |  |
| `moderator` | FK -> accounts.User | oui |  |  |
| `action` | CharField(10) | non |  |  |
| `target_type` | CharField(40) | non |  |  |
| `target_id` | UUIDField(32) | non |  |  |
| `target_user` | FK -> accounts.User | oui |  |  |
| `reason` | CharField(1000) | non |  |  |
| `expires_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `modaction_target_idx` ; `modaction_moderator_idx`

### `moderation_violation` (ContentViolation)

Systeme de strikes : cumul de points => escalade automatique decidee par la politique.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `action` | FK -> moderation.ModerationAction | non |  |  |
| `policy_code` | CharField(40) | non |  |  |
| `points` | PositiveSmallIntegerField | non |  | 1 |
| `created_at` | DateTimeField | non |  | (fonction) |
| `expires_at` | DateTimeField | oui |  |  |

**Index :** `violation_user_idx`

### `moderation_restriction` (UserRestriction)

UserRestriction(id, user, kind, action, reason, starts_at, ends_at, revoked_at, revoked_by)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `kind` | CharField(14) | non |  |  |
| `action` | FK -> moderation.ModerationAction | oui |  |  |
| `reason` | CharField(1000) | non |  |  |
| `starts_at` | DateTimeField | non |  | (fonction) |
| `ends_at` | DateTimeField | oui |  |  |
| `revoked_at` | DateTimeField | oui |  |  |
| `revoked_by` | FK -> accounts.User | oui |  |  |

**Contraintes :** `chk_restriction_period`

**Index :** `restriction_active_idx`

## integrations

**Source of truth :** PostgreSQL — comptes/contenus externes (tokens chiffres)

### `integrations_provider` (ExternalProvider)

ExternalProvider(code, name, supports_oauth, supports_embed, terms_url, max_cache_hours, is_active)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `code` | CharField(20) | non | PK |  |
| `name` | CharField(60) | non |  |  |
| `supports_oauth` | BooleanField | non |  | False |
| `supports_embed` | BooleanField | non |  | False |
| `terms_url` | CharField(200) | non |  |  |
| `max_cache_hours` | PositiveIntegerField | non |  | 24 |
| `is_active` | BooleanField | non |  | True |

### `integrations_account` (ExternalAccount)

Compte tiers lie par OAuth (consentement explicite de l'utilisateur).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `provider` | FK -> integrations.ExternalProvider | non |  |  |
| `external_id` | CharField(100) | non |  |  |
| `handle` | CharField(100) | non |  |  |
| `access_token` | TextField | non |  |  |
| `refresh_token` | TextField | non |  |  |
| `scopes` | ArrayField | non |  | (fonction) |
| `token_expires_at` | DateTimeField | oui |  |  |
| `connected_at` | DateTimeField | non |  | (fonction) |
| `revoked_at` | DateTimeField | oui |  |  |

**Contraintes :** `uniq_extaccount_identity` ; `uniq_extaccount_user_active`

### `integrations_author` (ExternalAuthor)

ExternalAuthor(id, provider, external_id, handle, display_name, avatar_url, profile_url, fetched_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `provider` | FK -> integrations.ExternalProvider | non |  |  |
| `external_id` | CharField(100) | non |  |  |
| `handle` | CharField(100) | non |  |  |
| `display_name` | CharField(150) | non |  |  |
| `avatar_url` | CharField(500) | non |  |  |
| `profile_url` | CharField(500) | non |  |  |
| `fetched_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_extauthor`

### `integrations_content` (ExternalContent)

ExternalContent(id, provider, external_id, kind, author, canonical_url, title, description, thumbnail_url, published_at, metadata, status, fetched_at, expires_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `provider` | FK -> integrations.ExternalProvider | non |  |  |
| `external_id` | CharField(150) | non |  |  |
| `kind` | CharField(12) | non |  |  |
| `author` | FK -> integrations.ExternalAuthor | oui |  |  |
| `canonical_url` | CharField(600) | non |  |  |
| `title` | CharField(300) | non |  |  |
| `description` | TextField | non |  |  |
| `thumbnail_url` | CharField(600) | non |  |  |
| `published_at` | DateTimeField | oui |  |  |
| `metadata` | JSONField | non |  | (fonction) |
| `status` | CharField(12) | non |  | active |
| `fetched_at` | DateTimeField | non |  | (fonction) |
| `expires_at` | DateTimeField | non |  |  |

**Contraintes :** `uniq_extcontent`

**Index :** `extcontent_expiry_idx` ; `extcontent_browse_idx`

### `integrations_video` (ExternalVideo)

ExternalVideo(content, duration_seconds, width, height)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `content` | FK -> integrations.ExternalContent | non | PK |  |
| `duration_seconds` | PositiveIntegerField | oui |  |  |
| `width` | PositiveIntegerField | oui |  |  |
| `height` | PositiveIntegerField | oui |  |  |

### `integrations_embed` (EmbedMetadata)

Donnees d'embed OFFICIEL (oEmbed). `embed_url` est valide contre la liste blanche ; le HTML tiers n'est jamais rendu tel quel.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `content` | FK -> integrations.ExternalContent | non | PK |  |
| `embed_url` | CharField(700) | non |  |  |
| `oembed_version` | CharField(10) | non |  | 1.0 |
| `width` | PositiveIntegerField | oui |  |  |
| `height` | PositiveIntegerField | oui |  |  |

### `integrations_sync_state` (SyncState)

SyncState(id, provider, account, resource, cursor, etag, status, last_synced_at, next_sync_at, last_error, rate_limit_reset_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `provider` | FK -> integrations.ExternalProvider | non |  |  |
| `account` | FK -> integrations.ExternalAccount | oui |  |  |
| `resource` | CharField(40) | non |  |  |
| `cursor` | CharField(300) | non |  |  |
| `etag` | CharField(200) | non |  |  |
| `status` | CharField(8) | non |  | idle |
| `last_synced_at` | DateTimeField | oui |  |  |
| `next_sync_at` | DateTimeField | oui |  |  |
| `last_error` | CharField(500) | non |  |  |
| `rate_limit_reset_at` | DateTimeField | oui |  |  |

**Contraintes :** `uniq_syncstate`

**Index :** `syncstate_due_idx`

## analytics

**Source of truth :** PostgreSQL + MongoDB — catalogue d'evenements + agregats (PG) ; evenements bruts (Mongo `events`)

### `analytics_event_type` (EventType)

EventType(code, domain, description, actor_required, contains_pii, retention_days, is_active)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `code` | CharField(60) | non | PK |  |
| `domain` | CharField(30) | non |  |  |
| `description` | CharField(200) | non |  |  |
| `actor_required` | BooleanField | non |  | True |
| `contains_pii` | BooleanField | non |  | False |
| `retention_days` | PositiveIntegerField | non |  | 400 |
| `is_active` | BooleanField | non |  | True |

### `analytics_daily_metric` (DailyMetric)

DailyMetric(id, day, metric, dimension, value, computed_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `day` | DateField | non |  |  |
| `metric` | CharField(60) | non |  |  |
| `dimension` | CharField(80) | non |  |  |
| `value` | DecimalField | non |  | 0 |
| `computed_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_dailymetric` ; `chk_dailymetric_nonneg`

**Index :** `dailymetric_metric_idx`

## core

**Source of truth :** PostgreSQL — outbox, idempotence

### `core_outbox_event` (OutboxEvent)

Transactional Outbox : l'evenement est ecrit DANS la meme transaction que la donnee metier.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `event_id` | UUIDField(32) | non | oui | (fonction) |
| `event_type` | CharField(100) | non |  |  |
| `aggregate_type` | CharField(60) | non |  |  |
| `aggregate_id` | CharField(64) | non |  |  |
| `payload` | JSONField | non |  | (fonction) |
| `correlation_id` | CharField(64) | non |  |  |
| `status` | CharField(12) | non |  | pending |
| `attempts` | PositiveSmallIntegerField | non |  | 0 |
| `last_error` | TextField | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `available_at` | DateTimeField | non |  | (fonction) |
| `processed_at` | DateTimeField | oui |  |  |

**Index :** `outbox_pending_idx` ; `outbox_aggregate_idx`

### `core_idempotency_record` (IdempotencyRecord)

Etat DEFINITIF d'une operation idempotente (paiement, webhook, commande...).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `scope` | CharField(60) | non |  |  |
| `key` | CharField(200) | non |  |  |
| `request_hash` | CharField(64) | non |  |  |
| `status` | CharField(10) | non |  | started |
| `response_status` | PositiveSmallIntegerField | oui |  |  |
| `response_body` | JSONField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `expires_at` | DateTimeField | non |  |  |

**Contraintes :** `uniq_idem_scope_key`

**Index :** `idem_expires_idx`
