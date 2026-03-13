/*
Brief description:
This file verifies how facility creation payloads are cleaned and validated before route logic runs.

Deeper explanation:
Facility creation accepts a nested payload with one facility and many areas. That shape makes it easy
for subtle validation bugs to hide inside preprocessing. These tests focus on the schema's cleanup
behavior and its request-level uniqueness checks so the API does not store messy slugs or conflicting
areas.

Summary of tests:
1. It verifies that slugs are normalized and optional text is trimmed into clean values.
2. It verifies that duplicate area names and slugs are rejected within the same request.
*/

import { describe, expect, it } from 'vitest';
import { createFacilityWithAreasSchema } from '../../src/lib/server/facilities-validation';

describe('facilities validation', () => {
	it('normalizes slugs and trims optional text values', () => {
		// parse is used because this payload should succeed and we want the cleaned result back.
		// this verifies the "cleanup before save" contract, not just pass-or-fail validation.
		const parsed = createFacilityWithAreasSchema.parse({
			facility: {
				name: 'Main Gym',
				slug: '  Main Gym  ',
				description: '  ',
				addressLine1: ' 123 Main St ',
				addressLine2: ' ',
				city: ' Oxford ',
				state: ' MS ',
				postalCode: ' 38655 ',
				country: ' USA ',
				timezone: ' America/Chicago ',
				isActive: true,
				capacity: 250
			},
			areas: [
				{
					name: 'Court A',
					slug: ' Court A ',
					description: ' ',
					isActive: true,
					capacity: 50
				}
			]
		});

		expect(parsed.facility.slug).toBe('main-gym');
		expect(parsed.facility.description).toBeNull();
		expect(parsed.facility.addressLine1).toBe('123 Main St');
		expect(parsed.areas[0]?.slug).toBe('court-a');
		expect(parsed.areas[0]?.description).toBeNull();
	});

	it('rejects duplicate area names and slugs within one request', () => {
		// safe parse is better here because duplicate detection is expected to fail and we want to
		// inspect the issue list instead of throwing immediately.
		const parsed = createFacilityWithAreasSchema.safeParse({
			facility: {
				name: 'Main Gym',
				slug: 'main-gym',
				description: null,
				addressLine1: null,
				addressLine2: null,
				city: null,
				state: null,
				postalCode: null,
				country: null,
				timezone: null,
				isActive: true,
				capacity: null
			},
			areas: [
				{
					name: 'Court A',
					slug: 'court-a',
					description: null,
					isActive: true,
					capacity: null
				},
				{
					name: ' court a ',
					slug: 'court-a',
					description: null,
					isActive: true,
					capacity: null
				}
			]
		});

		expect(parsed.success).toBe(false);
		// converting issues into path:message strings makes the failure contract easier to read and
		// keeps the assertions stable even if zod includes extra metadata we do not care about.
		const messages = parsed.success
			? []
			: parsed.error.issues.map((issue) => `${issue.path.join('.')}:${issue.message}`);
		expect(messages).toContain('areas.1.name:Area name must be unique within this request.');
		expect(messages).toContain('areas.1.slug:Area slug must be unique within this request.');
	});
});
