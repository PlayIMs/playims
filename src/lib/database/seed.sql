-- Safe seed data with INSERT OR IGNORE to prevent duplicate errors

INSERT OR IGNORE INTO clients (id, name, slug, created_at, updated_at, created_user, updated_user, status, metadata)
VALUES ('6eb657af-4ab8-4a13-980a-add993f78d65', 'PlayIMs Admin Test', 'playims-admin', '2025-10-18T18:17:41.000Z', '2025-10-18T18:17:41.000Z', NULL, NULL, 'active', NULL);

INSERT OR IGNORE INTO users (id, client_id, email, email_verified_at, password_hash, sso_user_id, first_name, last_name, avatar_url, created_at, updated_at, created_user, updated_user, first_login_at, last_login_at, status, role, timezone, last_active_at, session_count, preferences, notes)
VALUES ('f5d5c301-9ad3-4cb4-9cfd-a6b78e67734a', '6eb657af-4ab8-4a13-980a-add993f78d65', 'jake@playims.com', NULL, NULL, NULL, 'Jake', 'Harvanchik', NULL, '2025-10-18T18:17:41.000Z', '2025-10-18T18:17:41.000Z', NULL, NULL, NULL, NULL, 'active', 'admin', NULL, NULL, 0, NULL, 'admin test account');

INSERT OR IGNORE INTO users (id, client_id, email, email_verified_at, password_hash, sso_user_id, first_name, last_name, avatar_url, created_at, updated_at, created_user, updated_user, first_login_at, last_login_at, status, role, timezone, last_active_at, session_count, preferences, notes)
VALUES ('a4613d93-f591-4e0b-b9f5-2f43e4e08639', '6eb657af-4ab8-4a13-980a-add993f78d65', 'test@playims.com', NULL, NULL, NULL, 'John', 'Harvanchik', NULL, '2025-10-18T18:17:41.000Z', '2025-10-18T18:17:41.000Z', NULL, NULL, NULL, NULL, 'active', 'player', NULL, NULL, 0, NULL, 'second test account');
