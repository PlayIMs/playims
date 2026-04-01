/*
Brief description:
This file verifies the communication center API routes.

Deeper explanation:
These routes coordinate draft validation, audience previews, selected-message reads, send execution,
and duplication. The tests mock the communication service boundary so each route can be checked for
authorization, validation, and payload shape without depending on the rich editor or D1 queries.

Summary of tests:
1. It verifies that invalid preview payloads are rejected.
2. It verifies that preview requests return stored batch summaries and recipient previews.
3. It verifies that creating a draft requires a subject and at least one batch.
4. It verifies that creating and updating drafts call the communication service.
5. It verifies that sending a draft returns the refreshed message detail.
6. It verifies that duplicate requests return the new draft id.
7. It verifies that message detail fetches return 404 when the draft is missing.
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
		previewBatch: vi.fn(),
		previewAudience: vi.fn(),
		saveDraft: vi.fn(),
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
import {
	GET as getMessageDetail,
	PATCH as updateDraft
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
		mocks.service.previewBatch.mockResolvedValue({
			preview: {
				totalCount: 2,
				rows: []
			},
			storedBatch: {
				id: 'batch-1',
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
		mocks.service.saveDraft.mockResolvedValue({ id: 'message-1' });
		mocks.service.sendDraft.mockResolvedValue({
			id: 'message-1',
			channel: 'email',
			status: 'sent',
			subject: 'League update',
			editorJson: { type: 'doc', content: [] },
			bodyHtml: '<p>Hello</p>',
			bodyText: 'Hello',
			recipientCount: 2,
			createdAt: '2029-01-01T00:00:00.000Z',
			updatedAt: '2029-01-01T00:00:00.000Z',
			sentAt: '2029-01-02T00:00:00.000Z',
			createdByName: 'Admin User',
			batchSummary: 'Captains',
			failureMessage: null,
			batches: [],
			recipients: []
		});
		mocks.dbOps.communications.getMessageDetail.mockResolvedValue({
			id: 'message-1',
			channel: 'email',
			status: 'draft',
			subject: 'League update',
			editorJson: { type: 'doc', content: [] },
			bodyHtml: '<p>Hello</p>',
			bodyText: 'Hello',
			recipientCount: 2,
			createdAt: '2029-01-01T00:00:00.000Z',
			updatedAt: '2029-01-01T00:00:00.000Z',
			sentAt: null,
			createdByName: 'Admin User',
			batchSummary: 'Captains',
			failureMessage: null,
			batches: [],
			recipients: []
		});
		mocks.dbOps.communications.duplicateMessage.mockResolvedValue({ id: 'message-copy-1' });
	});

	it('rejects invalid preview payloads', async () => {
		// preview requests should fail fast when the batch payload is malformed.
		const response = await previewAudience(
			buildEvent({
				path: '/api/communications/preview',
				method: 'POST',
				body: { batches: [{ nope: true }] }
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.success).toBe(false);
		expect(mocks.service.previewBatch).not.toHaveBeenCalled();
	});

	it('returns stored batch summaries and the final preview payload', async () => {
		// the ui depends on the server-normalized batch summaries, not the raw client labels.
		const response = await previewAudience(
			buildEvent({
				path: '/api/communications/preview',
				method: 'POST',
				body: {
					batches: [
						{
							id: 'batch-1',
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
		expect(payload.data.batches[0].summaryText).toBe('Search: "captain"');
	});

	it('requires a subject and at least one batch before saving a draft', async () => {
		// draft validation should stay server-enforced so the api remains trustworthy.
		const response = await createDraft(
			buildEvent({
				path: '/api/communications',
				method: 'POST',
				body: {
					subject: ' ',
					editorJson: null,
					bodyHtml: '<p>Hello</p>',
					batches: []
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
					batches: [
						{
							id: 'batch-1',
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
					batches: [
						{
							id: 'batch-1',
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
