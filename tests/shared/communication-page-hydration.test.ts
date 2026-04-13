/*
Brief description:
This file verifies communication page hydration signatures.

Deeper explanation:
The communications page copies server-loaded message data into local editor state. These tests protect
the helper that decides when the page should hydrate from server data again, so local UI edits like
typing or toggling filters do not accidentally retrigger the whole composer initialization flow.

Summary of tests:
1. It verifies that the same server payload produces the same hydration signature.
2. It verifies that selected-message changes produce a different hydration signature.
3. It verifies that lazily loaded filter options only affect the signature after they are marked loaded.
*/

import { describe, expect, it } from 'vitest';

import { buildCommunicationPageHydrationSignature } from '../../src/lib/communications/page-hydration';

describe('communication page hydration signature', () => {
	it('returns the same signature for the same server payload', () => {
		// the page initializer should be idempotent when the incoming load data did not change.
		const input = {
			messages: [
				{
					id: 'message-1',
					channel: 'email' as const,
					status: 'draft' as const,
					subject: 'League update',
					recipientGroupCount: 1,
					recipientCount: 12,
					createdAt: '2029-01-01T00:00:00.000Z',
					updatedAt: '2029-01-01T00:00:00.000Z',
					scheduledAt: null,
					sentAt: null,
					createdByName: 'Admin User',
					recipientGroupSummary: 'Captains',
					failureMessage: null
				}
			],
			selectedMessage: null,
			filterOptionsLoaded: false
		};

		expect(buildCommunicationPageHydrationSignature(input)).toBe(
			buildCommunicationPageHydrationSignature(input)
		);
	});

	it('changes when the selected message changes', () => {
		// switching drafts should definitely rehydrate the composer because the editor payload changed.
		const base = {
			messages: [],
			filterOptionsLoaded: false
		};

		expect(
			buildCommunicationPageHydrationSignature({
				...base,
				selectedMessage: null
			})
		).not.toBe(
			buildCommunicationPageHydrationSignature({
				...base,
				selectedMessage: {
					id: 'message-1',
					channel: 'email',
					status: 'draft',
					subject: 'League update',
					recipientGroupCount: 1,
					editorJson: { type: 'doc', content: [] },
					bodyHtml: '<p>Hello</p>',
					bodyText: 'Hello',
					recipientCount: 12,
					createdAt: '2029-01-01T00:00:00.000Z',
					updatedAt: '2029-01-01T00:00:00.000Z',
					scheduledAt: null,
					sentAt: null,
					createdByName: 'Admin User',
					recipientGroupSummary: 'Captains',
					failureMessage: null,
					recipientGroups: [],
					manualRecipients: [],
					recipients: []
				}
			})
		);
	});

	it('ignores filter options until they are marked loaded', () => {
		// lazy-loaded recipient filters should not cause a rehydrate loop until the page intentionally adopts them.
		const unloadedWithOptions = buildCommunicationPageHydrationSignature({
			messages: [],
			selectedMessage: null,
			filterOptionsLoaded: false,
			filterOptions: {
				memberRoles: [{ value: '', label: 'All Roles' }],
				memberSexes: [],
				rosterRoles: [],
				teamStatuses: [],
				seasons: [{ value: 'season-1', label: 'Spring 2029' }],
				offerings: [],
				leagues: [],
				divisions: [],
				teams: []
			}
		});

		const unloadedWithoutOptions = buildCommunicationPageHydrationSignature({
			messages: [],
			selectedMessage: null,
			filterOptionsLoaded: false
		});

		const loadedWithOptions = buildCommunicationPageHydrationSignature({
			messages: [],
			selectedMessage: null,
			filterOptionsLoaded: true,
			filterOptions: {
				memberRoles: [{ value: '', label: 'All Roles' }],
				memberSexes: [],
				rosterRoles: [],
				teamStatuses: [],
				seasons: [{ value: 'season-1', label: 'Spring 2029' }],
				offerings: [],
				leagues: [],
				divisions: [],
				teams: []
			}
		});

		expect(unloadedWithOptions).toBe(unloadedWithoutOptions);
		expect(loadedWithOptions).not.toBe(unloadedWithoutOptions);
	});
});
