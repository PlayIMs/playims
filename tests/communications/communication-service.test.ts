/*
Brief description:
This file verifies the communication audience resolver and send workflow service.

Deeper explanation:
The communication center depends on two risky branches: resolving recipients across overlapping
member/team filters, and transitioning a draft into a sent or failed message through the provider
adapter. These tests keep that behavior explicit so future UI or storage changes do not quietly
change who receives a message or how failures are recorded.

Summary of tests:
1. It verifies that include-only recipient groups can resolve recipients from member and roster filters.
2. It verifies that exclude recipient groups remove overlapping recipients while preserving deduped includes.
3. It verifies that users without email addresses are excluded from previews.
4. It verifies that manual recipients can be resolved by email, phone number, or member name.
5. It verifies that ambiguous manual recipient queries return a condensed suggestion list with last active season labels.
6. It verifies that saving a new draft persists the editor content, recipient groups, manual recipients, and resolved recipients.
7. It verifies that updating an existing draft rewrites the draft body and recipient resolution in place.
8. It verifies that deleting a draft only succeeds for draft messages.
9. It verifies that sending rejects drafts with too many recipients at once.
10. It verifies that sending a draft marks the message as sent through the provider adapter.
11. It verifies that provider failures mark the message as failed.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
	CommunicationMessageDetail
} from '../../src/lib/communications/types.js';
import {
	EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER,
	type CommunicationRecipientGroupDraft,
	type CommunicationRecipientGroupFilter
} from '../../src/lib/communications/types.js';
import {
	CommunicationService,
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
	cellPhone: '(555) 111-2222',
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
	seasonStartDate: '2029-03-01',
	seasonEndDate: '2029-05-31',
	seasonIsCurrent: 0,
	isCaptain: 1,
	isCoCaptain: 0,
	rosterStatus: 'active',
	...overrides
});

const buildFilters = (
	overrides: Partial<CommunicationRecipientGroupFilter>
): CommunicationRecipientGroupFilter => ({
	...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER,
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
				cellPhone: '(555) 333-4444',
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
				cellPhone: null,
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
			recipientGroupCount: 0,
			editorJson: { type: 'doc', content: [] },
			bodyHtml: '<p>Hello captains.</p>',
			bodyText: 'Hello captains.',
			recipientCount: 2,
			createdAt: '2029-01-01T00:00:00.000Z',
			updatedAt: '2029-01-01T00:00:00.000Z',
			sentAt: null,
			createdByName: 'Admin User',
			recipientGroupSummary: 'Captains',
			failureMessage: null,
			recipientGroups: [],
			manualRecipients: [],
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
			deleteDraft: vi.fn(),
			replaceRecipientGroups: vi.fn(),
			replaceManualRecipients: vi.fn(),
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
		// one player matches both include recipient groups, and the exclude group should still remove them once.
		const recipientGroups: CommunicationRecipientGroupDraft[] = [
			{
				id: 'recipient-group-1',
				mode: 'include',
				filters: buildFilters({ teamId: 'team-a' }),
				summaryText: 'Team A',
				resolvedRecipientCount: 2
			},
			{
				id: 'recipient-group-2',
				mode: 'include',
				filters: buildFilters({ memberSex: 'F' }),
				summaryText: 'Women',
				resolvedRecipientCount: 1
			},
			{
				id: 'recipient-group-3',
				mode: 'exclude',
				filters: buildFilters({ memberSex: 'F' }),
				summaryText: 'Exclude women',
				resolvedRecipientCount: 1
			}
		];

		const preview = await service.previewAudience({
			clientId: 'client-1',
			recipientGroups
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

	it('resolves manual recipients by email, phone number, or unique member name', async () => {
		// manual recipient chips should normalize to the same canonical org member whether typed as email, phone, or name.
		await expect(
			service.resolveManualRecipients({
				clientId: 'client-1',
				manualRecipients: [
					{
						email: 'alex@playims.test',
						fullName: 'alex@playims.test'
					},
					{
						email: '(555) 333-4444',
						fullName: '(555) 333-4444'
					},
					{
						email: 'Alex Captain',
						fullName: 'Alex Captain'
					}
				]
			})
		).resolves.toEqual([
			{
				userId: 'user-1',
				email: 'alex@playims.test',
				fullName: 'Alex Captain'
			},
			{
				userId: 'user-2',
				email: 'jamie@playims.test',
				fullName: 'Jamie Player'
			}
		]);
	});

	it('returns suggestions when multiple members match a manual recipient query', async () => {
		// ambiguous free-text queries should offer choices instead of failing the input flow outright.
		audienceRows.push(
			buildAudienceRow({
				userId: 'user-4',
				membershipId: 'membership-4',
				email: 'jake@playims.test',
				firstName: 'Jake',
				lastName: 'Harvanchik',
				seasonId: 'season-b',
				seasonName: 'Fall 2029',
				teamId: null,
				teamName: null,
				divisionId: null,
				divisionName: null,
				leagueId: null,
				leagueName: null,
				offeringId: null,
				offeringName: null,
				isCaptain: 0,
				isCoCaptain: 0
			}),
			buildAudienceRow({
				userId: 'user-5',
				membershipId: 'membership-5',
				email: 'jamie.harvanchik@playims.test',
				firstName: 'Jamie',
				lastName: 'Harvanchik',
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
		);

		await expect(
			service.searchManualRecipientMatches({
				clientId: 'client-1',
				query: 'harvanchik'
			})
		).resolves.toEqual({
			status: 'ambiguous',
			query: 'harvanchik',
			suggestions: [
				{
					userId: 'user-4',
					email: 'jake@playims.test',
					fullName: 'Jake Harvanchik',
					lastActiveSeasonName: 'Fall 2029'
				},
				{
					userId: 'user-5',
					email: 'jamie.harvanchik@playims.test',
					fullName: 'Jamie Harvanchik',
					lastActiveSeasonName: null
				}
			]
		});
	});

	it('persists a new draft with the rich editor payload, recipient groups, manual recipients, and resolved recipients', async () => {
		// this protects the main save path so drafts reopen with the same formatting and audience rules.
		(storage.createDraft as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'message-new' });

		const recipientGroups: CommunicationRecipientGroupDraft[] = [
			{
				id: 'recipient-group-1',
				mode: 'include',
				filters: buildFilters({ teamId: 'team-a' }),
				summaryText: 'Team A',
				resolvedRecipientCount: 0
			}
		];
		const editorJson = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Playoffs start tonight.' }]
				}
			]
		};

		const result = await service.saveDraft({
			clientId: 'client-1',
			userId: 'user-admin',
			payload: {
				subject: 'Playoffs update',
				editorJson,
				bodyHtml: '<p>Playoffs start <strong>tonight</strong>.</p>',
				manualRecipients: [
					{
						userId: null,
						email: 'jamie@playims.test',
						fullName: 'jamie@playims.test'
					}
				],
				recipientGroups: recipientGroups.map((group) => ({
					id: group.id,
					mode: group.mode,
					filters: group.filters
				}))
			},
			filterOptions: {
				memberRoles: [{ value: '', label: 'All Roles' }],
				memberSexes: [{ value: '', label: 'All Sexes' }],
				rosterRoles: [{ value: '', label: 'Any roster role' }],
				teamStatuses: [{ value: '', label: 'Any team status' }],
				seasons: [],
				offerings: [],
				leagues: [],
				divisions: [],
				teams: [{ value: 'team-a', label: 'Wildcats', divisionId: 'division-a' }]
			}
		});

		expect(result).toEqual({ id: 'message-new' });
		expect(storage.createDraft).toHaveBeenCalledWith({
			clientId: 'client-1',
			subject: 'Playoffs update',
			editorJson: JSON.stringify(editorJson),
			bodyHtml: '<p>Playoffs start <strong>tonight</strong>.</p>',
			bodyText: 'Playoffs start tonight .',
			createdUser: 'user-admin',
			updatedUser: 'user-admin'
		});
		expect(storage.replaceRecipientGroups).toHaveBeenCalledWith({
			messageId: 'message-new',
			recipientGroups: [
				expect.objectContaining({
					id: 'recipient-group-1',
					mode: 'include',
					filters: expect.objectContaining({ teamId: 'team-a' }),
					summaryText: 'Wildcats'
				})
			]
		});
		expect(storage.replaceManualRecipients).toHaveBeenCalledWith({
			messageId: 'message-new',
			manualRecipients: [
				{
					userId: 'user-2',
					email: 'jamie@playims.test',
					fullName: 'Jamie Player'
				}
			]
		});
		expect(storage.replaceRecipients).toHaveBeenCalledWith({
			messageId: 'message-new',
			recipients: [
				expect.objectContaining({
					userId: 'user-1',
					email: 'alex@playims.test'
				}),
				expect.objectContaining({
					userId: 'user-2',
					email: 'jamie@playims.test'
				})
			]
		});
	});

	it('updates an existing draft instead of creating a second draft record', async () => {
		// this keeps "continue editing draft" behavior tied to the same message history entry.
		(storage.updateDraft as ReturnType<typeof vi.fn>).mockResolvedValue(true);

		const result = await service.saveDraft({
			clientId: 'client-1',
			userId: 'user-admin',
			payload: {
				messageId: 'message-1',
				subject: 'Updated playoffs update',
				editorJson: { type: 'doc', content: [] },
				bodyHtml: '<p>Updated body</p>',
				manualRecipients: [],
				recipientGroups: [
					{
						id: 'recipient-group-2',
						mode: 'include',
						filters: buildFilters({ memberSex: 'F' })
					}
				]
			},
			filterOptions: {
				memberRoles: [{ value: '', label: 'All Roles' }],
				memberSexes: [{ value: 'F', label: 'Female' }, { value: '', label: 'All Sexes' }],
				rosterRoles: [{ value: '', label: 'Any roster role' }],
				teamStatuses: [{ value: '', label: 'Any team status' }],
				seasons: [],
				offerings: [],
				leagues: [],
				divisions: [],
				teams: []
			}
		});

		expect(result).toEqual({ id: 'message-1' });
		expect(storage.updateDraft).toHaveBeenCalledWith({
			clientId: 'client-1',
			messageId: 'message-1',
			subject: 'Updated playoffs update',
			editorJson: JSON.stringify({ type: 'doc', content: [] }),
			bodyHtml: '<p>Updated body</p>',
			bodyText: 'Updated body',
			updatedUser: 'user-admin'
		});
		expect(storage.createDraft).not.toHaveBeenCalled();
		expect(storage.replaceRecipients).toHaveBeenCalledWith({
			messageId: 'message-1',
			recipients: [expect.objectContaining({ email: 'jamie@playims.test' })]
		});
	});

	it('deletes draft messages and rejects non-draft deletes', async () => {
		// deletion should stay limited to true drafts so history records cannot be removed by mistake.
		(storage.deleteDraft as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

		await expect(
			service.deleteDraft({
				clientId: 'client-1',
				messageId: 'message-1'
			})
		).resolves.toEqual({ deleted: true });

		(storage.getMessageDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			...detail,
			status: 'sent'
		});

		await expect(
			service.deleteDraft({
				clientId: 'client-1',
				messageId: 'message-1'
			})
		).rejects.toThrow(/only draft messages can be deleted/i);
	});

	it('rejects sends that target too many recipients at once', async () => {
		// this caps blast radius if someone tries to fan out a single message too aggressively.
		(storage.getMessageDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			...detail,
			recipientCount: 501,
			recipients: Array.from({ length: 501 }, (_, index) => ({
				userId: `user-${index + 1}`,
				email: `user-${index + 1}@playims.test`,
				fullName: `User ${index + 1}`,
				resolutionMetadata: null
			}))
		});

		await expect(
			service.sendDraft({
				clientId: 'client-1',
				userId: 'user-admin',
				messageId: 'message-1'
			})
		).rejects.toThrow(/too many recipients/i);

		expect(sendMessageMock).not.toHaveBeenCalled();
		expect(storage.markMessageSending).not.toHaveBeenCalled();
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
