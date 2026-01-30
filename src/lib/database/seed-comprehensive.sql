-- Comprehensive Seed Data for PlayIMs Development
-- Matches schema files exactly

-- ============================================
-- SPORTS
-- ============================================
INSERT OR IGNORE INTO sports (id, client_id, name, slug, description, type, sport, min_players, max_players, is_active, created_at, updated_at, created_user, updated_user)
VALUES 
('sport-001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Basketball', 'basketball', 'Indoor 5v5 basketball', 'indoor', 'basketball', 5, 12, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('sport-002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Flag Football', 'flag-football', 'Non-contact outdoor football', 'outdoor', 'flag-football', 7, 15, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('sport-003', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Soccer', 'soccer', 'Indoor and outdoor soccer', 'both', 'soccer', 11, 18, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('sport-004', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Volleyball', 'volleyball', 'Indoor volleyball', 'indoor', 'volleyball', 6, 12, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('sport-005', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Ultimate Frisbee', 'ultimate-frisbee', 'Non-contact flying disc sport', 'outdoor', 'ultimate', 7, 14, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL);

-- ============================================
-- LEAGUES
-- ============================================
INSERT OR IGNORE INTO leagues (id, client_id, sport_id, name, slug, description, year, season, gender, skill_level, reg_start_date, reg_end_date, season_start_date, season_end_date, is_active, created_at, updated_at, created_user, updated_user)
VALUES
('league-001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'sport-001', 'Winter Basketball League', 'winter-basketball-2025', 'Competitive winter basketball league', 2025, 'Winter', 'mens', 'competitive', '2024-12-01T00:00:00.000Z', '2025-01-10T23:59:59.000Z', '2025-01-15T00:00:00.000Z', '2025-03-15T23:59:59.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('league-002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'sport-001', 'Spring Basketball League', 'spring-basketball-2025', 'Recreational spring basketball', 2025, 'Spring', 'coed', 'recreational', '2025-02-15T00:00:00.000Z', '2025-03-20T23:59:59.000Z', '2025-03-25T00:00:00.000Z', '2025-05-30T23:59:59.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('league-003', '6eb657af-4ab8-4a13-980a-add993f78d65', 'sport-002', 'Spring Flag Football', 'spring-flag-football-2025', 'Outdoor flag football league', 2025, 'Spring', 'open', 'all', '2025-02-01T00:00:00.000Z', '2025-03-15T23:59:59.000Z', '2025-03-20T00:00:00.000Z', '2025-05-25T23:59:59.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('league-004', '6eb657af-4ab8-4a13-980a-add993f78d65', 'sport-003', 'Indoor Soccer Winter', 'indoor-soccer-winter-2025', 'Indoor soccer league', 2025, 'Winter', 'mens', 'competitive', '2024-12-01T00:00:00.000Z', '2025-01-05T23:59:59.000Z', '2025-01-12T00:00:00.000Z', '2025-03-20T23:59:59.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('league-005', '6eb657af-4ab8-4a13-980a-add993f78d65', 'sport-004', 'Volleyball Co-Rec', 'volleyball-corec-2025', 'Co-ed recreational volleyball', 2025, 'Spring', 'coed', 'recreational', '2025-02-10T00:00:00.000Z', '2025-03-25T23:59:59.000Z', '2025-04-01T00:00:00.000Z', '2025-06-15T23:59:59.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL);

-- ============================================
-- DIVISIONS (NO client_id field!)
-- ============================================
INSERT OR IGNORE INTO divisions (id, league_id, name, slug, description, day_of_week, game_time, max_teams, location, is_active, teams_count, start_date, created_at, updated_at, created_user, updated_user)
VALUES
('div-001', 'league-001', 'Men''s Competitive', 'mens-competitive', 'Top tier mens division', 'Tuesday', '19:00', 12, 'Main Gym', 1, 6, '2025-01-15T00:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('div-002', 'league-001', 'Women''s Competitive', 'womens-competitive', 'Top tier womens division', 'Thursday', '19:00', 12, 'Main Gym', 1, 4, '2025-01-15T00:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('div-003', 'league-001', 'Co-Rec Recreational', 'corec-rec', 'Casual co-ed play', 'Monday', '18:00', 10, 'Aux Gym', 1, 0, '2025-01-15T00:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('div-004', 'league-003', 'Open Division', 'open-division', 'All skill levels welcome', 'Saturday', '10:00', 20, 'North Fields', 1, 4, '2025-03-20T00:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('div-005', 'league-004', 'Men''s Indoor', 'mens-indoor', 'Indoor soccer mens division', 'Wednesday', '20:00', 8, 'Indoor Arena', 1, 4, '2025-01-12T00:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('div-006', 'league-004', 'Women''s Indoor', 'womens-indoor', 'Indoor soccer womens division', 'Friday', '19:00', 8, 'Indoor Arena', 1, 0, '2025-01-12T00:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL);

-- ============================================
-- FACILITIES
-- ============================================
INSERT OR IGNORE INTO facilities (id, client_id, name, slug, address_line1, city, state, postal_code, country, timezone, description, metadata, is_active, created_at, updated_at, created_user, updated_user)
VALUES
('fac-001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Campus Recreation Center', 'campus-rec-center', '123 University Ave', 'College Town', 'TX', '77840', 'USA', 'America/Chicago', 'Main recreation facility with multiple courts and fields', NULL, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('fac-002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'North Fields Complex', 'north-fields', '456 North Campus Dr', 'College Town', 'TX', '77840', 'USA', 'America/Chicago', 'Outdoor fields for soccer, football, and ultimate', NULL, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('fac-003', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Indoor Sports Arena', 'indoor-arena', '789 Athletic Blvd', 'College Town', 'TX', '77840', 'USA', 'America/Chicago', 'Large indoor facility for basketball and volleyball', NULL, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL);

-- Facility Areas (has slug, description, metadata - NOT code, surface_type, is_indoor)
INSERT OR IGNORE INTO facility_areas (id, client_id, facility_id, name, slug, description, metadata, is_active, created_at, updated_at, created_user, updated_user)
VALUES
('area-001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'fac-001', 'Court 1', 'court-1', 'Full size basketball court', '{"capacity": 200}', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('area-002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'fac-001', 'Court 2', 'court-2', 'Full size basketball court', '{"capacity": 200}', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('area-003', '6eb657af-4ab8-4a13-980a-add993f78d65', 'fac-001', 'Volleyball Court A', 'volleyball-court-a', 'Regulation volleyball court', '{"capacity": 150}', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('area-004', '6eb657af-4ab8-4a13-980a-add993f78d65', 'fac-002', 'Field 1', 'field-1', 'Full size soccer field', '{"capacity": 500}', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('area-005', '6eb657af-4ab8-4a13-980a-add993f78d65', 'fac-002', 'Field 2', 'field-2', 'Full size soccer field', '{"capacity": 500}', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('area-006', '6eb657af-4ab8-4a13-980a-add993f78d65', 'fac-002', 'Field 3', 'field-3', 'Flag football field', '{"capacity": 400}', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('area-007', '6eb657af-4ab8-4a13-980a-add993f78d65', 'fac-003', 'Main Court', 'main-court', 'Large multi-purpose court', '{"capacity": 1000}', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('area-008', '6eb657af-4ab8-4a13-980a-add993f78d65', 'fac-003', 'Auxiliary Court', 'aux-court', 'Secondary practice court', '{"capacity": 300}', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL);

-- ============================================
-- TEAMS
-- ============================================
INSERT OR IGNORE INTO teams (id, client_id, division_id, name, slug, description, team_status, does_accept_free_agents, is_auto_accept_members, current_roster_size, team_color, date_registered, is_active, created_at, updated_at, created_user, updated_user)
VALUES
-- Basketball Men's Teams
('team-001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-001', 'Thunder Hawks', 'thunder-hawks', 'Competitive mens basketball team', 'active', 1, 0, 8, '#1e40af', '2025-01-10T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-001', 'Lightning Bolts', 'lightning-bolts', 'Fast-paced team with strong offense', 'active', 1, 0, 7, '#dc2626', '2025-01-10T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-003', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-001', 'Alpha Squad', 'alpha-squad', 'Veteran players with championship experience', 'active', 1, 0, 9, '#7c3aed', '2025-01-11T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-004', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-001', 'Beta Blockers', 'beta-blockers', 'Defense-focused team', 'active', 1, 0, 8, '#059669', '2025-01-12T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-005', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-001', 'Storm Chasers', 'storm-chasers', 'Up and coming team', 'active', 1, 0, 6, '#7c2d12', '2025-01-12T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-006', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-001', 'Night Owls', 'night-owls', 'Late practice squad', 'active', 1, 0, 8, '#1e293b', '2025-01-13T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
-- Basketball Women's Teams
('team-007', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-002', 'Firebirds', 'firebirds', 'Top-ranked womens team', 'active', 1, 0, 9, '#dc2626', '2025-01-10T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-008', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-002', 'Phoenix Rising', 'phoenix-rising', 'Competitive team with new recruits', 'active', 1, 0, 8, '#ea580c', '2025-01-11T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-009', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-002', 'Valkyries', 'valkyries', 'All-female powerhouse', 'active', 1, 0, 7, '#4338ca', '2025-01-12T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-010', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-002', 'Warriors', 'warriors', 'Hardworking team', 'active', 1, 0, 8, '#166534', '2025-01-13T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
-- Flag Football Teams
('team-011', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-004', 'Gridiron Gang', 'gridiron-gang', 'Football enthusiasts', 'active', 1, 0, 10, '#1e40af', '2025-01-15T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-012', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-004', 'End Zone Elite', 'end-zone-elite', 'Championship contenders', 'active', 1, 0, 11, '#dc2626', '2025-01-15T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-013', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-004', 'Touchdown Titans', 'touchdown-titans', 'Strong offensive lineup', 'active', 1, 0, 9, '#059669', '2025-01-16T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-014', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-004', 'Blitz Brigade', 'blitz-brigade', 'Aggressive defense', 'active', 1, 0, 10, '#7c3aed', '2025-01-16T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
-- Soccer Teams
('team-015', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-005', 'Strikers FC', 'strikers-fc', 'Offensive powerhouse', 'active', 1, 0, 14, '#dc2626', '2025-01-08T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-016', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-005', 'Defenders United', 'defenders-united', 'Solid defensive squad', 'active', 1, 0, 13, '#1e40af', '2025-01-09T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-017', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-005', 'Midfield Masters', 'midfield-masters', 'Ball control specialists', 'active', 1, 0, 12, '#059669', '2025-01-10T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('team-018', '6eb657af-4ab8-4a13-980a-add993f78d65', 'div-005', 'Goalkeepers', 'goalkeepers', 'Last line of defense', 'active', 1, 0, 11, '#7c3aed', '2025-01-11T10:00:00.000Z', 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL);

-- ============================================
-- ROSTERS (user_id is NOT NULL - can't use NULL values!)
-- ============================================
INSERT OR IGNORE INTO rosters (id, client_id, team_id, user_id, is_captain, is_co_captain, roster_status, date_joined, created_at, updated_at, created_user, updated_user)
VALUES
-- Thunder Hawks roster (Jake is captain)
('rost-001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'team-001', 'f5d5c301-9ad3-4cb4-9cfd-a6b78e67734a', 1, 0, 'active', '2025-01-10T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
-- John is on the team too
('rost-002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'team-001', 'a4613d93-f591-4e0b-b9f5-2f43e4e08639', 0, 0, 'active', '2025-01-12T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL);

-- ============================================
-- EVENTS
-- ============================================
INSERT OR IGNORE INTO events (id, client_id, type, sport_id, league_id, division_id, facility_id, facility_area_id, home_team_id, away_team_id, scheduled_start_at, scheduled_end_at, status, week_number, home_score, away_score, is_active, created_at, updated_at, created_user, updated_user)
VALUES
-- Today's games
('evt-001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'game', 'sport-001', 'league-001', 'div-001', 'fac-001', 'area-001', 'team-001', 'team-002', '2025-02-15T19:00:00.000Z', '2025-02-15T20:30:00.000Z', 'in_progress', 3, 42, 38, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('evt-002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'game', 'sport-001', 'league-001', 'div-001', 'fac-001', 'area-002', 'team-003', 'team-004', '2025-02-15T19:30:00.000Z', '2025-02-15T21:00:00.000Z', 'scheduled', 3, NULL, NULL, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('evt-003', '6eb657af-4ab8-4a13-980a-add993f78d65', 'game', 'sport-001', 'league-001', 'div-002', 'fac-003', 'area-007', 'team-007', 'team-008', '2025-02-15T20:00:00.000Z', '2025-02-15T21:30:00.000Z', 'scheduled', 3, NULL, NULL, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('evt-004', '6eb657af-4ab8-4a13-980a-add993f78d65', 'game', 'sport-003', 'league-004', 'div-005', 'fac-002', 'area-004', 'team-015', 'team-016', '2025-02-15T18:00:00.000Z', '2025-02-15T19:30:00.000Z', 'completed', 3, 3, 2, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('evt-005', '6eb657af-4ab8-4a13-980a-add993f78d65', 'game', 'sport-003', 'league-004', 'div-005', 'fac-002', 'area-005', 'team-017', 'team-018', '2025-02-15T19:00:00.000Z', '2025-02-15T20:30:00.000Z', 'in_progress', 3, 1, 1, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
-- Tomorrow's games
('evt-006', '6eb657af-4ab8-4a13-980a-add993f78d65', 'game', 'sport-001', 'league-001', 'div-001', 'fac-001', 'area-001', 'team-005', 'team-006', '2025-02-16T19:00:00.000Z', '2025-02-16T20:30:00.000Z', 'scheduled', 3, NULL, NULL, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('evt-007', '6eb657af-4ab8-4a13-980a-add993f78d65', 'game', 'sport-001', 'league-001', 'div-002', 'fac-003', 'area-008', 'team-009', 'team-010', '2025-02-16T20:00:00.000Z', '2025-02-16T21:30:00.000Z', 'scheduled', 3, NULL, NULL, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL);

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
INSERT OR IGNORE INTO announcements (id, client_id, title, body, published_at, is_pinned, is_active, created_at, updated_at, created_user, updated_user)
VALUES
('ann-001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Weather Alert: Lightning Delay', 'Lightning detected within 10 miles of North Fields. All outdoor activities suspended until 8:00 PM.', '2025-02-15T18:30:00.000Z', 1, 1, '2025-02-15T18:30:00.000Z', '2025-02-15T18:30:00.000Z', NULL, NULL),
('ann-002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Roster Verification Required', 'Team Alpha has 3 unverified players. Captains must verify eligibility by Feb 20.', '2025-02-14T10:00:00.000Z', 0, 1, '2025-02-14T10:00:00.000Z', '2025-02-14T10:00:00.000Z', NULL, NULL),
('ann-003', '6eb657af-4ab8-4a13-980a-add993f78d65', 'Field 3 Maintenance', 'Scheduled maintenance on Field 3 for tomorrow morning. Games moved to Field 2.', '2025-02-15T12:00:00.000Z', 0, 1, '2025-02-15T12:00:00.000Z', '2025-02-15T12:00:00.000Z', NULL, NULL);

-- ============================================
-- DIVISION STANDINGS
-- ============================================
INSERT OR IGNORE INTO division_standings (id, client_id, league_id, division_id, team_id, wins, losses, ties, points_for, points_against, points, win_pct, streak, last_updated_at, created_at, updated_at, created_user, updated_user)
VALUES
-- Men's Basketball standings
('stand-001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-001', 'team-001', 5, 2, 0, 485, 420, 10, '0.714', 'W2', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-001', 'team-002', 6, 1, 0, 520, 445, 12, '0.857', 'W3', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-003', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-001', 'team-003', 4, 3, 0, 462, 438, 8, '0.571', 'L1', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-004', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-001', 'team-004', 3, 4, 0, 398, 412, 6, '0.429', 'W1', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-005', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-001', 'team-005', 2, 5, 0, 385, 465, 4, '0.286', 'L2', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-006', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-001', 'team-006', 4, 3, 0, 445, 430, 8, '0.571', 'W1', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
-- Women's Basketball standings
('stand-007', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-002', 'team-007', 6, 1, 0, 510, 420, 12, '0.857', 'W2', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-008', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-002', 'team-008', 5, 2, 0, 485, 438, 10, '0.714', 'W1', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-009', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-002', 'team-009', 4, 3, 0, 468, 445, 8, '0.571', 'L1', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-010', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-001', 'div-002', 'team-010', 3, 4, 0, 425, 450, 6, '0.429', 'L2', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
-- Soccer standings
('stand-011', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-004', 'div-005', 'team-015', 7, 1, 1, 24, 12, 22, '0.833', 'W3', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-012', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-004', 'div-005', 'team-016', 6, 2, 1, 21, 14, 19, '0.722', 'W2', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-013', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-004', 'div-005', 'team-017', 5, 3, 1, 18, 16, 16, '0.611', 'L1', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL),
('stand-014', '6eb657af-4ab8-4a13-980a-add993f78d65', 'league-004', 'div-005', 'team-018', 4, 4, 1, 15, 18, 13, '0.500', 'T1', '2025-02-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z', NULL, NULL);
