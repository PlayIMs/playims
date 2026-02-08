-- Intramural offerings seed data
-- Safe to run repeatedly

INSERT OR IGNORE INTO offerings (
	id,
	name,
	slug,
	is_active,
	type,
	description,
	client_id,
	created_at,
	updated_at,
	created_user,
	updated_user
)
VALUES
	('11111111-1111-4111-8111-111111111111', 'Basketball', 'basketball', 1, 'league', 'Indoor intramural basketball offerings.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('22222222-2222-4222-8222-222222222222', 'Soccer', 'soccer', 1, 'league', 'Outdoor intramural soccer offerings.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('33333333-3333-4333-8333-333333333333', 'Volleyball', 'volleyball', 1, 'league', 'Indoor intramural volleyball offerings.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('44444444-4444-4444-8444-444444444444', 'Flag Football', 'flag-football', 1, 'league', 'Intramural flag football offerings.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('55555555-5555-4555-8555-555555555555', 'Floor Hockey', 'floor-hockey', 1, 'league', 'Intramural floor hockey offerings.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('66666666-6666-4666-8666-666666666666', 'Softball', 'softball', 1, 'league', 'Intramural softball offerings.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('77777777-7777-4777-8777-777777777777', 'Battleship', 'battleship', 1, 'tournament', 'Battleship tournament groups.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('88888888-8888-4888-8888-888888888888', 'Cornhole', 'cornhole', 1, 'tournament', 'Cornhole tournament groups.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('99999999-9999-4999-8999-999999999999', 'Doubles Pickleball', 'doubles-pickleball', 1, 'tournament', 'Doubles pickleball tournament groups.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Spikeball', 'spikeball', 1, 'tournament', 'Spikeball tournament groups.', '6eb657af-4ab8-4a13-980a-add993f78d65', '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL);

INSERT OR IGNORE INTO leagues (
	id,
	client_id,
	offering_id,
	name,
	slug,
	description,
	year,
	season,
	gender,
	skill_level,
	reg_start_date,
	reg_end_date,
	season_start_date,
	season_end_date,
	has_postseason,
	postseason_start_date,
	postseason_end_date,
	has_preseason,
	preseason_start_date,
	preseason_end_date,
	is_active,
	is_locked,
	image_url,
	created_at,
	updated_at,
	created_user,
	updated_user
)
VALUES
	-- Basketball (open now; men's waitlist)
	('b1000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', '11111111-1111-4111-8111-111111111111', 'Men''s', 'basketball-mens-spring-2026', 'Men''s basketball league.', 2026, 'Spring', 'mens', 'competitive', '2026-01-20T00:00:00.000Z', '2026-02-20T23:59:00.000Z', '2026-02-24T00:00:00.000Z', '2026-04-12T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 1, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b1000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', '11111111-1111-4111-8111-111111111111', 'Women''s', 'basketball-womens-spring-2026', 'Women''s basketball league.', 2026, 'Spring', 'womens', 'recreational', '2026-01-20T00:00:00.000Z', '2026-02-20T23:59:00.000Z', '2026-02-24T00:00:00.000Z', '2026-04-12T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b1000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', '11111111-1111-4111-8111-111111111111', 'CoRec', 'basketball-corec-spring-2026', 'CoRec basketball league.', 2026, 'Spring', 'corec', 'all', '2026-01-20T00:00:00.000Z', '2026-02-20T23:59:00.000Z', '2026-02-24T00:00:00.000Z', '2026-04-12T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b1000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', '11111111-1111-4111-8111-111111111111', 'Unified', 'basketball-unified-spring-2026', 'Unified basketball league.', 2026, 'Spring', 'unified', 'intermediate', '2026-01-20T00:00:00.000Z', '2026-02-20T23:59:00.000Z', '2026-02-24T00:00:00.000Z', '2026-04-12T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),

	-- Soccer (open now)
	('b2000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', '22222222-2222-4222-8222-222222222222', 'Men''s', 'soccer-mens-spring-2026', 'Men''s soccer league.', 2026, 'Spring', 'mens', 'competitive', '2026-01-20T00:00:00.000Z', '2026-02-22T23:59:00.000Z', '2026-02-27T00:00:00.000Z', '2026-04-15T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b2000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', '22222222-2222-4222-8222-222222222222', 'Women''s', 'soccer-womens-spring-2026', 'Women''s soccer league.', 2026, 'Spring', 'womens', 'recreational', '2026-01-20T00:00:00.000Z', '2026-02-22T23:59:00.000Z', '2026-02-27T00:00:00.000Z', '2026-04-15T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b2000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', '22222222-2222-4222-8222-222222222222', 'CoRec', 'soccer-corec-spring-2026', 'CoRec soccer league.', 2026, 'Spring', 'corec', 'all', '2026-01-20T00:00:00.000Z', '2026-02-22T23:59:00.000Z', '2026-02-27T00:00:00.000Z', '2026-04-15T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b2000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', '22222222-2222-4222-8222-222222222222', 'Unified', 'soccer-unified-spring-2026', 'Unified soccer league.', 2026, 'Spring', 'unified', 'intermediate', '2026-01-20T00:00:00.000Z', '2026-02-22T23:59:00.000Z', '2026-02-27T00:00:00.000Z', '2026-04-15T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),

	-- Volleyball (upcoming/opening soon)
	('b3000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', '33333333-3333-4333-8333-333333333333', 'Men''s', 'volleyball-mens-spring-2026', 'Men''s volleyball league.', 2026, 'Spring', 'mens', 'competitive', '2026-02-10T00:00:00.000Z', '2026-03-02T23:59:00.000Z', '2026-03-10T00:00:00.000Z', '2026-04-26T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b3000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', '33333333-3333-4333-8333-333333333333', 'Women''s', 'volleyball-womens-spring-2026', 'Women''s volleyball league.', 2026, 'Spring', 'womens', 'recreational', '2026-02-10T00:00:00.000Z', '2026-03-02T23:59:00.000Z', '2026-03-10T00:00:00.000Z', '2026-04-26T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b3000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', '33333333-3333-4333-8333-333333333333', 'CoRec', 'volleyball-corec-spring-2026', 'CoRec volleyball league.', 2026, 'Spring', 'corec', 'all', '2026-02-10T00:00:00.000Z', '2026-03-02T23:59:00.000Z', '2026-03-10T00:00:00.000Z', '2026-04-26T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b3000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', '33333333-3333-4333-8333-333333333333', 'Unified', 'volleyball-unified-spring-2026', 'Unified volleyball league.', 2026, 'Spring', 'unified', 'intermediate', '2026-02-10T00:00:00.000Z', '2026-03-02T23:59:00.000Z', '2026-03-10T00:00:00.000Z', '2026-04-26T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),

	-- Flag Football (upcoming/opening soon)
	('b4000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', '44444444-4444-4444-8444-444444444444', 'Men''s', 'flag-football-mens-spring-2026', 'Men''s flag football league.', 2026, 'Spring', 'mens', 'competitive', '2026-02-12T00:00:00.000Z', '2026-03-04T23:59:00.000Z', '2026-03-12T00:00:00.000Z', '2026-04-30T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b4000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', '44444444-4444-4444-8444-444444444444', 'Women''s', 'flag-football-womens-spring-2026', 'Women''s flag football league.', 2026, 'Spring', 'womens', 'recreational', '2026-02-12T00:00:00.000Z', '2026-03-04T23:59:00.000Z', '2026-03-12T00:00:00.000Z', '2026-04-30T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b4000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', '44444444-4444-4444-8444-444444444444', 'CoRec', 'flag-football-corec-spring-2026', 'CoRec flag football league.', 2026, 'Spring', 'corec', 'all', '2026-02-12T00:00:00.000Z', '2026-03-04T23:59:00.000Z', '2026-03-12T00:00:00.000Z', '2026-04-30T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('b4000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', '44444444-4444-4444-8444-444444444444', 'Unified', 'flag-football-unified-spring-2026', 'Unified flag football league.', 2026, 'Spring', 'unified', 'intermediate', '2026-02-12T00:00:00.000Z', '2026-03-04T23:59:00.000Z', '2026-03-12T00:00:00.000Z', '2026-04-30T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),

	-- Floor Hockey (concluded)
	('b5000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', '55555555-5555-4555-8555-555555555555', 'Men''s', 'floor-hockey-mens-fall-2025', 'Men''s floor hockey league.', 2025, 'Fall', 'mens', 'competitive', '2025-10-15T00:00:00.000Z', '2025-11-10T23:59:00.000Z', '2025-11-17T00:00:00.000Z', '2026-01-12T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-10-01T10:00:00.000Z', '2025-10-01T10:00:00.000Z', NULL, NULL),
	('b5000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', '55555555-5555-4555-8555-555555555555', 'Women''s', 'floor-hockey-womens-fall-2025', 'Women''s floor hockey league.', 2025, 'Fall', 'womens', 'recreational', '2025-10-15T00:00:00.000Z', '2025-11-10T23:59:00.000Z', '2025-11-17T00:00:00.000Z', '2026-01-12T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-10-01T10:00:00.000Z', '2025-10-01T10:00:00.000Z', NULL, NULL),
	('b5000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', '55555555-5555-4555-8555-555555555555', 'CoRec', 'floor-hockey-corec-fall-2025', 'CoRec floor hockey league.', 2025, 'Fall', 'corec', 'all', '2025-10-15T00:00:00.000Z', '2025-11-10T23:59:00.000Z', '2025-11-17T00:00:00.000Z', '2026-01-12T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-10-01T10:00:00.000Z', '2025-10-01T10:00:00.000Z', NULL, NULL),
	('b5000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', '55555555-5555-4555-8555-555555555555', 'Unified', 'floor-hockey-unified-fall-2025', 'Unified floor hockey league.', 2025, 'Fall', 'unified', 'intermediate', '2025-10-15T00:00:00.000Z', '2025-11-10T23:59:00.000Z', '2025-11-17T00:00:00.000Z', '2026-01-12T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-10-01T10:00:00.000Z', '2025-10-01T10:00:00.000Z', NULL, NULL),

	-- Softball (concluded)
	('b6000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', '66666666-6666-4666-8666-666666666666', 'Men''s', 'softball-mens-fall-2025', 'Men''s softball league.', 2025, 'Fall', 'mens', 'competitive', '2025-10-20T00:00:00.000Z', '2025-11-12T23:59:00.000Z', '2025-11-19T00:00:00.000Z', '2026-01-15T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-10-01T10:00:00.000Z', '2025-10-01T10:00:00.000Z', NULL, NULL),
	('b6000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', '66666666-6666-4666-8666-666666666666', 'Women''s', 'softball-womens-fall-2025', 'Women''s softball league.', 2025, 'Fall', 'womens', 'recreational', '2025-10-20T00:00:00.000Z', '2025-11-12T23:59:00.000Z', '2025-11-19T00:00:00.000Z', '2026-01-15T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-10-01T10:00:00.000Z', '2025-10-01T10:00:00.000Z', NULL, NULL),
	('b6000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', '66666666-6666-4666-8666-666666666666', 'CoRec', 'softball-corec-fall-2025', 'CoRec softball league.', 2025, 'Fall', 'corec', 'all', '2025-10-20T00:00:00.000Z', '2025-11-12T23:59:00.000Z', '2025-11-19T00:00:00.000Z', '2026-01-15T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-10-01T10:00:00.000Z', '2025-10-01T10:00:00.000Z', NULL, NULL),
	('b6000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', '66666666-6666-4666-8666-666666666666', 'Unified', 'softball-unified-fall-2025', 'Unified softball league.', 2025, 'Fall', 'unified', 'intermediate', '2025-10-20T00:00:00.000Z', '2025-11-12T23:59:00.000Z', '2025-11-19T00:00:00.000Z', '2026-01-15T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-10-01T10:00:00.000Z', '2025-10-01T10:00:00.000Z', NULL, NULL),

	-- Battleship tournament (concluded)
	('t7000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', '77777777-7777-4777-8777-777777777777', 'Men''s', 'battleship-mens-spring-2026', 'Men''s battleship tournament group.', 2026, 'Spring', 'mens', 'all', '2025-12-15T00:00:00.000Z', '2026-01-10T23:59:00.000Z', '2026-01-20T00:00:00.000Z', '2026-01-20T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-12-01T10:00:00.000Z', '2025-12-01T10:00:00.000Z', NULL, NULL),
	('t7000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', '77777777-7777-4777-8777-777777777777', 'Women''s', 'battleship-womens-spring-2026', 'Women''s battleship tournament group.', 2026, 'Spring', 'womens', 'all', '2025-12-15T00:00:00.000Z', '2026-01-10T23:59:00.000Z', '2026-01-20T00:00:00.000Z', '2026-01-20T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-12-01T10:00:00.000Z', '2025-12-01T10:00:00.000Z', NULL, NULL),
	('t7000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', '77777777-7777-4777-8777-777777777777', 'Open', 'battleship-open-spring-2026', 'Open battleship tournament group.', 2026, 'Spring', 'open', 'all', '2025-12-15T00:00:00.000Z', '2026-01-10T23:59:00.000Z', '2026-01-20T00:00:00.000Z', '2026-01-20T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-12-01T10:00:00.000Z', '2025-12-01T10:00:00.000Z', NULL, NULL),
	('t7000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', '77777777-7777-4777-8777-777777777777', 'CoRec', 'battleship-corec-spring-2026', 'CoRec battleship tournament group.', 2026, 'Spring', 'corec', 'all', '2025-12-15T00:00:00.000Z', '2026-01-10T23:59:00.000Z', '2026-01-20T00:00:00.000Z', '2026-01-20T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2025-12-01T10:00:00.000Z', '2025-12-01T10:00:00.000Z', NULL, NULL),

	-- Cornhole tournament (open)
	('t8000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', '88888888-8888-4888-8888-888888888888', 'Men''s', 'cornhole-mens-spring-2026', 'Men''s cornhole tournament group.', 2026, 'Spring', 'mens', 'all', '2026-01-25T00:00:00.000Z', '2026-02-18T23:59:00.000Z', '2026-02-28T00:00:00.000Z', '2026-02-28T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('t8000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', '88888888-8888-4888-8888-888888888888', 'Women''s', 'cornhole-womens-spring-2026', 'Women''s cornhole tournament group.', 2026, 'Spring', 'womens', 'all', '2026-01-25T00:00:00.000Z', '2026-02-18T23:59:00.000Z', '2026-02-28T00:00:00.000Z', '2026-02-28T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('t8000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', '88888888-8888-4888-8888-888888888888', 'Open', 'cornhole-open-spring-2026', 'Open cornhole tournament group.', 2026, 'Spring', 'open', 'all', '2026-01-25T00:00:00.000Z', '2026-02-18T23:59:00.000Z', '2026-02-28T00:00:00.000Z', '2026-02-28T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('t8000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', '88888888-8888-4888-8888-888888888888', 'CoRec', 'cornhole-corec-spring-2026', 'CoRec cornhole tournament group.', 2026, 'Spring', 'corec', 'all', '2026-01-25T00:00:00.000Z', '2026-02-18T23:59:00.000Z', '2026-02-28T00:00:00.000Z', '2026-02-28T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),

	-- Doubles Pickleball tournament (upcoming)
	('t9000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', '99999999-9999-4999-8999-999999999999', 'Men''s', 'doubles-pickleball-mens-spring-2026', 'Men''s doubles pickleball tournament group.', 2026, 'Spring', 'mens', 'all', '2026-02-12T00:00:00.000Z', '2026-03-05T23:59:00.000Z', '2026-03-20T00:00:00.000Z', '2026-03-21T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('t9000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', '99999999-9999-4999-8999-999999999999', 'Women''s', 'doubles-pickleball-womens-spring-2026', 'Women''s doubles pickleball tournament group.', 2026, 'Spring', 'womens', 'all', '2026-02-12T00:00:00.000Z', '2026-03-05T23:59:00.000Z', '2026-03-20T00:00:00.000Z', '2026-03-21T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('t9000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', '99999999-9999-4999-8999-999999999999', 'Open', 'doubles-pickleball-open-spring-2026', 'Open doubles pickleball tournament group.', 2026, 'Spring', 'open', 'all', '2026-02-12T00:00:00.000Z', '2026-03-05T23:59:00.000Z', '2026-03-20T00:00:00.000Z', '2026-03-21T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('t9000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', '99999999-9999-4999-8999-999999999999', 'CoRec', 'doubles-pickleball-corec-spring-2026', 'CoRec doubles pickleball tournament group.', 2026, 'Spring', 'corec', 'all', '2026-02-12T00:00:00.000Z', '2026-03-05T23:59:00.000Z', '2026-03-20T00:00:00.000Z', '2026-03-21T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),

	-- Spikeball tournament (closed registration, future event)
	('ta000001-0000-4000-8000-000000000001', '6eb657af-4ab8-4a13-980a-add993f78d65', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Men''s', 'spikeball-mens-spring-2026', 'Men''s spikeball tournament group.', 2026, 'Spring', 'mens', 'all', '2026-01-08T00:00:00.000Z', '2026-01-30T23:59:00.000Z', '2026-02-15T00:00:00.000Z', '2026-02-16T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('ta000002-0000-4000-8000-000000000002', '6eb657af-4ab8-4a13-980a-add993f78d65', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Women''s', 'spikeball-womens-spring-2026', 'Women''s spikeball tournament group.', 2026, 'Spring', 'womens', 'all', '2026-01-08T00:00:00.000Z', '2026-01-30T23:59:00.000Z', '2026-02-15T00:00:00.000Z', '2026-02-16T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('ta000003-0000-4000-8000-000000000003', '6eb657af-4ab8-4a13-980a-add993f78d65', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Open', 'spikeball-open-spring-2026', 'Open spikeball tournament group.', 2026, 'Spring', 'open', 'all', '2026-01-08T00:00:00.000Z', '2026-01-30T23:59:00.000Z', '2026-02-15T00:00:00.000Z', '2026-02-16T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL),
	('ta000004-0000-4000-8000-000000000004', '6eb657af-4ab8-4a13-980a-add993f78d65', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'CoRec', 'spikeball-corec-spring-2026', 'CoRec spikeball tournament group.', 2026, 'Spring', 'corec', 'all', '2026-01-08T00:00:00.000Z', '2026-01-30T23:59:00.000Z', '2026-02-15T00:00:00.000Z', '2026-02-16T23:59:00.000Z', 0, NULL, NULL, 0, NULL, NULL, 1, 0, NULL, '2026-01-05T10:00:00.000Z', '2026-01-05T10:00:00.000Z', NULL, NULL);
