/*
Brief description:
This file verifies the recipient builder helper logic that drives live preview behavior.

Deeper explanation:
The recipient builder now updates its preview automatically while the user edits filters, but it
still needs to keep a clean separation between "preview this in-progress change" and "save this
recipient group into the draft list." These tests lock down that decision-making so future UI
changes do not accidentally save unfinished filters or omit them from the preview.

Summary of tests:
1. It verifies that an empty new recipient-group form does not change the preview request payload.
2. It verifies that a new in-progress recipient group is appended to the preview payload.
3. It verifies that editing an existing recipient group replaces that group in the preview payload.
4. It verifies that saved recipient groups sort includes before excludes without reshuffling peers.
5. It verifies that the additional placeholder filters are present and disabled until they are wired.
*/

import { describe, expect, it } from 'vitest';

import {
	buildRecipientBuilderPreviewRequestGroups,
	hasMeaningfulRecipientGroupFilters,
	orderRecipientBuilderGroups,
	RECIPIENT_BUILDER_ADDITIONAL_FILTERS
} from '../../src/lib/communications/recipient-builder.js';
import {
	EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER,
	type CommunicationRecipientGroupDraft,
	type CommunicationRecipientGroupFilter
} from '../../src/lib/communications/types.js';

const buildFilters = (
	overrides: Partial<CommunicationRecipientGroupFilter> = {}
): CommunicationRecipientGroupFilter => ({
	...EMPTY_COMMUNICATION_RECIPIENT_GROUP_FILTER,
	...overrides
});

const buildRecipientGroup = (
	overrides: Partial<CommunicationRecipientGroupDraft> = {}
): CommunicationRecipientGroupDraft => ({
	id: 'group-1',
	mode: 'include',
	filters: buildFilters({ teamId: 'team-1' }),
	summaryText: 'Team 1',
	resolvedRecipientCount: 12,
	...overrides
});

describe('recipient builder helper', () => {
	it('keeps the preview payload unchanged for an empty new form', () => {
		// this protects the default open state from previewing "all members" before the user adds filters.
		const draftRecipientGroups = [buildRecipientGroup()];

		const previewGroups = buildRecipientBuilderPreviewRequestGroups({
			draftRecipientGroups,
			recipientGroupForm: {
				id: null,
				mode: 'include',
				filters: buildFilters()
			}
		});

		expect(previewGroups).toHaveLength(1);
		expect(previewGroups[0]?.id).toBe('group-1');
	});

	it('adds an unsaved new group to the live preview payload', () => {
		// this gives the user instant preview feedback without silently saving the new group.
		const previewGroups = buildRecipientBuilderPreviewRequestGroups({
			draftRecipientGroups: [buildRecipientGroup()],
			recipientGroupForm: {
				id: null,
				mode: 'exclude',
				filters: buildFilters({ memberRole: 'manager' })
			}
		});

		expect(previewGroups).toHaveLength(2);
		expect(previewGroups[1]).toMatchObject({
			id: '__recipient-preview-draft__',
			mode: 'exclude',
			filters: { memberRole: 'manager' }
		});
	});

	it('replaces the edited group in the live preview payload', () => {
		// this keeps the preview aligned with what the user is editing, not the older saved draft values.
		const previewGroups = buildRecipientBuilderPreviewRequestGroups({
			draftRecipientGroups: [
				buildRecipientGroup(),
				buildRecipientGroup({
					id: 'group-2',
					filters: buildFilters({ seasonId: 'season-1' }),
					summaryText: 'Season 1'
				})
			],
			recipientGroupForm: {
				id: 'group-1',
				mode: 'exclude',
				filters: buildFilters({ teamStatus: 'waitlist' })
			}
		});

		expect(previewGroups).toHaveLength(2);
		expect(previewGroups[0]).toMatchObject({
			id: 'group-1',
			mode: 'exclude',
			filters: { teamStatus: 'waitlist' }
		});
		expect(previewGroups[1]?.id).toBe('group-2');
	});

	it('sorts saved recipient groups with includes before excludes', () => {
		// this keeps the saved-groups panel easier to scan without losing stable order inside each mode.
		const orderedGroups = orderRecipientBuilderGroups([
			buildRecipientGroup({
				id: 'exclude-1',
				mode: 'exclude',
				summaryText: 'Exclude Team A'
			}),
			buildRecipientGroup({
				id: 'include-1',
				mode: 'include',
				summaryText: 'Include Team B'
			}),
			buildRecipientGroup({
				id: 'exclude-2',
				mode: 'exclude',
				summaryText: 'Exclude Team C'
			}),
			buildRecipientGroup({
				id: 'include-2',
				mode: 'include',
				summaryText: 'Include Team D'
			})
		]);

		expect(orderedGroups.map((group) => group.id)).toEqual([
			'include-1',
			'include-2',
			'exclude-1',
			'exclude-2'
		]);
	});

	it('keeps the placeholder additional filters visible but disabled', () => {
		// this ensures the UI can expose the requested filter list now without implying unsupported behavior.
		expect(RECIPIENT_BUILDER_ADDITIONAL_FILTERS.map((filter) => filter.label)).toEqual([
			'User Status',
			'Classification',
			'Suspended Status',
			'Team Approval',
			'Team Payment',
			'Player Payment',
			'Team Player Req',
			'Team in Playoffs',
			'Game Date/Time',
			'Player Eligibility',
			'SSO Player Eligibility',
			'Forms',
			'Quizzes',
			'Invitations'
		]);
		expect(
			RECIPIENT_BUILDER_ADDITIONAL_FILTERS.every(
				(filter) =>
					filter.disabled &&
					filter.options.length === 1 &&
					filter.options[0]?.label === 'Not available yet'
			)
		).toBe(true);
		expect(hasMeaningfulRecipientGroupFilters(buildFilters())).toBe(false);
		expect(hasMeaningfulRecipientGroupFilters(buildFilters({ memberRole: 'manager' }))).toBe(true);
	});
});
