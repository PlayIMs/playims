/*
Brief description:
This file verifies the search palette recent-selection POST route.

Deeper explanation:
Recent selections are server-synced so users can see familiar results across devices. These tests
check the authenticated write rules and the recents lifecycle: creating a new selection, updating an
existing one without duplication, and trimming older history once the per-organization limit is exceeded.

Summary of tests:
1. It verifies that unauthenticated requests are rejected.
2. It verifies that a new recent selection is inserted when no duplicate exists.
3. It verifies that an existing recent is touched instead of duplicated.
4. It verifies that old recent rows are trimmed once the list exceeds the maximum size.
5. It verifies that broken separator text is repaired before a recent selection is stored.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		centralDbOps: {
			searchRecents: {
				getByUserClientAndResultKey: vi.fn(),
				create: vi.fn(),
				touch: vi.fn(),
				listByUserAndClient: vi.fn(),
				deleteByIds: vi.fn()
			}
		},
		getCentralDbOps: vi.fn()
	};
});

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.centralDbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { POST } from '../../src/routes/api/search/recent/+server';

const createEvent = (input?: {
	userId?: string | null;
	clientId?: string | null;
	body?: Record<string, unknown>;
}) =>
	({
		url: new URL('https://playims.test/api/search/recent'),
		request: new Request('https://playims.test/api/search/recent', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(
				input?.body ?? {
					resultKey: 'pages:/dashboard/facilities',
					category: 'pages',
					title: 'Facilities',
					subtitle: 'Manage facilities',
					href: '/dashboard/facilities',
					badge: null,
					meta: null
				}
			)
		}),
		platform: { env: { DB: {} } },
		locals: {
			user: input?.userId
				? {
						id: input.userId,
						clientId: input.clientId ?? 'client-1',
						role: 'admin'
					}
				: null,
			session: input?.userId
				? {
						id: 'session-1',
						userId: input.userId,
						clientId: input.clientId ?? 'client-1',
						activeClientId: input.clientId ?? 'client-1',
						role: 'admin'
					}
				: null
		}
	}) as any;

describe('search palette recent POST route', () => {
	beforeEach(() => {
		// these defaults represent the common new-selection path.
		vi.clearAllMocks();
		mocks.centralDbOps.searchRecents.getByUserClientAndResultKey.mockResolvedValue(null);
		mocks.centralDbOps.searchRecents.create.mockResolvedValue({ id: 'recent-1' });
		mocks.centralDbOps.searchRecents.touch.mockResolvedValue({ id: 'recent-1' });
		mocks.centralDbOps.searchRecents.listByUserAndClient.mockResolvedValue([]);
		mocks.centralDbOps.searchRecents.deleteByIds.mockResolvedValue(0);
	});

	it('rejects unauthenticated requests', async () => {
		// recents are user-specific, so the route should require an authenticated user context.
		const response = await POST(createEvent({ userId: null }));
		const payload = await response.json();

		expect(response.status).toBe(401);
		expect(payload.error).toBe('Authentication is required.');
	});

	it('creates a new recent selection when no duplicate exists', async () => {
		const response = await POST(createEvent({ userId: 'user-1' }));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(mocks.centralDbOps.searchRecents.create).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				clientId: 'client-1',
				resultKey: 'pages:/dashboard/facilities'
			})
		);
	});

	it('touches an existing recent instead of creating a duplicate', async () => {
		// deduping keeps the recent list compact while still moving reused entries to the top.
		mocks.centralDbOps.searchRecents.getByUserClientAndResultKey.mockResolvedValue({
			id: 'recent-9'
		});

		const response = await POST(createEvent({ userId: 'user-2' }));

		expect(response.status).toBe(200);
		expect(mocks.centralDbOps.searchRecents.touch).toHaveBeenCalledWith(
			'recent-9',
			expect.objectContaining({
				title: 'Facilities'
			})
		);
		expect(mocks.centralDbOps.searchRecents.create).not.toHaveBeenCalled();
	});

	it('trims older recent rows after the max size is exceeded', async () => {
		// this proves the server enforces the limit instead of allowing recents to grow forever.
		mocks.centralDbOps.searchRecents.listByUserAndClient.mockResolvedValue(
			Array.from({ length: 11 }, (_, index) => ({
				id: `recent-${index + 1}`
			}))
		);

		const response = await POST(createEvent({ userId: 'user-3' }));

		expect(response.status).toBe(200);
		expect(mocks.centralDbOps.searchRecents.deleteByIds).toHaveBeenCalledWith(['recent-11']);
	});

	it('repairs broken separator text before storing a recent selection', async () => {
		// old mojibake can live in client state for a while, so the server should normalize it before saving.
		const response = await POST(
			createEvent({
				userId: 'user-4',
				body: {
					resultKey: 'teams:team-1',
					category: 'teams',
					title: 'Ballers to Wallers',
					subtitle:
						"Basketball \u00e2\u20ac\u00a2 Men's Competitive \u00e2\u20ac\u00a2 Sunday 3:00 PM",
					href: '/dashboard/offerings/fall-2026/basketball/co-rec/division-a/ballers-to-wallers',
					badge: 'Recent',
					meta: 'Jan 19, 2026 \u00e2\u20ac\u201c May 8, 2026'
				}
			})
		);

		expect(response.status).toBe(200);
		expect(mocks.centralDbOps.searchRecents.create).toHaveBeenCalledWith(
			expect.objectContaining({
				subtitle: "Basketball • Men's Competitive • Sunday 3:00 PM",
				meta: 'Jan 19, 2026 – May 8, 2026'
			})
		);
	});
});
