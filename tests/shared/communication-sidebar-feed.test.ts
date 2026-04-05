/*
Brief description:
This file verifies the bucketing and ordering rules for the communications sidebar feed.

Deeper explanation:
The communications page now groups messages into separate draft, scheduled, and history views in
the right-side panel. These tests protect the classification and sorting contract so drafts stay
editable and recent, scheduled items stay chronological, and sent history still appears in newest-
first order.

Summary of tests:
1. It verifies that messages are classified into draft, scheduled, and history buckets.
2. It verifies that scheduled messages are sorted by their scheduled time.
3. It verifies that draft and history items are sorted from most recent to oldest using sent, updated, then created dates.
*/

import { describe, expect, it } from 'vitest';

import {
	buildCommunicationSidebarFeed,
	getCommunicationHistoryAt,
	getCommunicationScheduledAt,
	getCommunicationSidebarItemKind
} from '../../src/lib/communications/sidebar-feed';
import type { CommunicationMessageSummary } from '../../src/lib/communications/types';

function createMessage(
	overrides: Partial<CommunicationMessageSummary> & Pick<CommunicationMessageSummary, 'id' | 'subject'>
): CommunicationMessageSummary {
	return {
		id: overrides.id,
		channel: 'email',
		status: overrides.status ?? 'draft',
		subject: overrides.subject,
		recipientGroupCount: overrides.recipientGroupCount ?? 0,
		recipientCount: overrides.recipientCount ?? 0,
		createdAt: overrides.createdAt ?? '2026-04-01T10:00:00.000Z',
		updatedAt: overrides.updatedAt ?? '2026-04-01T10:00:00.000Z',
		scheduledAt: overrides.scheduledAt ?? null,
		sentAt: overrides.sentAt ?? null,
		createdByName: overrides.createdByName ?? 'Alex Manager',
		recipientGroupSummary: overrides.recipientGroupSummary ?? 'All members',
		failureMessage: overrides.failureMessage ?? null
	};
}

describe('communication sidebar feed helpers', () => {
	it('classifies messages into draft, scheduled, and history buckets', () => {
		// the right rail tabs depend on a stable bucket for each message summary.
		const messages = [
			createMessage({
				id: 'draft-1',
				subject: 'Working draft',
				status: 'draft'
			}),
			createMessage({
				id: 'history-1',
				subject: 'Already sent',
				status: 'sent',
				sentAt: '2026-04-03T18:30:00.000Z'
			}),
			createMessage({
				id: 'scheduled-2',
				subject: 'Tomorrow reminder',
				status: 'scheduled',
				scheduledAt: '2026-04-06T09:00:00.000Z'
			}),
			createMessage({
				id: 'scheduled-1',
				subject: 'Tonight reminder',
				status: 'scheduled',
				scheduledAt: '2026-04-05T19:00:00.000Z'
			})
		];

		expect(getCommunicationSidebarItemKind(messages[0]!, new Date('2026-04-04T12:00:00.000Z'))).toBe(
			'draft'
		);
		expect(getCommunicationSidebarItemKind(messages[1]!, new Date('2026-04-04T12:00:00.000Z'))).toBe(
			'history'
		);
		expect(getCommunicationSidebarItemKind(messages[2]!, new Date('2026-04-04T12:00:00.000Z'))).toBe(
			'scheduled'
		);
	});

	it('sorts scheduled messages by their scheduled time', () => {
		// scheduled items should stay chronological so the next pending send is always easiest to find.
		const messages = [
			createMessage({
				id: 'scheduled-2',
				subject: 'Tomorrow reminder',
				status: 'scheduled',
				scheduledAt: '2026-04-06T09:00:00.000Z'
			}),
			createMessage({
				id: 'scheduled-1',
				subject: 'Tonight reminder',
				status: 'scheduled',
				scheduledAt: '2026-04-05T19:00:00.000Z'
			})
		];

		const feed = buildCommunicationSidebarFeed(messages, new Date('2026-04-04T12:00:00.000Z'));

		expect(feed.map((item) => `${item.kind}:${item.message.id}`)).toEqual([
			'scheduled:scheduled-1',
			'scheduled:scheduled-2'
		]);
		expect(getCommunicationScheduledAt(feed[0]!.message)).toBe('2026-04-05T19:00:00.000Z');
	});

	it('sorts draft and history items from newest to oldest using the best available timestamp', () => {
		// draft and history tabs should both feel recent-first even though they use different statuses.
		const messages = [
			createMessage({
				id: 'draft-latest',
				subject: 'Fresh draft',
				status: 'draft',
				updatedAt: '2026-04-04T15:00:00.000Z'
			}),
			createMessage({
				id: 'sent-middle',
				subject: 'Sent update',
				status: 'sent',
				sentAt: '2026-04-04T11:00:00.000Z',
				updatedAt: '2026-04-04T11:05:00.000Z'
			}),
			createMessage({
				id: 'failed-oldest',
				subject: 'Failed notice',
				status: 'failed',
				updatedAt: '2026-04-02T09:00:00.000Z',
				createdAt: '2026-04-02T08:30:00.000Z'
			})
		];

		const feed = buildCommunicationSidebarFeed(messages, new Date('2026-04-04T12:00:00.000Z'));

		expect(feed.map((item) => item.message.id)).toEqual([
			'draft-latest',
			'sent-middle',
			'failed-oldest'
		]);
		expect(getCommunicationHistoryAt(feed[0]!.message)).toBe('2026-04-04T15:00:00.000Z');
		expect(getCommunicationHistoryAt(feed[1]!.message)).toBe('2026-04-04T11:00:00.000Z');
	});
});
