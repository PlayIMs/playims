/*
Brief description:
This file verifies the communication center API routes.

Deeper explanation:
These routes coordinate draft validation, audience previews, selected-message reads, send execution,
and duplication. The tests mock the communication service boundary so each route can be checked for
authorization, validation, and payload shape without depending on the rich editor or D1 queries.

Summary of tests:
1. It verifies that invalid preview payloads are rejected.
2. It verifies that preview requests return stored recipient-group summaries and recipient previews.
3. It verifies that manual recipient resolve requests return canonical org members.
4. It verifies that ambiguous manual recipient resolve requests return suggestion rows instead of a hard error.
5. It verifies that creating a draft requires a subject and at least one recipient source.
6. It verifies that creating and updating drafts call the communication service.
7. It verifies that deleting a draft calls the communication service.
8. It verifies that sending a draft returns the refreshed message detail.
9. It verifies that duplicate requests return the new draft id.
10. It verifies that participant callers are blocked from mutating communication routes.
11. It verifies that message detail fetches return 404 when the draft is missing.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	dbOps: {
		communications: {
			getMessageDetail: vi.fn(),
			duplicateMessage: vi.fn()
		}
	},
	getCentralDbOps: vi.fn(),
	createCommunicationService: vi.fn(),
	loadCommunicationFilterOptions: vi.fn(),
	service: {
		previewRecipientGroup: vi.fn(),
		previewAudience: vi.fn(),
		resolveManualRecipients: vi.fn(),
		searchManualRecipientMatches: vi.fn(),
		saveDraft: vi.fn(),
		deleteDraft: vi.fn(),
		sendDraft: vi.fn()
	}
}));

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

vi.mock('$lib/server/communications', () => {
	mocks.createCommunicationService.mockImplementation(() => mocks.service);
	return {
		createCommunicationService: mocks.createCommunicationService,
		loadCommunicationFilterOptions: mocks.loadCommunicationFilterOptions
	};
});

import { POST as createDraft } from '../../src/routes/api/communications/+server';
import { POST as previewAudience } from '../../src/routes/api/communications/preview/+server';
import { POST as resolveManualRecipients } from '../../src/routes/api/communications/recipients/resolve/+server';
import {
	GET as getMessageDetail,
	PATCH as updateDraft,
	DELETE as deleteDraft
} from '../../src/routes/api/communications/[messageId]/+server';
import { POST as sendDraft } from '../../src/routes/api/communications/[messageId]/send/+server';
import { POST as duplicateDraft } from '../../src/routes/api/communications/[messageId]/duplicate/+server';

const buildEvent = (input: {
	path: string;
	method: string;
	body?: Record<string, unknown>;
	role?: string;
	messageId?: string;
}) =>
	({
		platform: { env: { DB: {} } },
		params: input.messageId ? { messageId: input.messageId } : {},
		url: new URL(`https://playims.test${input.path}`),
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role: input.role ?? 'manager'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role: input.role ?? 'manager'
			}
		},
		request: new Request(`https://playims.test${input.path}`, {
			method: input.method,
			headers: { 'content-type': 'application/json' },
			body: input.body ? JSON.stringify(input.body) : undefined
		})
	}) as any;

describe('communication routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.loadCommunicationFilterOptions.mockResolvedValue({
			memberRoles: [{ value: '', label: 'All Roles' }],
			memberSexes: [{ value: '', label: 'All Sexes' }],
			rosterRoles: [{ value: '', label: 'Any roster role' }],
			teamStatuses: [{ value: '', label: 'Any team status' }],
			seasons: [],
			offerings: [],
			leagues: [],
			divisions: [],
			teams: []
		});
		mocks.service.previewRecipientGroup.mockResolvedValue({
			preview: {
				totalCount: 2,
				rows: []
			},
			storedRecipientGroup: {
				id: 'recipient-group-1',
				mode: 'include',
				filters: {
					memberQuery: 'captain',
					memberRole: '',
					memberSex: '',
					seasonId: '',
					offeringId: '',
					leagueId: '',
					divisionId: '',
					teamId: '',
					rosterRole: '',
					teamStatus: ''
				},
				summaryText: 'Search: "captain"',
				resolvedRecipientCount: 2
			}
		});
		mocks.service.previewAudience.mockResolvedValue({
			totalCount: 2,
			rows: []
		});
		mocks.service.resolveManualRecipients.mockResolvedValue([
			{
				userId: 'user-1',
				email: 'alex@playims.test',
				fullName: 'Alex Captain'
			}
		]);
		mocks.service.searchManualRecipientMatches.mockResolvedValue({
			status: 'resolved',
			query: 'alex@playims.test',
			manualRecipient: {
				userId: 'user-1',
				email: 'alex@playims.test',
				fullName: 'Alex Captain'
			}
		});
		mocks.service.saveDraft.mockResolvedValue({ id: 'message-1' });
		mocks.service.deleteDraft.mockResolvedValue({ deleted: true });
		mocks.service.sendDraft.mockResolvedValue({
			id: 'message-1',
			channel: 'email',
			status: 'sent',
			subject: 'League update',
			recipientGroupCount: 0,
			editorJson: { type: 'doc', content: [] },
			bodyHtml: '<p>Hello</p>',
			bodyText: 'Hello',
			recipientCount: 2,
			createdAt: '2029-01-01T00:00:00.000Z',
			updatedAt: '2029-01-01T00:00:00.000Z',
			sentAt: '2029-01-02T00:00:00.000Z',
			createdByName: 'Admin User',
			recipientGroupSummary: 'Captains',
			failureMessage: null,
			recipientGroups: [],
			manualRecipients: [],
			recipients: []
		});
		mocks.dbOps.communications.getMessageDetail.mockResolvedValue({
			id: 'message-1',
			channel: 'email',
			status: 'draft',
			subject: 'League update',
			recipientGroupCount: 0,
			editorJson: { type: 'doc', content: [] },
			bodyHtml: '<p>Hello</p>',
			bodyText: 'Hello',
			recipientCount: 2,
			createdAt: '2029-01-01T00:00:00.000Z',
			updatedAt: '2029-01-01T00:00:00.000Z',
			sentAt: null,
			createdByName: 'Admin User',
			recipientGroupSummary: 'Captains',
			failureMessage: null,
			recipientGroups: [],
			manualRecipients: [],
			recipients: []
		});
		mocks.dbOps.communications.duplicateMessage.mockResolvedValue({ id: 'message-copy-1' });
	});

	it('rejects invalid preview payloads', async () => {
		// preview requests should fail fast when the recipient-group payload is malformed.
		const response = await previewAudience(
			buildEvent({
				path: '/api/communications/preview',
				method: 'POST',
				body: { recipientGroups: [{ nope: true }] }
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.success).toBe(false);
		expect(mocks.service.previewRecipientGroup).not.toHaveBeenCalled();
	});

	it('returns stored recipient-group summaries and the final preview payload', async () => {
		// the ui depends on the server-normalized recipient-group summaries, not the raw client labels.
		const response = await previewAudience(
			buildEvent({
				path: '/api/communications/preview',
				method: 'POST',
				body: {
					manualRecipients: [],
					recipientGroups: [
						{
							id: 'recipient-group-1',
							mode: 'include',
							filters: {
								memberQuery: 'captain',
								memberRole: '',
								memberSex: '',
								seasonId: '',
								offeringId: '',
								leagueId: '',
								divisionId: '',
								teamId: '',
								rosterRole: '',
								teamStatus: ''
							}
						}
					]
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.data.messagePreview.totalCount).toBe(2);
		expect(payload.data.recipientGroups[0].summaryText).toBe('Search: "captain"');
	});

	it('returns canonical org members for manual recipient resolution', async () => {
		// typed tokens should normalize to a single saved member record before they become draft chips.
		const response = await resolveManualRecipients(
			buildEvent({
				path: '/api/communications/recipients/resolve',
				method: 'POST',
				body: { queries: ['alex@playims.test'] }
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.data.manualRecipients).toEqual([
			{
				userId: 'user-1',
				email: 'alex@playims.test',
				fullName: 'Alex Captain'
			}
		]);
	});

	it('returns suggestions when a manual recipient query has multiple matches', async () => {
		// the input should be able to offer condensed choices for ambiguous names instead of only showing an error toast.
		mocks.service.searchManualRecipientMatches.mockResolvedValueOnce({
			status: 'ambiguous',
			query: 'harvanchik',
			suggestions: [
				{
					userId: 'user-4',
					email: 'jake@playims.test',
					fullName: 'Jake Harvanchik'
				},
				{
					userId: 'user-5',
					email: 'jamie.harvanchik@playims.test',
					fullName: 'Jamie Harvanchik'
				}
			]
		});

		const response = await resolveManualRecipients(
			buildEvent({
				path: '/api/communications/recipients/resolve',
				method: 'POST',
				body: { queries: ['harvanchik'] }
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.data.status).toBe('ambiguous');
		expect(payload.data.suggestions).toHaveLength(2);
	});

	it('requires a subject and at least one recipient source before saving a draft', async () => {
		// draft validation should stay server-enforced so the api remains trustworthy.
		const response = await createDraft(
			buildEvent({
				path: '/api/communications',
				method: 'POST',
				body: {
					subject: ' ',
					editorJson: null,
					bodyHtml: '<p>Hello</p>',
					manualRecipients: [],
					recipientGroups: []
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.fieldErrors.subject).toBeDefined();
		expect(mocks.service.saveDraft).not.toHaveBeenCalled();
	});

	it('creates and updates drafts through the communication service', async () => {
		// create and update share the same save path, but the update route should inject the message id.
		const createResponse = await createDraft(
			buildEvent({
				path: '/api/communications',
				method: 'POST',
				body: {
					subject: 'League update',
					editorJson: { type: 'doc', content: [] },
					bodyHtml: '<p>Hello</p>',
					manualRecipients: [],
					recipientGroups: [
						{
							id: 'recipient-group-1',
							mode: 'include',
							filters: {
								memberQuery: '',
								memberRole: '',
								memberSex: '',
								seasonId: '',
								offeringId: '',
								leagueId: '',
								divisionId: '',
								teamId: '',
								rosterRole: '',
								teamStatus: ''
							}
						}
					]
				}
			})
		);
		const createPayload = await createResponse.json();

		const updateResponse = await updateDraft(
			buildEvent({
				path: '/api/communications/message-1',
				method: 'PATCH',
				messageId: 'message-1',
				body: {
					subject: 'League update',
					editorJson: { type: 'doc', content: [] },
					bodyHtml: '<p>Hello again</p>',
					manualRecipients: [
						{
							email: 'alex@playims.test',
							fullName: 'Alex Captain'
						}
					],
					recipientGroups: [
						{
							id: 'recipient-group-1',
							mode: 'include',
							filters: {
								memberQuery: '',
								memberRole: '',
								memberSex: '',
								seasonId: '',
								offeringId: '',
								leagueId: '',
								divisionId: '',
								teamId: '',
								rosterRole: '',
								teamStatus: ''
							}
						}
					]
				}
			})
		);
		const updatePayload = await updateResponse.json();

		expect(createResponse.status).toBe(200);
		expect(createPayload.data.messageId).toBe('message-1');
		expect(updateResponse.status).toBe(200);
		expect(updatePayload.data.messageId).toBe('message-1');
		expect(mocks.service.saveDraft).toHaveBeenCalledTimes(2);
	});

	it('deletes drafts through the communication service', async () => {
		// delete should stay draft-only and route through the same server-side communication boundary.
		const response = await deleteDraft(
			buildEvent({
				path: '/api/communications/message-1',
				method: 'DELETE',
				messageId: 'message-1'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(mocks.service.deleteDraft).toHaveBeenCalledWith({
			clientId: 'client-1',
			messageId: 'message-1'
		});
	});

	it('returns refreshed detail when sending a draft', async () => {
		// send responses should give the page the new status immediately for history refresh.
		const response = await sendDraft(
			buildEvent({
				path: '/api/communications/message-1/send',
				method: 'POST',
				messageId: 'message-1'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.data.status).toBe('sent');
		expect(mocks.service.sendDraft).toHaveBeenCalledWith({
			clientId: 'client-1',
			userId: 'user-1',
			messageId: 'message-1'
		});
	});

	it('returns the new draft id when duplicating a message', async () => {
		// duplication is the reuse path for sent or failed messages in the history board.
		const response = await duplicateDraft(
			buildEvent({
				path: '/api/communications/message-1/duplicate',
				method: 'POST',
				messageId: 'message-1'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.data.messageId).toBe('message-copy-1');
	});

	it('blocks participant callers from mutating communication routes', async () => {
		// route handlers should still protect writes even if a caller somehow bypasses the outer hook.
		const response = await createDraft(
			buildEvent({
				path: '/api/communications',
				method: 'POST',
				role: 'participant',
				body: {
					subject: 'League update',
					editorJson: { type: 'doc', content: [] },
					bodyHtml: '<p>Hello</p>',
					manualRecipients: [
						{
							email: 'alex@playims.test',
							fullName: 'Alex Captain'
						}
					],
					recipientGroups: [
						{
							id: 'recipient-group-1',
							mode: 'include',
							filters: {
								memberQuery: '',
								memberRole: '',
								memberSex: '',
								seasonId: '',
								offeringId: '',
								leagueId: '',
								divisionId: '',
								teamId: '',
								rosterRole: '',
								teamStatus: ''
							}
						}
					]
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.success).toBe(false);
		expect(mocks.service.saveDraft).not.toHaveBeenCalled();
	});

	it('returns 404 when the selected message detail is missing', async () => {
		// the ui should get a clear not-found response when history links reference stale ids.
		mocks.dbOps.communications.getMessageDetail.mockResolvedValueOnce(null);

		const response = await getMessageDetail(
			buildEvent({
				path: '/api/communications/message-9',
				method: 'GET',
				messageId: 'message-9'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(404);
		expect(payload.error).toBe('Communication message not found.');
	});
});
