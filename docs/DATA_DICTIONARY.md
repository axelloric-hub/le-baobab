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

## education

**Source of truth :** PostgreSQL — classrooms, cours, modules/chapitres (prix par niveau), blocs de contenu, inscriptions, droits d'acces

### `education_classroom` (Classroom)

Classroom(id, slug, title, description, owner, privacy, is_paid, price_minor, currency, organization_ref, group, archived_at, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `slug` | SlugField(80) | non | oui |  |
| `title` | CharField(160) | non |  |  |
| `description` | TextField(5000) | non |  |  |
| `owner` | FK -> accounts.User | non |  |  |
| `privacy` | CharField(14) | non |  | public |
| `is_paid` | BooleanField | non |  | False |
| `price_minor` | PositiveIntegerField | oui |  |  |
| `currency` | CharField(3) | non |  |  |
| `organization_ref` | UUIDField(32) | oui |  |  |
| `group` | FK -> community.Group | oui |  |  |
| `archived_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_classroom_pricing` ; `chk_classroom_org_ref`

**Index :** `classroom_discover_idx`

### `education_classroom_member` (ClassroomMember)

ClassroomMember(id, classroom, user, role, status, joined_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `classroom` | FK -> education.Classroom | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `role` | CharField(10) | non |  | student |
| `status` | CharField(8) | non |  | active |
| `joined_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_classroom_member`

**Index :** `classmember_user_idx` ; `classmember_pending_idx`

### `education_classroom_invitation` (ClassroomInvitation)

ClassroomInvitation(id, classroom, invited_user, invited_by, role, status, expires_at, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `classroom` | FK -> education.Classroom | non |  |  |
| `invited_user` | FK -> accounts.User | non |  |  |
| `invited_by` | FK -> accounts.User | non |  |  |
| `role` | CharField(10) | non |  | student |
| `status` | CharField(9) | non |  | pending |
| `expires_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_classinvite_pending`

### `education_course` (Course)

Course(id, classroom, slug, title, description, level, language, status, is_free, price_minor, currency, certificate_enabled, published_at, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `classroom` | FK -> education.Classroom | non |  |  |
| `slug` | SlugField(80) | non |  |  |
| `title` | CharField(160) | non |  |  |
| `description` | TextField(10000) | non |  |  |
| `level` | CharField(14) | non |  | beginner |
| `language` | CharField(8) | non |  | fr |
| `status` | CharField(10) | non |  | draft |
| `is_free` | BooleanField | non |  | True |
| `price_minor` | PositiveIntegerField | oui |  |  |
| `currency` | CharField(3) | non |  |  |
| `certificate_enabled` | BooleanField | non |  | True |
| `published_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |
| `skills` | M2M -> profiles.Skill | - | - | - |

**Contraintes :** `uniq_course_slug` ; `chk_course_pricing` ; `chk_course_published_dated`

**Index :** `course_published_idx` ; `course_classroom_idx`

### `education_course_instructor` (CourseInstructor)

CourseInstructor(id, course, user, role)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `course` | FK -> education.Course | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `role` | CharField(10) | non |  | assistant |

**Contraintes :** `uniq_course_instructor`

### `education_module` (Module)

Module(id, course, position, title, description, is_free, price_minor, currency, is_published)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `course` | FK -> education.Course | non |  |  |
| `position` | PositiveSmallIntegerField | non |  |  |
| `title` | CharField(160) | non |  |  |
| `description` | TextField(3000) | non |  |  |
| `is_free` | BooleanField | non |  | True |
| `price_minor` | PositiveIntegerField | oui |  |  |
| `currency` | CharField(3) | non |  |  |
| `is_published` | BooleanField | non |  | False |

**Contraintes :** `uniq_module_position` ; `chk_module_pricing`

### `education_chapter` (Chapter)

Chapter(id, module, position, title, estimated_minutes, is_free, price_minor, currency, is_published)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `module` | FK -> education.Module | non |  |  |
| `position` | PositiveSmallIntegerField | non |  |  |
| `title` | CharField(160) | non |  |  |
| `estimated_minutes` | PositiveSmallIntegerField | non |  | 10 |
| `is_free` | BooleanField | non |  | True |
| `price_minor` | PositiveIntegerField | oui |  |  |
| `currency` | CharField(3) | non |  |  |
| `is_published` | BooleanField | non |  | False |

**Contraintes :** `uniq_chapter_position` ; `chk_chapter_pricing`

### `education_content_block` (ContentBlock)

Bloc de contenu extensible : un chapitre = une suite ordonnee de blocs de types varies.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `chapter` | FK -> education.Chapter | non |  |  |
| `position` | PositiveSmallIntegerField | non |  |  |
| `kind` | CharField(12) | non |  |  |
| `title` | CharField(160) | non |  |  |
| `body` | TextField | non |  |  |
| `storage_key` | CharField(400) | non |  |  |
| `url` | CharField(600) | non |  |  |
| `ref_id` | UUIDField(32) | oui |  |  |
| `payload` | JSONField | non |  | (fonction) |
| `duration_seconds` | PositiveIntegerField | oui |  |  |

**Contraintes :** `uniq_block_position` ; `chk_block_text_body` ; `chk_block_file_source` ; `chk_block_link_https` ; `chk_block_ref`

### `education_enrollment` (Enrollment)

Enrollment(id, course, user, status, enrolled_at, completed_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `course` | FK -> education.Course | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `status` | CharField(10) | non |  | active |
| `enrolled_at` | DateTimeField | non |  | (fonction) |
| `completed_at` | DateTimeField | oui |  |  |

**Contraintes :** `uniq_enrollment` ; `chk_enrollment_completed_dated`

**Index :** `enrollment_user_idx`

### `education_entitlement` (Entitlement)

Droit d'acces accorde (achat, offre, abonnement). `grant_key` rend l'octroi IDEMPOTENT : un webhook de paiement rejoue

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `scope` | CharField(10) | non |  |  |
| `classroom` | FK -> education.Classroom | oui |  |  |
| `course` | FK -> education.Course | oui |  |  |
| `module` | FK -> education.Module | oui |  |  |
| `chapter` | FK -> education.Chapter | oui |  |  |
| `source` | CharField(12) | non |  |  |
| `source_ref` | CharField(100) | non |  |  |
| `grant_key` | CharField(200) | non |  |  |
| `granted_at` | DateTimeField | non |  | (fonction) |
| `expires_at` | DateTimeField | oui |  |  |
| `revoked_at` | DateTimeField | oui |  |  |

**Contraintes :** `chk_entitlement_single_target` ; `uniq_entitlement_grant_key`

**Index :** `entitlement_user_idx` ; `entitlement_chapter_idx` ; `entitlement_module_idx` ; `entitlement_course_idx`

## assessments

**Source of truth :** PostgreSQL — quiz (correction auto), devoirs, groupes, grille de notation, notes

### `assessments_quiz` (Quiz)

Quiz(id, course, chapter, title, pass_percent, max_attempts, time_limit_seconds, is_published, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `course` | FK -> education.Course | non |  |  |
| `chapter` | FK -> education.Chapter | oui |  |  |
| `title` | CharField(160) | non |  |  |
| `pass_percent` | PositiveSmallIntegerField | non |  | 60 |
| `max_attempts` | PositiveSmallIntegerField | non |  | 3 |
| `time_limit_seconds` | PositiveIntegerField | oui |  |  |
| `is_published` | BooleanField | non |  | False |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_quiz_pass_percent`

### `assessments_question` (Question)

Question(id, quiz, position, kind, prompt, points, explanation, answer_key)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `quiz` | FK -> assessments.Quiz | non |  |  |
| `position` | PositiveSmallIntegerField | non |  |  |
| `kind` | CharField(10) | non |  |  |
| `prompt` | TextField | non |  |  |
| `points` | PositiveSmallIntegerField | non |  | 1 |
| `explanation` | TextField | non |  |  |
| `answer_key` | JSONField | non |  | (fonction) |

**Contraintes :** `uniq_question_position` ; `chk_question_points`

### `assessments_choice` (Choice)

Choice(id, question, position, label, is_correct, correct_order)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `question` | FK -> assessments.Question | non |  |  |
| `position` | PositiveSmallIntegerField | non |  |  |
| `label` | CharField(300) | non |  |  |
| `is_correct` | BooleanField | non |  | False |
| `correct_order` | PositiveSmallIntegerField | oui |  |  |

**Contraintes :** `uniq_choice_position`

### `assessments_quiz_attempt` (QuizAttempt)

QuizAttempt(id, quiz, user, attempt_no, status, started_at, submitted_at, score, max_score, passed)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `quiz` | FK -> assessments.Quiz | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `attempt_no` | PositiveSmallIntegerField | non |  |  |
| `status` | CharField(14) | non |  | in_progress |
| `started_at` | DateTimeField | non |  | (fonction) |
| `submitted_at` | DateTimeField | oui |  |  |
| `score` | DecimalField | non |  | 0 |
| `max_score` | DecimalField | non |  | 0 |
| `passed` | BooleanField | non |  | False |

**Contraintes :** `uniq_quiz_attempt` ; `chk_attempt_score_range`

**Index :** `attempt_user_quiz_idx`

### `assessments_attempt_answer` (AttemptAnswer)

AttemptAnswer(id, attempt, question, selected, text, is_correct, points_awarded)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `attempt` | FK -> assessments.QuizAttempt | non |  |  |
| `question` | FK -> assessments.Question | non |  |  |
| `selected` | JSONField | non |  | (fonction) |
| `text` | TextField | non |  |  |
| `is_correct` | BooleanField | oui |  |  |
| `points_awarded` | DecimalField | non |  | 0 |

**Contraintes :** `uniq_attempt_answer`

### `assessments_assignment` (Assignment)

Assignment(id, course, chapter, title, instructions, max_points, due_at, allow_late, max_attempts, is_group, is_published, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `course` | FK -> education.Course | non |  |  |
| `chapter` | FK -> education.Chapter | oui |  |  |
| `title` | CharField(160) | non |  |  |
| `instructions` | TextField | non |  |  |
| `max_points` | PositiveSmallIntegerField | non |  | 20 |
| `due_at` | DateTimeField | oui |  |  |
| `allow_late` | BooleanField | non |  | True |
| `max_attempts` | PositiveSmallIntegerField | non |  | 1 |
| `is_group` | BooleanField | non |  | False |
| `is_published` | BooleanField | non |  | False |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_assignment_points` ; `chk_assignment_attempts`

### `assessments_rubric_criterion` (RubricCriterion)

RubricCriterion(id, assignment, position, label, max_points)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `assignment` | FK -> assessments.Assignment | non |  |  |
| `position` | PositiveSmallIntegerField | non |  |  |
| `label` | CharField(200) | non |  |  |
| `max_points` | PositiveSmallIntegerField | non |  |  |

**Contraintes :** `uniq_criterion_position` ; `chk_criterion_points`

### `assessments_assignment_group` (AssignmentGroup)

AssignmentGroup(id, assignment, name, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `assignment` | FK -> assessments.Assignment | non |  |  |
| `name` | CharField(100) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_agroup_name`

### `assessments_assignment_group_member` (AssignmentGroupMember)

AssignmentGroupMember(id, group, assignment, user)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `group` | FK -> assessments.AssignmentGroup | non |  |  |
| `assignment` | FK -> assessments.Assignment | non |  |  |
| `user` | FK -> accounts.User | non |  |  |

**Contraintes :** `uniq_one_group_per_assignment`

### `assessments_submission` (AssignmentSubmission)

AssignmentSubmission(id, assignment, user, group, submitted_by, attempt_no, status, text, attachments, is_late, submitted_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `assignment` | FK -> assessments.Assignment | non |  |  |
| `user` | FK -> accounts.User | oui |  |  |
| `group` | FK -> assessments.AssignmentGroup | oui |  |  |
| `submitted_by` | FK -> accounts.User | non |  |  |
| `attempt_no` | PositiveSmallIntegerField | non |  | 1 |
| `status` | CharField(10) | non |  | submitted |
| `text` | TextField | non |  |  |
| `attachments` | JSONField | non |  | (fonction) |
| `is_late` | BooleanField | non |  | False |
| `submitted_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_submission_owner` ; `uniq_submission_user_attempt` ; `uniq_submission_group_attempt`

**Index :** `submission_assignment_idx`

### `assessments_grade` (Grade)

Grade(id, submission, grader, points, feedback, graded_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `submission` | FK -> assessments.AssignmentSubmission | non | oui |  |
| `grader` | FK -> accounts.User | oui |  |  |
| `points` | DecimalField | non |  |  |
| `feedback` | TextField | non |  |  |
| `graded_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_grade_points`

### `assessments_grade_criterion` (GradeCriterion)

GradeCriterion(id, grade, criterion, points, comment)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `grade` | FK -> assessments.Grade | non |  |  |
| `criterion` | FK -> assessments.RubricCriterion | non |  |  |
| `points` | DecimalField | non |  |  |
| `comment` | CharField(500) | non |  |  |

**Contraintes :** `uniq_grade_criterion`

### `assessments_feedback` (Feedback)

Fil de commentaires sur un rendu (en plus de la note).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `submission` | FK -> assessments.AssignmentSubmission | non |  |  |
| `author` | FK -> accounts.User | non |  |  |
| `body` | TextField | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `feedback_submission_idx`

## progress

**Source of truth :** PostgreSQL — progression par chapitre (module/cours calcules en SQL), certificats verifiables

### `progress_chapter_progress` (ChapterProgress)

ChapterProgress(id, user, chapter, status, percent, time_spent_seconds, completed_at, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `user` | FK -> accounts.User | non |  |  |
| `chapter` | FK -> education.Chapter | non |  |  |
| `status` | CharField(12) | non |  | in_progress |
| `percent` | PositiveSmallIntegerField | non |  | 0 |
| `time_spent_seconds` | PositiveIntegerField | non |  | 0 |
| `completed_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_chapter_progress` ; `chk_progress_percent` ; `chk_progress_completed`

**Index :** `chprogress_done_idx`

### `progress_certificate_template` (CertificateTemplate)

CertificateTemplate(id, name, body, is_active)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `name` | CharField(100) | non | oui |  |
| `body` | TextField | non |  |  |
| `is_active` | BooleanField | non |  | True |

### `progress_certificate` (Certificate)

Certificate(id, user, course, template, verification_code, score_percent, issued_at, revoked_at, revocation_reason)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `course` | FK -> education.Course | non |  |  |
| `template` | FK -> progress.CertificateTemplate | oui |  |  |
| `verification_code` | CharField(20) | non | oui |  |
| `score_percent` | DecimalField | oui |  |  |
| `issued_at` | DateTimeField | non |  | (fonction) |
| `revoked_at` | DateTimeField | oui |  |  |
| `revocation_reason` | CharField(300) | non |  |  |

**Contraintes :** `uniq_certificate_active`

### `progress_certificate_verification` (CertificateVerification)

Journal des verifications publiques (employeur qui controle un certificat).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `certificate` | FK -> progress.Certificate | non |  |  |
| `verified_at` | DateTimeField | non |  | (fonction) |
| `ip_address` | GenericIPAddressField(39) | oui |  |  |

**Index :** `certverif_cert_idx`

## marketplace

**Source of truth :** PostgreSQL — catalogue, panier, commandes (prix figes), licences, avis

### `marketplace_store` (Store)

Store(id, owner, slug, name, description, status, company_ref, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `owner` | FK -> accounts.User | non |  |  |
| `slug` | SlugField(80) | non | oui |  |
| `name` | CharField(120) | non |  |  |
| `description` | TextField(5000) | non |  |  |
| `status` | CharField(10) | non |  | active |
| `company_ref` | UUIDField(32) | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

### `marketplace_category` (ProductCategory)

ProductCategory(id, slug, name, parent)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `slug` | SlugField(80) | non | oui |  |
| `name` | CharField(100) | non |  |  |
| `parent` | FK -> marketplace.ProductCategory | oui |  |  |

### `marketplace_product` (Product)

Product(id, store, category, kind, slug, title, description, status, license_type, documentation_url, rating_count, rating_sum, published_at, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `store` | FK -> marketplace.Store | non |  |  |
| `category` | FK -> marketplace.ProductCategory | oui |  |  |
| `kind` | CharField(16) | non |  |  |
| `slug` | SlugField(80) | non |  |  |
| `title` | CharField(160) | non |  |  |
| `description` | TextField(20000) | non |  |  |
| `status` | CharField(10) | non |  | draft |
| `license_type` | CharField(10) | non |  | personal |
| `documentation_url` | CharField(200) | non |  |  |
| `rating_count` | PositiveIntegerField | non |  | 0 |
| `rating_sum` | PositiveIntegerField | non |  | 0 |
| `published_at` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |
| `skills` | M2M -> profiles.Skill | - | - | - |

**Contraintes :** `uniq_product_slug` ; `chk_product_published_dated` ; `chk_product_rating_bounds`

**Index :** `product_browse_idx` ; `product_store_idx`

### `marketplace_variant` (ProductVariant)

ProductVariant(id, product, sku, name, price_minor, currency, is_default, is_active, stock)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `product` | FK -> marketplace.Product | non |  |  |
| `sku` | CharField(60) | non | oui |  |
| `name` | CharField(100) | non |  |  |
| `price_minor` | PositiveIntegerField | non |  |  |
| `currency` | CharField(3) | non |  |  |
| `is_default` | BooleanField | non |  | False |
| `is_active` | BooleanField | non |  | True |
| `stock` | IntegerField | oui |  |  |

**Contraintes :** `chk_variant_currency` ; `chk_variant_stock_nonneg` ; `uniq_variant_default`

### `marketplace_product_media` (ProductMedia)

ProductMedia(id, product, kind, storage_key, position)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `product` | FK -> marketplace.Product | non |  |  |
| `kind` | CharField(10) | non |  | image |
| `storage_key` | CharField(400) | non |  |  |
| `position` | PositiveSmallIntegerField | non |  | 0 |

**Contraintes :** `uniq_productmedia_position`

### `marketplace_entitlement_target` (ProductEntitlementTarget)

Ce qu'un achat DEBLOQUE dans un autre domaine (ex. cours/module/chapitre). Reference par id : marketplace ne connait pas education.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `product` | FK -> marketplace.Product | non |  |  |
| `scope` | CharField(10) | non |  |  |
| `target_id` | UUIDField(32) | non |  |  |

**Contraintes :** `uniq_entitlement_target` ; `chk_target_scope`

### `marketplace_release` (ProductRelease)

Version d'une application/logiciel : changelog, prerequis, instructions d'installation.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `product` | FK -> marketplace.Product | non |  |  |
| `version` | CharField(40) | non |  |  |
| `platform` | CharField(20) | non |  | any |
| `changelog` | TextField | non |  |  |
| `requirements` | TextField | non |  |  |
| `installation_instructions` | TextField | non |  |  |
| `is_latest` | BooleanField | non |  | False |
| `published_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_release` ; `uniq_release_latest`

### `marketplace_digital_asset` (DigitalAsset)

DigitalAsset(id, release, filename, storage_key, size_bytes, checksum_sha256)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `release` | FK -> marketplace.ProductRelease | non |  |  |
| `filename` | CharField(255) | non |  |  |
| `storage_key` | CharField(400) | non |  |  |
| `size_bytes` | BigIntegerField | non |  |  |
| `checksum_sha256` | CharField(64) | non |  |  |

**Contraintes :** `chk_asset_size` ; `chk_asset_checksum`

### `marketplace_cart` (Cart)

Cart(id, user, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non | oui |  |
| `updated_at` | DateTimeField | non |  | (fonction) |

### `marketplace_cart_item` (CartItem)

CartItem(id, cart, variant, quantity)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `cart` | FK -> marketplace.Cart | non |  |  |
| `variant` | FK -> marketplace.ProductVariant | non |  |  |
| `quantity` | PositiveSmallIntegerField | non |  | 1 |

**Contraintes :** `uniq_cartitem` ; `chk_cartitem_qty`

### `marketplace_coupon` (Coupon)

Coupon(id, code, kind, value, currency, store, min_subtotal_minor, max_redemptions, per_user_limit, used_count, starts_at, ends_at, is_active)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `code` | CharField(40) | non |  |  |
| `kind` | CharField(8) | non |  |  |
| `value` | PositiveIntegerField | non |  |  |
| `currency` | CharField(3) | non |  |  |
| `store` | FK -> marketplace.Store | oui |  |  |
| `min_subtotal_minor` | PositiveIntegerField | non |  | 0 |
| `max_redemptions` | PositiveIntegerField | oui |  |  |
| `per_user_limit` | PositiveSmallIntegerField | non |  | 1 |
| `used_count` | PositiveIntegerField | non |  | 0 |
| `starts_at` | DateTimeField | non |  | (fonction) |
| `ends_at` | DateTimeField | oui |  |  |
| `is_active` | BooleanField | non |  | True |

**Contraintes :** `uniq_coupon_code_ci` ; `chk_coupon_value` ; `chk_coupon_period` ; `chk_coupon_usage`

### `marketplace_order` (Order)

Order(id, user, number, status, currency, subtotal_minor, discount_minor, total_minor, coupon, idempotency_key, created_at, updated_at, paid_at, cancelled_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `number` | CharField(24) | non | oui |  |
| `status` | CharField(20) | non |  | pending |
| `currency` | CharField(3) | non |  |  |
| `subtotal_minor` | PositiveBigIntegerField | non |  |  |
| `discount_minor` | PositiveBigIntegerField | non |  | 0 |
| `total_minor` | PositiveBigIntegerField | non |  |  |
| `coupon` | FK -> marketplace.Coupon | oui |  |  |
| `idempotency_key` | CharField(100) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |
| `paid_at` | DateTimeField | oui |  |  |
| `cancelled_at` | DateTimeField | oui |  |  |

**Contraintes :** `chk_order_totals` ; `chk_order_paid_dated` ; `uniq_order_idempotency`

**Index :** `order_user_idx` ; `order_pending_idx`

### `marketplace_order_item` (OrderItem)

OrderItem(id, order, product, variant, store, title, sku, unit_price_minor, quantity, line_total_minor, discount_minor, platform_fee_minor, seller_net_minor, refunded_minor)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `order` | FK -> marketplace.Order | non |  |  |
| `product` | FK -> marketplace.Product | non |  |  |
| `variant` | FK -> marketplace.ProductVariant | non |  |  |
| `store` | FK -> marketplace.Store | non |  |  |
| `title` | CharField(160) | non |  |  |
| `sku` | CharField(60) | non |  |  |
| `unit_price_minor` | PositiveIntegerField | non |  |  |
| `quantity` | PositiveSmallIntegerField | non |  |  |
| `line_total_minor` | PositiveBigIntegerField | non |  |  |
| `discount_minor` | PositiveBigIntegerField | non |  | 0 |
| `platform_fee_minor` | PositiveBigIntegerField | non |  | 0 |
| `seller_net_minor` | PositiveBigIntegerField | non |  | 0 |
| `refunded_minor` | PositiveBigIntegerField | non |  | 0 |

**Contraintes :** `chk_item_line_total` ; `chk_item_discount` ; `chk_item_split` ; `chk_item_refund_cap`

**Index :** `orderitem_store_idx` ; `orderitem_product_idx`

### `marketplace_license` (License)

License(id, user, product, order_item, key, seats, status, issued_at, revoked_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `product` | FK -> marketplace.Product | non |  |  |
| `order_item` | FK -> marketplace.OrderItem | non | oui |  |
| `key` | CharField(40) | non | oui |  |
| `seats` | PositiveSmallIntegerField | non |  | 1 |
| `status` | CharField(8) | non |  | active |
| `issued_at` | DateTimeField | non |  | (fonction) |
| `revoked_at` | DateTimeField | oui |  |  |

**Index :** `license_active_idx`

### `marketplace_download` (Download)

Download(id, license, asset, ip_address, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `license` | FK -> marketplace.License | non |  |  |
| `asset` | FK -> marketplace.DigitalAsset | non |  |  |
| `ip_address` | GenericIPAddressField(39) | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `download_license_idx`

### `marketplace_coupon_redemption` (CouponRedemption)

CouponRedemption(id, coupon, user, order, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `coupon` | FK -> marketplace.Coupon | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `order` | FK -> marketplace.Order | non | oui |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `redemption_user_idx`

### `marketplace_review` (Review)

Review(id, product, user, order_item, rating, title, body, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `product` | FK -> marketplace.Product | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `order_item` | FK -> marketplace.OrderItem | non |  |  |
| `rating` | PositiveSmallIntegerField | non |  |  |
| `title` | CharField(120) | non |  |  |
| `body` | TextField(5000) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_review` ; `chk_review_rating`

**Index :** `review_product_idx`

### `marketplace_wishlist` (Wishlist)

Wishlist(id, user, product, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `user` | FK -> accounts.User | non |  |  |
| `product` | FK -> marketplace.Product | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_wishlist`

## payments

**Source of truth :** PostgreSQL — paiements, grand livre equilibre et inalterable, remboursements, webhooks dedoublonnes

### `payments_payment` (Payment)

Payment(id, order, provider, provider_ref, amount_minor, currency, status, failure_reason, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `order` | FK -> marketplace.Order | non |  |  |
| `provider` | CharField(14) | non |  |  |
| `provider_ref` | CharField(120) | non |  |  |
| `amount_minor` | PositiveBigIntegerField | non |  |  |
| `currency` | CharField(3) | non |  |  |
| `status` | CharField(10) | non |  | initiated |
| `failure_reason` | CharField(200) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_payment_amount` ; `uniq_payment_provider_ref` ; `uniq_payment_one_success_per_order`

**Index :** `payment_order_idx`

### `payments_ledger_entry` (LedgerEntry)

Grand livre a ecritures signees : montant > 0 = credit du compte, < 0 = debit. Un lot (batch) somme a zero.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `batch` | UUIDField(32) | non |  | (fonction) |
| `order` | FK -> marketplace.Order | non |  |  |
| `store` | FK -> marketplace.Store | oui |  |  |
| `account` | CharField(8) | non |  |  |
| `kind` | CharField(8) | non |  |  |
| `amount_minor` | BigIntegerField | non |  |  |
| `currency` | CharField(3) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_ledger_nonzero` ; `chk_ledger_seller_store`

**Index :** `ledger_batch_idx` ; `ledger_store_idx` ; `ledger_order_idx`

### `payments_refund` (Refund)

Refund(id, payment, order_item, amount_minor, reason, status, requested_by, decided_by, created_at, decided_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `payment` | FK -> payments.Payment | non |  |  |
| `order_item` | FK -> marketplace.OrderItem | non |  |  |
| `amount_minor` | PositiveBigIntegerField | non |  |  |
| `reason` | CharField(500) | non |  |  |
| `status` | CharField(10) | non |  | requested |
| `requested_by` | FK -> accounts.User | non |  |  |
| `decided_by` | FK -> accounts.User | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `decided_at` | DateTimeField | oui |  |  |

**Contraintes :** `chk_refund_amount` ; `chk_refund_decided_dated` ; `uniq_refund_open_per_item`

### `payments_webhook_event` (WebhookEvent)

WebhookEvent(id, provider, event_id, payload, processed_at, received_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `provider` | CharField(14) | non |  |  |
| `event_id` | CharField(120) | non |  |  |
| `payload` | JSONField | non |  | (fonction) |
| `processed_at` | DateTimeField | oui |  |  |
| `received_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_webhook_event`

## companies

**Source of truth :** PostgreSQL — entreprises, membres et roles, verification

### `companies_company` (Company)

Company(id, slug, name, tagline, description, website, industry, size_range, country, city, logo_key, cover_key, status, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `slug` | SlugField(80) | non | oui |  |
| `name` | CharField(140) | non |  |  |
| `tagline` | CharField(200) | non |  |  |
| `description` | TextField(10000) | non |  |  |
| `website` | CharField(200) | non |  |  |
| `industry` | CharField(80) | non |  |  |
| `size_range` | CharField(12) | non |  |  |
| `country` | FK -> profiles.Country | oui |  |  |
| `city` | CharField(80) | non |  |  |
| `logo_key` | CharField(300) | non |  |  |
| `cover_key` | CharField(300) | non |  |  |
| `status` | CharField(10) | non |  | pending |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_company_size`

**Index :** `company_browse_idx`

### `companies_member` (CompanyMember)

CompanyMember(id, company, user, role, title, is_public, joined_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `company` | FK -> companies.Company | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `role` | CharField(10) | non |  | employee |
| `title` | CharField(100) | non |  |  |
| `is_public` | BooleanField | non |  | True |
| `joined_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_company_member`

**Index :** `companymember_user_idx`

### `companies_verification` (CompanyVerification)

CompanyVerification(id, company, method, evidence, status, submitted_by, reviewed_by, reviewed_at, notes, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `company` | FK -> companies.Company | non |  |  |
| `method` | CharField(14) | non |  |  |
| `evidence` | JSONField | non |  | (fonction) |
| `status` | CharField(10) | non |  | pending |
| `submitted_by` | FK -> accounts.User | non |  |  |
| `reviewed_by` | FK -> accounts.User | oui |  |  |
| `reviewed_at` | DateTimeField | oui |  |  |
| `notes` | CharField(500) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_verification_pending` ; `chk_verification_reviewed`

### `companies_social_link` (CompanySocialLink)

CompanySocialLink(id, company, provider, url)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `company` | FK -> companies.Company | non |  |  |
| `provider` | CharField(12) | non |  |  |
| `url` | CharField(300) | non |  |  |

**Contraintes :** `uniq_company_social` ; `chk_company_social_https`

### `companies_project` (CompanyProject)

CompanyProject(id, company, title, description, url, repo_url, is_public, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `company` | FK -> companies.Company | non |  |  |
| `title` | CharField(160) | non |  |  |
| `description` | TextField(5000) | non |  |  |
| `url` | CharField(200) | non |  |  |
| `repo_url` | CharField(200) | non |  |  |
| `is_public` | BooleanField | non |  | True |
| `created_at` | DateTimeField | non |  | (fonction) |
| `skills` | M2M -> profiles.Skill | - | - | - |

### `companies_service` (CompanyService)

CompanyService(id, company, title, description, starting_price_minor, currency, is_active)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `company` | FK -> companies.Company | non |  |  |
| `title` | CharField(160) | non |  |  |
| `description` | TextField(3000) | non |  |  |
| `starting_price_minor` | PositiveIntegerField | oui |  |  |
| `currency` | CharField(3) | non |  |  |
| `is_active` | BooleanField | non |  | True |

**Contraintes :** `chk_companyservice_currency`

### `companies_product_ref` (CompanyProductRef)

Produit de la marketplace presente sur la page entreprise : REFERENCE par id (pas de FK entre domaines).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `company` | FK -> companies.Company | non |  |  |
| `product_ref` | UUIDField(32) | non |  |  |
| `position` | PositiveSmallIntegerField | non |  | 0 |

**Contraintes :** `uniq_company_productref`

## portfolio

**Source of truth :** PostgreSQL — projets, depots, experiences, formations, certificats affiches

### `portfolio_portfolio` (Portfolio)

Portfolio(user, title, summary, visibility, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `user` | FK -> accounts.User | non | PK |  |
| `title` | CharField(140) | non |  |  |
| `summary` | TextField(3000) | non |  |  |
| `visibility` | CharField(14) | non |  | public |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_portfolio_visibility`

### `portfolio_project` (Project)

Project(id, portfolio, slug, title, description, role, started_on, ended_on, is_featured, position, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `portfolio` | FK -> portfolio.Portfolio | non |  |  |
| `slug` | SlugField(80) | non |  |  |
| `title` | CharField(160) | non |  |  |
| `description` | TextField(10000) | non |  |  |
| `role` | CharField(100) | non |  |  |
| `started_on` | DateField | oui |  |  |
| `ended_on` | DateField | oui |  |  |
| `is_featured` | BooleanField | non |  | False |
| `position` | PositiveSmallIntegerField | non |  | 0 |
| `created_at` | DateTimeField | non |  | (fonction) |
| `technologies` | M2M -> profiles.Skill | - | - | - |

**Contraintes :** `uniq_project_slug` ; `chk_project_dates`

**Index :** `project_order_idx`

### `portfolio_project_media` (ProjectMedia)

ProjectMedia(id, project, kind, storage_key, position)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `project` | FK -> portfolio.Project | non |  |  |
| `kind` | CharField(10) | non |  | image |
| `storage_key` | CharField(400) | non |  |  |
| `position` | PositiveSmallIntegerField | non |  | 0 |

**Contraintes :** `uniq_projectmedia_position`

### `portfolio_project_link` (ProjectLink)

ProjectLink(id, project, kind, provider, url)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `project` | FK -> portfolio.Project | non |  |  |
| `kind` | CharField(12) | non |  | other |
| `provider` | CharField(12) | non |  |  |
| `url` | CharField(400) | non |  |  |

**Contraintes :** `chk_projectlink_https` ; `uniq_projectlink`

### `portfolio_repository` (Repository)

Depot GitHub/GitLab affiche sur le portfolio (donnees issues des API OFFICIELLES via integrations).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `project` | FK -> portfolio.Project | oui |  |  |
| `provider` | CharField(8) | non |  |  |
| `full_name` | CharField(200) | non |  |  |
| `url` | CharField(400) | non |  |  |
| `description` | CharField(500) | non |  |  |
| `language` | CharField(40) | non |  |  |
| `stars` | PositiveIntegerField | non |  | 0 |
| `last_synced_at` | DateTimeField | oui |  |  |

**Contraintes :** `uniq_repository` ; `chk_repository_provider`

### `portfolio_experience` (Experience)

Experience(id, user, company_name, company_ref, title, location, started_on, ended_on, description)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `company_name` | CharField(140) | non |  |  |
| `company_ref` | UUIDField(32) | oui |  |  |
| `title` | CharField(140) | non |  |  |
| `location` | CharField(100) | non |  |  |
| `started_on` | DateField | non |  |  |
| `ended_on` | DateField | oui |  |  |
| `description` | TextField(5000) | non |  |  |

**Contraintes :** `chk_experience_dates`

**Index :** `experience_user_idx`

### `portfolio_education` (Education)

Education(id, user, institution, degree, field, started_on, ended_on)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `institution` | CharField(160) | non |  |  |
| `degree` | CharField(140) | non |  |  |
| `field` | CharField(140) | non |  |  |
| `started_on` | DateField | oui |  |  |
| `ended_on` | DateField | oui |  |  |

**Contraintes :** `chk_education_dates`

### `portfolio_achievement` (Achievement)

Achievement(id, user, title, issuer, achieved_on, url)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `title` | CharField(160) | non |  |  |
| `issuer` | CharField(140) | non |  |  |
| `achieved_on` | DateField | oui |  |  |
| `url` | CharField(200) | non |  |  |

### `portfolio_certificate_entry` (CertificateEntry)

Certificat affiche sur le portfolio. Si `platform_certificate_ref` est renseigne, il est VERIFIABLE (certificat LE BAOBAB).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `user` | FK -> accounts.User | non |  |  |
| `name` | CharField(160) | non |  |  |
| `issuer` | CharField(140) | non |  |  |
| `issued_on` | DateField | oui |  |  |
| `credential_url` | CharField(200) | non |  |  |
| `platform_certificate_ref` | UUIDField(32) | oui |  |  |

## jobs

**Source of truth :** PostgreSQL — offres, candidatures (machine a etats), entretiens, offres d'embauche, freelance, contrats, jalons

### `jobs_category` (JobCategory)

JobCategory(id, slug, name)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `slug` | SlugField(80) | non | oui |  |
| `name` | CharField(100) | non |  |  |

### `jobs_job` (Job)

Job(id, company, posted_by, category, title, description, job_type, contract_type, experience_level, remote_policy, country, city, salary_min_minor, salary_max_minor, salary_currency, salary_period, status, published_at, deadline, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `company` | FK -> companies.Company | oui |  |  |
| `posted_by` | FK -> accounts.User | non |  |  |
| `category` | FK -> jobs.JobCategory | oui |  |  |
| `title` | CharField(160) | non |  |  |
| `description` | TextField(20000) | non |  |  |
| `job_type` | CharField(12) | non |  |  |
| `contract_type` | CharField(12) | non |  |  |
| `experience_level` | CharField(8) | non |  | mid |
| `remote_policy` | CharField(8) | non |  | onsite |
| `country` | FK -> profiles.Country | oui |  |  |
| `city` | CharField(80) | non |  |  |
| `salary_min_minor` | PositiveBigIntegerField | oui |  |  |
| `salary_max_minor` | PositiveBigIntegerField | oui |  |  |
| `salary_currency` | CharField(3) | non |  |  |
| `salary_period` | CharField(6) | non |  |  |
| `status` | CharField(8) | non |  | draft |
| `published_at` | DateTimeField | oui |  |  |
| `deadline` | DateTimeField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |
| `skills` | M2M -> profiles.Skill | - | - | - |

**Contraintes :** `chk_job_salary` ; `chk_job_salary_period` ; `chk_job_open_dated` ; `chk_job_deadline`

**Index :** `job_open_idx` ; `job_filter_idx` ; `job_company_idx`

### `jobs_job_skill` (JobSkill)

JobSkill(id, job, skill, is_required)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `job` | FK -> jobs.Job | non |  |  |
| `skill` | FK -> profiles.Skill | non |  |  |
| `is_required` | BooleanField | non |  | True |

**Contraintes :** `uniq_job_skill`

**Index :** `jobskill_skill_idx`

### `jobs_application` (JobApplication)

JobApplication(id, job, applicant, status, cover_letter, cv_storage_key, portfolio_url, github_url, gitlab_url, links, documents, expected_salary_minor, available_from, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `job` | FK -> jobs.Job | non |  |  |
| `applicant` | FK -> accounts.User | non |  |  |
| `status` | CharField(12) | non |  | submitted |
| `cover_letter` | TextField(10000) | non |  |  |
| `cv_storage_key` | CharField(400) | non |  |  |
| `portfolio_url` | CharField(200) | non |  |  |
| `github_url` | CharField(200) | non |  |  |
| `gitlab_url` | CharField(200) | non |  |  |
| `links` | JSONField | non |  | (fonction) |
| `documents` | JSONField | non |  | (fonction) |
| `expected_salary_minor` | PositiveBigIntegerField | oui |  |  |
| `available_from` | DateField | oui |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |
| `projects` | M2M -> portfolio.Project | - | - | - |

**Contraintes :** `uniq_application`

**Index :** `application_job_idx` ; `application_user_idx`

### `jobs_application_status_event` (ApplicationStatusEvent)

Historique append-only des changements de statut (trigger).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `application` | FK -> jobs.JobApplication | non |  |  |
| `from_status` | CharField(12) | non |  |  |
| `to_status` | CharField(12) | non |  |  |
| `changed_by` | FK -> accounts.User | oui |  |  |
| `note` | CharField(500) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Index :** `appstatus_app_idx`

### `jobs_interview_slot` (InterviewSlot)

Creneau propose par un recruteur. La base INTERDIT deux creneaux qui se chevauchent pour le meme recruteur (exclusion).

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `interviewer` | FK -> accounts.User | non |  |  |
| `job` | FK -> jobs.Job | non |  |  |
| `starts_at` | DateTimeField | non |  |  |
| `ends_at` | DateTimeField | non |  |  |
| `booked_by` | FK -> jobs.JobApplication | oui | oui |  |

**Contraintes :** `chk_slot_period`

**Index :** `slot_free_idx`

### `jobs_interview` (Interview)

Interview(id, application, slot, mode, location, status, feedback, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `application` | FK -> jobs.JobApplication | non |  |  |
| `slot` | FK -> jobs.InterviewSlot | oui | oui |  |
| `mode` | CharField(8) | non |  | video |
| `location` | CharField(300) | non |  |  |
| `status` | CharField(10) | non |  | scheduled |
| `feedback` | TextField(5000) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

### `jobs_offer` (Offer)

Offer(id, application, amount_minor, currency, period, start_date, expires_at, status, created_at, decided_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `application` | FK -> jobs.JobApplication | non |  |  |
| `amount_minor` | PositiveBigIntegerField | non |  |  |
| `currency` | CharField(3) | non |  |  |
| `period` | CharField(6) | non |  | month |
| `start_date` | DateField | oui |  |  |
| `expires_at` | DateTimeField | oui |  |  |
| `status` | CharField(10) | non |  | sent |
| `created_at` | DateTimeField | non |  | (fonction) |
| `decided_at` | DateTimeField | oui |  |  |

**Contraintes :** `chk_offer_amount` ; `uniq_offer_active`

### `jobs_freelancer_profile` (FreelancerProfile)

FreelancerProfile(user, headline, hourly_rate_minor, currency, is_available, languages, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `user` | FK -> accounts.User | non | PK |  |
| `headline` | CharField(160) | non |  |  |
| `hourly_rate_minor` | PositiveIntegerField | oui |  |  |
| `currency` | CharField(3) | non |  |  |
| `is_available` | BooleanField | non |  | True |
| `languages` | CharField(100) | non |  |  |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_freelancer_currency`

**Index :** `freelancer_available_idx`

### `jobs_proposal` (Proposal)

Proposal(id, job, freelancer, cover_letter, bid_minor, currency, delivery_days, status, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `job` | FK -> jobs.Job | non |  |  |
| `freelancer` | FK -> accounts.User | non |  |  |
| `cover_letter` | TextField(10000) | non |  |  |
| `bid_minor` | PositiveBigIntegerField | non |  |  |
| `currency` | CharField(3) | non |  |  |
| `delivery_days` | PositiveSmallIntegerField | non |  |  |
| `status` | CharField(10) | non |  | submitted |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_proposal` ; `uniq_proposal_accepted_per_job` ; `chk_proposal_values`

### `jobs_contract` (Contract)

Contract(id, kind, client, contractor, application, proposal, amount_minor, currency, start_date, end_date, status, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `kind` | CharField(10) | non |  |  |
| `client` | FK -> accounts.User | non |  |  |
| `contractor` | FK -> accounts.User | non |  |  |
| `application` | FK -> jobs.JobApplication | oui | oui |  |
| `proposal` | FK -> jobs.Proposal | oui | oui |  |
| `amount_minor` | PositiveBigIntegerField | non |  |  |
| `currency` | CharField(3) | non |  |  |
| `start_date` | DateField | non |  | (fonction) |
| `end_date` | DateField | oui |  |  |
| `status` | CharField(10) | non |  | active |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_contract_single_source` ; `chk_contract_distinct_parties` ; `chk_contract_dates`

### `jobs_milestone` (Milestone)

Milestone(id, contract, position, title, amount_minor, due_on, status, approved_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `contract` | FK -> jobs.Contract | non |  |  |
| `position` | PositiveSmallIntegerField | non |  |  |
| `title` | CharField(160) | non |  |  |
| `amount_minor` | PositiveBigIntegerField | non |  |  |
| `due_on` | DateField | oui |  |  |
| `status` | CharField(12) | non |  | pending |
| `approved_at` | DateTimeField | oui |  |  |

**Contraintes :** `uniq_milestone_position` ; `chk_milestone_amount` ; `chk_milestone_approved_dated`

## advertising

**Source of truth :** PostgreSQL + Redis + MongoDB — annonceurs, campagnes, ciblage (liste blanche), portefeuille ; evenements bruts en Mongo `ad_events` ; plafonds en Redis

### `advertising_advertiser` (Advertiser)

Advertiser(id, owner, company_ref, name, status, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `owner` | FK -> accounts.User | non |  |  |
| `company_ref` | UUIDField(32) | oui |  |  |
| `name` | CharField(140) | non |  |  |
| `status` | CharField(10) | non |  | active |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_advertiser_name`

### `advertising_account` (AdAccount)

Portefeuille PREPAYE : le solde ne peut JAMAIS etre negatif (CHECK) => aucune depense sans fonds.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `advertiser` | FK -> advertising.Advertiser | non | oui |  |
| `currency` | CharField(3) | non |  |  |
| `balance_minor` | BigIntegerField | non |  | 0 |
| `spend_remainder_micro` | PositiveIntegerField | non |  | 0 |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_adaccount_no_overdraft` ; `chk_adaccount_currency` ; `chk_adaccount_remainder`

### `advertising_account_transaction` (AdAccountTransaction)

Journal du portefeuille (ecriture seule, trigger). `reference` UNIQUE par compte => recharge/reglement idempotents.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `account` | FK -> advertising.AdAccount | non |  |  |
| `kind` | CharField(8) | non |  |  |
| `amount_minor` | BigIntegerField | non |  |  |
| `balance_after_minor` | BigIntegerField | non |  |  |
| `reference` | CharField(120) | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_adtx_reference` ; `chk_adtx_nonzero` ; `chk_adtx_sign`

**Index :** `adtx_account_idx`

### `advertising_audience` (Audience)

Audience(id, advertiser, name, kind, created_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `advertiser` | FK -> advertising.Advertiser | non |  |  |
| `name` | CharField(140) | non |  |  |
| `kind` | CharField(12) | non |  | custom_list |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_audience_name`

### `advertising_audience_membership` (AudienceMembership)

AudienceMembership(id, audience, user, source, added_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `audience` | FK -> advertising.Audience | non |  |  |
| `user` | FK -> accounts.User | non |  |  |
| `source` | CharField(30) | non |  | advertiser_list |
| `added_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_audience_member`

**Index :** `audmember_user_idx`

### `advertising_campaign` (Campaign)

Campaign(id, account, name, objective, status, pause_reason, starts_at, ends_at, daily_budget_minor, total_budget_minor, created_at, updated_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `account` | FK -> advertising.AdAccount | non |  |  |
| `name` | CharField(140) | non |  |  |
| `objective` | CharField(12) | non |  | traffic |
| `status` | CharField(10) | non |  | draft |
| `pause_reason` | CharField(40) | non |  |  |
| `starts_at` | DateTimeField | non |  |  |
| `ends_at` | DateTimeField | oui |  |  |
| `daily_budget_minor` | PositiveBigIntegerField | non |  |  |
| `total_budget_minor` | PositiveBigIntegerField | non |  |  |
| `created_at` | DateTimeField | non |  | (fonction) |
| `updated_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `chk_campaign_budgets` ; `chk_campaign_period`

**Index :** `campaign_active_idx`

### `advertising_adset` (AdSet)

AdSet(id, campaign, name, status, billing_model, bid_minor, placements, frequency_cap_per_day, audience)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `campaign` | FK -> advertising.Campaign | non |  |  |
| `name` | CharField(140) | non |  |  |
| `status` | CharField(8) | non |  | active |
| `billing_model` | CharField(3) | non |  | cpc |
| `bid_minor` | PositiveIntegerField | non |  |  |
| `placements` | ArrayField | non |  | (fonction) |
| `frequency_cap_per_day` | PositiveSmallIntegerField | non |  | 3 |
| `audience` | FK -> advertising.Audience | oui |  |  |

**Contraintes :** `chk_adset_bid` ; `chk_adset_freqcap`

### `advertising_targeting_rule` (TargetingRule)

Une regle = (critere, operateur, valeurs). ET entre regles ; dans une regle : `in` = OU, `all` = ET, `not_in` = NON.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `ad_set` | FK -> advertising.AdSet | non |  |  |
| `field` | CharField(24) | non |  |  |
| `operator` | CharField(6) | non |  | in |
| `values` | JSONField | non |  | (fonction) |
| `required` | BooleanField | non |  | True |
| `weight` | PositiveSmallIntegerField | non |  | 1 |

**Contraintes :** `chk_targeting_field_allowed` ; `chk_targeting_weight`

### `advertising_creative` (Creative)

Creative(id, advertiser, kind, headline, body, media_key, cta_label, destination_url)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `advertiser` | FK -> advertising.Advertiser | non |  |  |
| `kind` | CharField(6) | non |  | text |
| `headline` | CharField(90) | non |  |  |
| `body` | CharField(300) | non |  |  |
| `media_key` | CharField(400) | non |  |  |
| `cta_label` | CharField(30) | non |  |  |
| `destination_url` | CharField(500) | non |  |  |

**Contraintes :** `chk_creative_https` ; `chk_creative_media`

### `advertising_ad` (Advertisement)

Advertisement(id, ad_set, creative, status, review_notes, reviewed_by, reviewed_at)

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | UUIDField(32) | non | PK | (fonction) |
| `ad_set` | FK -> advertising.AdSet | non |  |  |
| `creative` | FK -> advertising.Creative | non |  |  |
| `status` | CharField(14) | non |  | draft |
| `review_notes` | CharField(500) | non |  |  |
| `reviewed_by` | FK -> accounts.User | oui |  |  |
| `reviewed_at` | DateTimeField | oui |  |  |

**Contraintes :** `chk_ad_reviewed`

**Index :** `ad_live_idx`

### `advertising_settlement` (AdSettlement)

REGLEMENT : lot de depenses/statistiques d'UNE annonce pour UN jour, applique UNE seule fois (unique(batch, ad)). Verite financiere.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `id` | BigAutoField | non | PK |  |
| `batch` | UUIDField(32) | non |  |  |
| `ad` | FK -> advertising.Advertisement | non |  |  |
| `day` | DateField | non |  |  |
| `impressions` | PositiveIntegerField | non |  | 0 |
| `clicks` | PositiveIntegerField | non |  | 0 |
| `conversions` | PositiveIntegerField | non |  | 0 |
| `spend_micro` | PositiveBigIntegerField | non |  | 0 |
| `created_at` | DateTimeField | non |  | (fonction) |

**Contraintes :** `uniq_settlement`

**Index :** `settlement_ad_day_idx`

### `advertising_user_preference` (AdUserPreference)

Droit de refuser la publicite PERSONNALISEE : l'utilisateur ne recoit alors que des annonces sans ciblage personnel.

| Champ | Type | Null | Unique | Defaut |
|---|---|---|---|---|
| `user` | FK -> accounts.User | non | PK |  |
| `personalized_ads` | BooleanField | non |  | True |
| `updated_at` | DateTimeField | non |  | (fonction) |

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
