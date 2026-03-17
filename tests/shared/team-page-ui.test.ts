/*
Brief description:
This file verifies helper behavior used by the team detail page UI.

Deeper explanation:
The team detail sidebar now derives compact roster counts and creates local-only chat messages. These
tests protect those helper rules so overview totals stay accurate and the temporary chat composer only
accepts meaningful input while preserving trimmed message content.

Summary of tests:
1. It verifies invitation-like statuses are counted as pending invitations.
2. It verifies mixed roster statuses produce separate player and pending totals.
3. It verifies chat message creation trims whitespace and fills default metadata.
4. It verifies blank chat input is ignored.
*/

import { describe, expect, it } from 'vitest';
import {
	createLocalChatMessage,
	isPendingInvitationStatus,
	summarizeTeamRosterCounts
} from '../../src/lib/team-page-ui';

describe('team page ui helpers', () => {
	it('treats pending and invited roster statuses as pending invitations', () => {
		// these status forms mirror normalized labels the team detail page receives from the server.
		expect(isPendingInvitationStatus('Pending Approval')).toBe(true);
		expect(isPendingInvitationStatus('Invited')).toBe(true);
		expect(isPendingInvitationStatus('active')).toBe(false);
	});

	it('separates total roster players from pending invitations', () => {
		// this protects the condensed overview counters shown in the team sidebar.
		expect(
			summarizeTeamRosterCounts(['Active', 'Captain', 'Invited', 'pending approval', 'Active'])
		).toEqual({
			totalRosterPlayers: 3,
			pendingInvitations: 2
		});
	});

	it('builds local chat messages with trimmed text and default sender metadata', () => {
		// this ensures local-only chat bubbles never render leading or trailing composer whitespace.
		const message = createLocalChatMessage('  hello team  ', {
			id: 'msg-1',
			createdAtIso: '2026-03-17T16:00:00.000Z'
		});

		expect(message).toEqual({
			id: 'msg-1',
			sender: 'You',
			text: 'hello team',
			createdAtIso: '2026-03-17T16:00:00.000Z'
		});
	});

	it('returns null for blank chat input', () => {
		// blank submits should not create visible local chat rows.
		expect(createLocalChatMessage('   ')).toBeNull();
	});
});
