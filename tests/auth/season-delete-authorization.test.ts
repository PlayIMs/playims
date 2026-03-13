/*
Brief description:
This file verifies the authorization guard on intramural season deletion.

Deeper explanation:
Season deletion is destructive, so the route should reject underprivileged callers before any deeper
delete logic runs. This test keeps that protection explicit by exercising the route with a manager role
and confirming the denial happens immediately.

Summary of tests:
1. It verifies that non-admin callers are rejected before season deletion logic executes.
*/

import { describe, expect, it } from 'vitest';
import { DELETE } from '../../src/routes/api/intramural-sports/seasons/+server';

describe('intramural season delete authorization', () => {
	it('rejects non-admin callers before executing delete logic', async () => {
		// this request uses a manager role specifically to prove the route-level guard blocks deletion early.
		const response = await DELETE({
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager'
				}
			},
			request: new Request('https://playims.test/api/intramural-sports/seasons', {
				method: 'DELETE',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					seasonId: 'season-1',
					confirmSlug: 'fall-2026',
					reason: null
				})
			})
		} as any);

		expect(response.status).toBe(403);
		const payload = (await response.json()) as { success: boolean; error: string };
		// checking the payload message makes the permission rule visible to future maintainers.
		expect(payload.success).toBe(false);
		expect(payload.error).toBe('Only administrators and developers can delete seasons.');
	});
});
