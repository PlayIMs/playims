// brief header:
// These tests cover the main server-side decisions in the theme api routes.
//
// deeper explanation:
// This file does not hit a real database. Instead, it mocks the database layer so each test can
// focus on one route decision at a time. That is useful because route handlers often mix together
// auth context, payload parsing, duplicate checks, cache headers, and write operations. When we
// isolate the route logic like this, we can prove the api contract without needing full database
// setup. The comments below explain why each helper exists and what behavior each test is guarding.
//
// summary of the tests below:
// 1. Loads saved themes for the active client.
// 2. Enforces the maximum saved-theme limit.
// 3. Protects the reserved current-theme slug and handles collisions.
// 4. Returns 304 when the current-theme etag matches.
// 5. Rejects malformed current-theme payloads before writes.
// 6. Returns a fresh etag after updating the current theme.
// 7. Rejects invalid theme ids.
// 8. Prevents saved-theme routes from editing the reserved current theme.
// 9. Returns 404 when deleting a missing theme.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted creates these mocks before the route modules are imported.
// that matters because the route files capture their imports immediately, so the mocks must already
// exist before those files load or the real database helpers would be used instead.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			themes: {
				getSaved: vi.fn(),
				countSaved: vi.fn(),
				getBySlug: vi.fn(),
				create: vi.fn(),
				upsertCurrent: vi.fn(),
				getById: vi.fn(),
				update: vi.fn(),
				delete: vi.fn()
			}
		},
		getTenantDbOps: vi.fn()
	};
});

// this replaces the database context helper with our controlled fake version.
// the route code still "thinks" it is talking to the real helper, which keeps the test realistic
// while giving us total control over what the database returns.
vi.mock('$lib/server/database/context', () => {
	mocks.getTenantDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getTenantDbOps: mocks.getTenantDbOps
	};
});

import { GET as listThemes, POST as createTheme } from '../../src/routes/api/themes/+server';
import {
	GET as getCurrentTheme,
	PUT as updateCurrentTheme
} from '../../src/routes/api/themes/current/+server';
import {
	DELETE as deleteTheme,
	GET as getThemeById,
	PUT as updateThemeById
} from '../../src/routes/api/themes/[themeId]/+server';

// this helper builds a fake sveltekit event object.
// the routes expect request details, params, platform bindings, and auth context. centralizing that
// setup here keeps each test focused on the behavior it cares about instead of repeating boilerplate.
const createEvent = (input?: {
	method?: string;
	path?: string;
	body?: unknown;
	headers?: HeadersInit;
	params?: Record<string, string>;
	request?: Request;
}) => {
	const path = input?.path ?? '/api/themes';
	const url = new URL(`https://playims.test${path}`);
	// when a body is present we automatically add json headers and stringify the payload, because
	// that is how the real browser request would reach the route.
	const request =
		input?.request ??
		new Request(url, {
			method: input?.method ?? 'GET',
			headers:
				input?.body !== undefined
					? {
							'content-type': 'application/json',
							...(input?.headers ?? {})
						}
					: input?.headers,
			body: input?.body !== undefined ? JSON.stringify(input.body) : undefined
		});

	return {
		url,
		request,
		params: input?.params ?? {},
		platform: { env: { DB: {} } },
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role: 'admin'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role: 'admin'
			}
		}
	} as any;
};

