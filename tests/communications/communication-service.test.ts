/*
Brief description:
This file verifies the communication audience resolver and send workflow service.

Deeper explanation:
The communication center depends on two risky branches: resolving recipients across overlapping
member/team filters, and transitioning a draft into a sent or failed message through the provider
adapter. These tests keep that behavior explicit so future UI or storage changes do not quietly
change who receives a message or how failures are recorded.

Summary of tests:
1. It verifies that include-only batches can resolve recipients from member and roster filters.
2. It verifies that exclude batches remove overlapping recipients while preserving deduped includes.
3. It verifies that users without email addresses are excluded from previews.
4. It verifies that sending a draft marks the message as sent through the provider adapter.
5. It verifies that provider failures mark the message as failed.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
	CommunicationBatchDraft,
	CommunicationFilterOptions,
	CommunicationMessageDetail
} from '../../src/lib/communications/types.js';
import {
	EMPTY_COMMUNICATION_BATCH_FILTER,
	type CommunicationBatchFilter
} from '../../src/lib/communications/types.js';
import {
	CommunicationService,
	buildCommunicationFilterOptions,
	createRecipientPreview
} from '../../src/lib/server/communications/service.js';
import type { CommunicationEmailProvider } from '../../src/lib/server/communications/provider.js';
import type {
	CommunicationAudienceRow,
	CommunicationStoragePort
} from '../../src/lib/server/communications/types.js';

const buildAudienceRow = (
	overrides: Partial<CommunicationAudienceRow> = {}
): CommunicationAudienceRow => ({
	userId: 'user-1',
	membershipId: 'membership-1',
	email: 'alex@playims.test',
	firstName: 'Alex',
	lastName: 'Captain',
	studentId: '12345',
	memberRole: 'participant',
	memberSex: 'M',
	teamId: 'team-a',
	teamName: 'Wildcats',
	teamStatus: 'active',
	divisionId: 'division-a',
	divisionName: 'Division A',
	leagueId: 'league-a',
	leagueName: 'Basketball League',
	offeringId: 'offering-a',
	offeringName: 'Basketball',
	seasonId: 'season-a',
	seasonName: 'Spring 2029',
	isCaptain: 1,
	isCoCaptain: 0,
	rosterStatus: 'active',
	...overrides
});

const FILTER_OPTIONS: CommunicationFilterOptions = buildCommunicationFilterOptions({
	seasons: [{ id: 'season-a', name: 'Spring 2029' }],
	offerings: [{ id: 'offering-a', name: 'Basketball', seasonId: 'season-a' }],
	leagues: [
		{
			id: 'league-a',
			name: 'Basketball League',
			seasonId: 'season-a',
			offeringId: 'offering-a'
		}
	],
	divisions: [{ id: 'division-a', name: 'Division A', leagueId: 'league-a' }],
	teams: [{ id: 'team-a', name: 'Wildcats', divisionId: 'division-a' }]
});

const buildFilters = (overrides: Partial<CommunicationBatchFilter>): CommunicationBatchFilter => ({
	...EMPTY_COMMUNICATION_BATCH_FILTER,
	...overrides
});

describe('communication service', () => {
	let audienceRows: CommunicationAudienceRow[];
	let detail: CommunicationMessageDetail;
	let storage: CommunicationStoragePort;
	let emailProvider: CommunicationEmailProvider;
	let sendMessageMock: ReturnType<typeof vi.fn>;
	let service: CommunicationService;

	beforeEach(() => {
		// the default audience includes overlapping team rows and one member with no email.
		audienceRows = [
			buildAudienceRow(),
			buildAudienceRow({
				userId: 'user-1',
				membershipId: 'membership-1',
				email: 'alex@playims.test',
				teamId: 'team-b',
				teamName: 'Rockets',
				teamStatus: 'waitlist',
				divisionId: 'division-b',
				divisionName: 'Division B',
				isCaptain: 0,
				isCoCaptain: 1
			}),
			buildAudienceRow({
				userId: 'user-2',
				membershipId: 'membership-2',
				email: 'jamie@playims.test',
				firstName: 'Jamie',
				lastName: 'Player',
				memberSex: 'F',
				teamId: 'team-a',
				teamName: 'Wildcats',
				isCaptain: 0,
				isCoCaptain: 0
			}),
			buildAudienceRow({
				userId: 'user-3',
				membershipId: 'membership-3',
				email: ' ',
				firstName: 'No',
				lastName: 'Email',
				memberRole: 'manager',
				teamId: null,
				teamName: null,
				divisionId: null,
				divisionName: null,
				leagueId: null,
				leagueName: null,
				offeringId: null,
				offeringName: null,
				seasonId: null,
				seasonName: null,
				isCaptain: 0,
				isCoCaptain: 0
			})
		];

		detail = {
			id: 'message-1',
			channel: 'email',
			status: 'draft',
			subject: 'Playoffs update',
			editorJson: { type: 'doc', content: [] },
			bodyHtml: '<p>Hello captains.</p>',
			bodyText: 'Hello captains.',
			recipientCount: 2,
			createdAt: '2029-01-01T00:00:00.000Z',
			updatedAt: '2029-01-01T00:00:00.000Z',
			sentAt: null,
			createdByName: 'Admin User',
			batchSummary: 'Captains',
			failureMessage: null,
			batches: [],
			recipients: [
				{
					userId: 'user-1',
					email: 'alex@playims.test',
					fullName: 'Alex Captain',
					resolutionMetadata: null
				},
				{
					userId: 'user-2',
					email: 'jamie@playims.test',
					fullName: 'Jamie Player',
					resolutionMetadata: null
				}
			]
		};

		storage = {
			listMessageSummaries: vi.fn(),
			getMessageDetail: vi.fn().mockResolvedValue(detail),
			createDraft: vi.fn(),
			updateDraft: vi.fn(),
			replaceBatches: vi.fn(),
			replaceRecipients: vi.fn(),
			markMessageSending: vi.fn().mockResolvedValue(true),
			markMessageSent: vi.fn().mockResolvedValue(true),
			markMessageFailed: vi.fn().mockResolvedValue(true),
			duplicateMessage: vi.fn(),
			listAudienceRows: vi.fn().mockResolvedValue(audienceRows)
		};
		sendMessageMock = vi.fn().mockResolvedValue({ providerMessageId: 'resend-1' });
		emailProvider = {
			sendMessage: sendMessageMock as CommunicationEmailProvider['sendMessage']
		};
		service = new CommunicationService({
			storage,
			emailProvider
		});
	});

	it('resolves include-only previews from member and roster filters', () => {
		// this locks the core recipient matching path for typical captain-only communications.
		const preview = createRecipientPreview(audienceRows, buildFilters({ rosterRole: 'captain' }));

		expect(preview.totalCount).toBe(1);
		expect(preview.rows[0]).toMatchObject({
			userId: 'user-1',
			fullName: 'Alex Captain',
			email: 'alex@playims.test',
			rosterRole: 'captain'
		});
	});

	it('dedupes overlapping includes and removes excluded recipients', async () => {
		// one player matches both include batches, and the exclude batch should still remove them once.
		const batches: CommunicationBatchDraft[] = [
			{
				id: 'batch-1',
				mode: 'include',
				filters: buildFilters({ teamId: 'team-a' }),
				summaryText: 'Team A',
				resolvedRecipientCount: 2
			},
			{
				id: 'batch-2',
				mode: 'include',
				filters: buildFilters({ memberSex: 'F' }),
				summaryText: 'Women',
				resolvedRecipientCount: 1
			},
			{
				id: 'batch-3',
				mode: 'exclude',
				filters: buildFilters({ memberQuery: 'jamie' }),
				summaryText: 'Exclude Jamie',
				resolvedRecipientCount: 1
			}
		];

		const preview = await service.previewAudience({
			clientId: 'client-1',
			batches
		});

		expect(preview.totalCount).toBe(1);
		expect(preview.rows.map((row) => row.email)).toEqual(['alex@playims.test']);
	});

	it('excludes recipients without an email address from previews', () => {
		// the base audience must stay deliverable, so blank-email rows should never leak into results.
		const preview = createRecipientPreview(audienceRows, buildFilters({ memberRole: 'manager' }));

		expect(preview.totalCount).toBe(0);
		expect(preview.rows).toEqual([]);
	});

	it('sends a draft through the provider adapter and marks it sent', async () => {
		// this keeps the message lifecycle aligned with the visible history status shown in the page.
		(storage.getMessageDetail as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(detail)
			.mockResolvedValueOnce({
				...detail,
				status: 'sent',
				sentAt: '2029-01-02T00:00:00.000Z'
			});

		const result = await service.sendDraft({
			clientId: 'client-1',
			userId: 'user-admin',
			messageId: 'message-1'
		});

		expect(sendMessageMock).toHaveBeenCalledWith({
			to: ['alex@playims.test', 'jamie@playims.test'],
			subject: 'Playoffs update',
			html: '<p>Hello captains.</p>',
			text: 'Hello captains.'
		});
		expect(storage.markMessageSending).toHaveBeenCalled();
		expect(storage.markMessageSent).toHaveBeenCalledWith({
			clientId: 'client-1',
			messageId: 'message-1',
			recipientCount: 2,
			providerMessageId: 'resend-1',
			updatedUser: 'user-admin'
		});
		expect(result.status).toBe('sent');
	});

	it('marks the draft failed when the provider rejects the send', async () => {
		// failures should be persisted so the history board can explain what happened to the user.
		sendMessageMock.mockRejectedValueOnce(new Error('Resend unavailable'));

		await expect(
			service.sendDraft({
				clientId: 'client-1',
				userId: 'user-admin',
				messageId: 'message-1'
			})
		).rejects.toThrow('Resend unavailable');

		expect(storage.markMessageFailed).toHaveBeenCalledWith({
			clientId: 'client-1',
			messageId: 'message-1',
			failureMessage: 'Resend unavailable',
			updatedUser: 'user-admin'
		});
	});
});
