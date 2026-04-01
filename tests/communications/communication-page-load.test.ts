/*
Brief description:
This file verifies the dashboard communication center page load.

Deeper explanation:
The communication center server load is responsible for two things at once: protecting the page with
the communication permission and hydrating the initial workspace with history, filter options, and
an optional selected message. These tests keep that contract stable so the Svelte page can stay
focused on rendering rather than rebuilding missing server context.

Summary of tests:
1. It verifies that participant viewers can still open the page because the current permission registry grants that access.
2. It verifies that the page returns history, filter options, and the selected message detail.
3. It verifies that the page falls back to an empty payload when the database is unavailable.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	dbOps: {
		communications: {
			listMessageSummaries: vi.fn(),
			getMessageDetail: vi.fn()
		}
	},
	getCentralDbOps: vi.fn(),
	loadCommunicationFilterOptions: vi.fn()
}));

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

vi.mock('$lib/server/communications', () => ({
	loadCommunicationFilterOptions: mocks.loadCommunicationFilterOptions
}));

import { load } from '../../src/routes/dashboard/communications/+page.server';

const buildEvent = (path: string, role = 'manager', withDb = true) =>
	({
		platform: withDb ? { env: { DB: {} } } : undefined,
		url: new URL(`https://playims.test${path}`),
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role,
				baseRole: role
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role,
				baseRole: role
			}
		}
	}) as any;

describe('communication center page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.dbOps.communications.listMessageSummaries.mockResolvedValue([
			{
				id: 'message-1',
				channel: 'email',
				status: 'draft',
				subject: 'League update',
				recipientCount: 12,
				createdAt: '2029-01-01T00:00:00.000Z',
				updatedAt: '2029-01-01T00:00:00.000Z',
				sentAt: null,
				createdByName: 'Admin User',
				batchSummary: 'All captains',
				failureMessage: null
			}
		]);
		mocks.dbOps.communications.getMessageDetail.mockResolvedValue({
			id: 'message-1',
			channel: 'email',
			status: 'draft',
			subject: 'League update',
			editorJson: { type: 'doc', content: [] },
			bodyHtml: '<p>Hello</p>',
			bodyText: 'Hello',
			recipientCount: 12,
			createdAt: '2029-01-01T00:00:00.000Z',
			updatedAt: '2029-01-01T00:00:00.000Z',
			sentAt: null,
			createdByName: 'Admin User',
			batchSummary: 'All captains',
			failureMessage: null,
			batches: [],
			recipients: []
		});
		mocks.loadCommunicationFilterOptions.mockResolvedValue({
			memberRoles: [{ value: '', label: 'All Roles' }],
			memberSexes: [{ value: '', label: 'All Sexes' }],
			rosterRoles: [{ value: '', label: 'Any roster role' }],
			teamStatuses: [{ value: '', label: 'Any team status' }],
			seasons: [{ value: 'season-1', label: 'Spring 2029' }],
			offerings: [],
			leagues: [],
			divisions: [],
			teams: []
		});
	});

	it('allows participant viewers because the current permission registry exposes the page to them', async () => {
		// this locks the current auth contract so the page load matches the sidebar visibility rules.
		const result = await load(buildEvent('/dashboard/communications', 'participant'));

		expect(result.messages).toHaveLength(1);
	});

	it('loads message history, filter options, and the selected message detail', async () => {
		// the page needs all three payload slices up front so it can open the draft immediately.
		const result = await load(buildEvent('/dashboard/communications?messageId=message-1'));

		expect(result.messages).toHaveLength(1);
		expect(result.filterOptions.seasons).toEqual([{ value: 'season-1', label: 'Spring 2029' }]);
		expect(result.selectedMessage?.id).toBe('message-1');
		expect(mocks.dbOps.communications.getMessageDetail).toHaveBeenCalledWith('client-1', 'message-1');
	});

	it('returns an empty payload when the database binding is unavailable', async () => {
		// local fallback handling should keep the page renderable even when the db is missing.
		const result = await load(buildEvent('/dashboard/communications', 'manager', false));

		expect(result.messages).toEqual([]);
		expect(result.selectedMessage).toBeNull();
		expect(result.filterOptions.seasons).toEqual([]);
		expect(mocks.getCentralDbOps).not.toHaveBeenCalled();
	});
});