describe('theme routes', () => {
	beforeEach(() => {
		// clearAllMocks removes call history so one test cannot accidentally "pass" because of work
		// done by a previous test. this keeps each test independent.
		vi.clearAllMocks();

		// these are the safe default database answers for most tests.
		// individual tests override only the part they care about, which makes the intent easier to
		// read and reduces setup noise.
		mocks.dbOps.themes.getSaved.mockResolvedValue([]);
		mocks.dbOps.themes.countSaved.mockResolvedValue(0);
		mocks.dbOps.themes.getBySlug.mockResolvedValue(null);
		mocks.dbOps.themes.create.mockResolvedValue({
			id: 'theme-1',
			name: 'Current',
			slug: 'current-theme-1'
		});
		mocks.dbOps.themes.upsertCurrent.mockResolvedValue({
			id: 'current',
			updatedAt: '2026-03-12T00:00:00.000Z',
			primary: 'AA0000',
			secondary: '00AA00',
			neutral: ''
		});
		mocks.dbOps.themes.getById.mockResolvedValue({
			id: 'theme-1',
			name: 'Saved Theme',
			slug: 'saved-theme'
		});
		mocks.dbOps.themes.update.mockResolvedValue({
			id: 'theme-1',
			name: 'Updated Theme',
			slug: 'saved-theme'
		});
		mocks.dbOps.themes.delete.mockResolvedValue({ id: 'theme-1' });
	});

	it('loads saved themes for the authenticated client', async () => {
		// overriding only this one mock shows that the route should pass through the returned data
		// without extra transformation in this scenario.
		mocks.dbOps.themes.getSaved.mockResolvedValue([{ id: 'theme-1', slug: 'saved-theme' }]);

		const response = await listThemes(createEvent());
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			data: [{ id: 'theme-1', slug: 'saved-theme' }]
		});
		expect(mocks.dbOps.themes.getSaved).toHaveBeenCalledWith('client-1');
	});

	it('blocks theme creation once the saved-theme cap is reached', async () => {
		// 15 is the limit defined in the route. this test exists so that if the route stops enforcing
		// the cap, we catch it before users can exceed the saved-theme budget unexpectedly.
		mocks.dbOps.themes.countSaved.mockResolvedValue(15);

		const response = await createTheme(
			createEvent({
				method: 'POST',
				body: {
					name: 'Overflow',
					colors: {
						primary: '#aa0000',
						secondary: '#00aa00'
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('MAX_THEMES');
		expect(mocks.dbOps.themes.create).not.toHaveBeenCalled();
	});

	it('reserves the current slug and increments collisions when saving themes', async () => {
		// mockResolvedValueOnce lets us simulate the route's slug lookup loop:
		// first lookup finds a conflict, second lookup finds a free slug.
		// this proves the route protects the reserved current name and still finds a unique fallback.
		mocks.dbOps.themes.getBySlug
			.mockResolvedValueOnce({ id: 'reserved-theme' })
			.mockResolvedValueOnce(null);

		const response = await createTheme(
			createEvent({
				method: 'POST',
				body: {
					name: ' Current ',
					colors: {
						primary: '#aa0000',
						secondary: '#00aa00'
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		// objectContaining keeps the assertion focused on the important write contract instead of
		// forcing the test to know every field returned by the route implementation.
		expect(mocks.dbOps.themes.create).toHaveBeenCalledWith(
			expect.objectContaining({
				clientId: 'client-1',
				createdUser: 'user-1',
				updatedUser: 'user-1',
				name: 'Current',
				slug: 'current-theme-1',
				primary: 'AA0000',
				secondary: '00AA00',
				neutral: ''
			})
		);
	});

	it('normalizes configured separator characters into hyphenated saved-theme slugs', async () => {
		const response = await createTheme(
			createEvent({
				method: 'POST',
				body: {
					name: 'Fri/Wed & Coed+Late_Night|Indoor\\Outdoor',
					colors: {
						primary: '#aa0000',
						secondary: '#00aa00'
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(mocks.dbOps.themes.create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Fri/Wed & Coed+Late_Night|Indoor\\Outdoor',
				slug: 'fri-wed-coed-late-night-indoor-outdoor'
			})
		);
	});

	it('returns 304 for current-theme fetches when the ETag matches', async () => {
		// this fake theme is stable so the generated etag is stable too.
		// the test proves the route honors browser cache validation instead of sending the same json
		// body again when nothing changed.
		mocks.dbOps.themes.getBySlug.mockResolvedValue({
			id: 'current',
			updatedAt: '2026-03-12T00:00:00.000Z',
			primary: 'AA0000',
			secondary: '00AA00',
			neutral: ''
		});

		const initialResponse = await getCurrentTheme(createEvent({ path: '/api/themes/current' }));
		// reading the header from the first response mirrors how a real browser would cache the etag
		// and send it back on the next request.
		const etag = initialResponse.headers.get('ETag');
		const cachedResponse = await getCurrentTheme(
			createEvent({
				path: '/api/themes/current',
				headers: {
					'if-none-match': etag ?? ''
				}
			})
		);

		expect(initialResponse.status).toBe(200);
		expect(cachedResponse.status).toBe(304);
		expect(cachedResponse.headers.get('Cache-Control')).toBe('no-store');
	});

	it('rejects malformed current-theme updates before hitting the database', async () => {
		const url = new URL('https://playims.test/api/themes/current');
		// this intentionally broken json body proves the route defends itself before it ever reaches
		// validation or persistence logic.
		const response = await updateCurrentTheme(
			createEvent({
				path: '/api/themes/current',
				request: new Request(url, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: '{'
				})
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe('Invalid request payload');
		expect(mocks.dbOps.themes.upsertCurrent).not.toHaveBeenCalled();
	});

	it('returns the updated current theme with a fresh ETag', async () => {
		const response = await updateCurrentTheme(
			createEvent({
				method: 'PUT',
				path: '/api/themes/current',
				body: {
					colors: {
						primary: '#aa0000',
						secondary: '#00aa00'
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		// asserting the exact etag value matters because downstream caching depends on this format
		// being stable when the same theme content is returned.
		expect(response.headers.get('ETag')).toBe('W/"current|2026-03-12T00:00:00.000Z|AA0000|00AA00|"');
	});

	it('rejects invalid theme ids before loading saved themes', async () => {
		const response = await getThemeById(
			createEvent({
				path: '/api/themes/not-a-uuid',
				params: {
					themeId: 'not-a-uuid'
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe('Invalid theme id');
		expect(mocks.dbOps.themes.getById).not.toHaveBeenCalled();
	});

	it('blocks updates to the reserved current theme record from the saved-theme route', async () => {
		// the saved-theme route is intentionally not allowed to edit the special current record.
		// this prevents two different update paths from mutating the same reserved object.
		mocks.dbOps.themes.getById.mockResolvedValue({
			id: 'current',
			slug: 'current'
		});

		const response = await updateThemeById(
			createEvent({
				method: 'PUT',
				path: '/api/themes/current',
				params: {
					themeId: '11111111-1111-4111-8111-111111111111'
				},
				body: {
					name: 'Should Not Update',
					colors: {
						primary: '#aa0000',
						secondary: '#00aa00'
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe('Cannot update current theme here');
		expect(mocks.dbOps.themes.update).not.toHaveBeenCalled();
	});

	it('returns 404 when deleting a theme that does not exist', async () => {
		mocks.dbOps.themes.getById.mockResolvedValue(null);

		const response = await deleteTheme(
			createEvent({
				method: 'DELETE',
				path: '/api/themes/missing',
				params: {
					themeId: '11111111-1111-4111-8111-111111111111'
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(404);
		expect(payload.error).toBe('Theme not found');
		expect(mocks.dbOps.themes.delete).not.toHaveBeenCalled();
	});
});
