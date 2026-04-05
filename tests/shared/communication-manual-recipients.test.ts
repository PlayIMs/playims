/*
Brief description:
This file verifies the manual recipient chip helpers used by the communication composer.

Deeper explanation:
The manual recipient field accepts free-form typing, commits recipients on commas or Enter, and must
avoid duplicate chips when the same person is added multiple ways. These tests protect the small
helper layer that splits raw input and merges resolved recipients before the page updates its state.

Summary of tests:
1. It verifies that comma-separated input commits finished tokens while leaving the unfinished remainder in the input.
2. It verifies that resolved manual recipients dedupe by user id or email while preserving the first occurrence.
*/

import { describe, expect, it } from 'vitest';

import {
	mergeCommunicationManualRecipients,
	splitCommunicationManualRecipientInput
} from '../../src/lib/communications/manual-recipients';

describe('communication manual recipient helpers', () => {
	it('splits committed comma-separated tokens from the remaining input text', () => {
		// the chip input should commit finished values but keep the unfinished fragment editable.
		expect(splitCommunicationManualRecipientInput('Alex Captain, Jamie Player, Sam')).toEqual({
			tokens: ['Alex Captain', 'Jamie Player'],
			remainder: ' Sam'
		});

		expect(splitCommunicationManualRecipientInput('Alex Captain,\nJamie Player,')).toEqual({
			tokens: ['Alex Captain', 'Jamie Player'],
			remainder: ''
		});
	});

	it('dedupes merged recipients by user id or email', () => {
		// this prevents the same member from appearing twice when typed by name once and by email later.
		expect(
			mergeCommunicationManualRecipients(
				[
					{
						userId: 'user-1',
						email: 'alex@playims.test',
						fullName: 'Alex Captain'
					}
				],
				[
					{
						userId: 'user-1',
						email: 'ALEX@playims.test',
						fullName: 'Alex Captain'
					},
					{
						userId: null,
						email: 'jamie@playims.test',
						fullName: 'Jamie Player'
					}
				]
			)
		).toEqual([
			{
				userId: 'user-1',
				email: 'alex@playims.test',
				fullName: 'Alex Captain'
			},
			{
				userId: null,
				email: 'jamie@playims.test',
				fullName: 'Jamie Player'
			}
		]);
	});
});
