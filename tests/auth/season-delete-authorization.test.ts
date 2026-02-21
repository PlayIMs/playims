import { describe, expect, it } from 'vitest';
import { DELETE } from '../../src/routes/api/intramural-sports/seasons/+server';

describe('intramural season delete authorization', () => {
	it('rejects non-admin callers before executing delete logic', async () => {
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
		expect(payload.success).toBe(false);
		expect(payload.error).toBe('Only administrators can delete seasons.');
	});
});
