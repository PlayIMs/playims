/*
Brief description:
This file verifies the address suggestion API route that fronts OpenStreetMap Nominatim.

Deeper explanation:
The address-suggest route is small, but it still owns input validation, caching behavior, upstream
error handling, and normalization of third-party address data into the app's stable response shape.
These tests protect that contract so a future provider change or refactor does not quietly break the
dashboard forms that depend on it.

Summary of tests:
1. It verifies that unsupported query characters are rejected.
2. It verifies that short queries return an empty cached result without calling the upstream provider.
3. It verifies that upstream failures return a 502 error.
4. It verifies that successful provider responses are normalized into the expected address fields.
*/

import { describe, expect, it, vi } from 'vitest';
import { GET } from '../../src/routes/api/address-suggest/+server';

// this helper builds the minimal event shape the address route expects.
const createEvent = (query: string, fetchImpl?: typeof fetch) => ({
	url: new URL(`https://playims.test/api/address-suggest?q=${encodeURIComponent(query)}`),
	fetch: fetchImpl ?? vi.fn()
}) as any;

describe('address suggest route', () => {
	it('rejects queries with unsupported characters', async () => {
		// unsupported characters should fail at validation instead of reaching the third-party provider.
		const response = await GET(createEvent('park<>'));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe('Invalid query');
	});

	it('returns an empty cached result for short queries without calling fetch', async () => {
		// short queries are intentionally ignored to reduce noisy upstream requests while the user is typing.
		const fetchSpy = vi.fn();
		const response = await GET(createEvent('gym', fetchSpy as unknown as typeof fetch));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			data: []
		});
		expect(response.headers.get('cache-control')).toBe('private, max-age=60');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns 502 when the upstream provider responds with a failure', async () => {
		// this keeps provider outages from leaking raw upstream details into the app.
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response('bad gateway', {
				status: 502
			})
		);
		const response = await GET(createEvent('main st', fetchSpy as unknown as typeof fetch));
		const payload = await response.json();

		expect(response.status).toBe(502);
		expect(payload.error).toBe('Address lookup failed');
	});

	it('normalizes successful provider responses into the stable app payload shape', async () => {
		// this sample uses town instead of city to prove the route applies its fallback mapping logic.
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						display_name: '123 Main St, Oxford, Mississippi, USA',
						address: {
							town: 'Oxford',
							state: 'Mississippi',
							postcode: '38655',
							country: 'United States'
						}
					}
				]),
				{
					status: 200,
					headers: { 'content-type': 'application/json' }
				}
			)
		);
		const response = await GET(createEvent('123 main', fetchSpy as unknown as typeof fetch));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			data: [
				{
					label: '123 Main St, Oxford, Mississippi, USA',
					city: 'Oxford',
					state: 'Mississippi',
					postalCode: '38655',
					country: 'United States'
				}
			]
		});
		expect(response.headers.get('cache-control')).toBe('private, max-age=60');
	});
});
