/*
Brief description:
This file protects the division lock control's management request contract.

Deeper explanation:
Changing a lock must preserve the division's other settings. Manual changes disable automatic
locking, while Revert restores it. Failed saves must leave the confirmation available to retry.

Summary of tests:
1. It verifies manual locking preserves settings and disables automatic locking.
2. It verifies reverting restores automatic locking and surfaces save failures.
*/
import { describe, expect, it, vi } from 'vitest';
import { saveDivisionLock } from '../../src/lib/components/division-lock-control';

const division = {
	id: 'division-1',
	name: 'Friday 4:00 PM',
	slug: 'friday',
	description: null,
	dayOfWeek: 'Friday',
	gameTime: '4:00 PM',
	location: 'Court 1',
	startDate: null,
	maxTeams: 6,
	isLocked: false,
	doAutoLock: true
};

describe('division lock saves', () => {
	it('preserves settings when manually locking', async () => {
		// capture the actual request so unrelated settings cannot be lost during a lock change.
		const request = vi.fn().mockResolvedValue(Response.json({ success: true }));
		await saveDivisionLock('/management', 'league-1', division, 'toggle', request);
		const body = JSON.parse(request.mock.calls[0][1].body);
		expect(body).toEqual({
			action: 'update-division',
			leagueId: 'league-1',
			divisionId: division.id,
			division: {
				name: division.name,
				slug: division.slug,
				description: null,
				dayOfWeek: 'Friday',
				gameTime: '4:00 PM',
				location: 'Court 1',
				startDate: null,
				maxTeams: 6,
				isLocked: true,
				doAutoLock: false
			}
		});
	});

	it('restores automatic locking and reports a rejected save', async () => {
		const request = vi
			.fn()
			.mockResolvedValue(
				Response.json({ success: false, error: 'Permission denied.' }, { status: 403 })
			);
		await expect(
			saveDivisionLock('/management', 'league-1', division, 'revert', request)
		).rejects.toThrow('Permission denied.');
		expect(JSON.parse(request.mock.calls[0][1].body).division).toMatchObject({
			isLocked: false,
			doAutoLock: true
		});
	});
});
