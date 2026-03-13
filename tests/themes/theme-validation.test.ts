/*
Brief description:
This file verifies the schema rules behind theme payload validation.

Deeper explanation:
This file focuses on schema behavior, not route behavior. That matters because schemas are the first
safety gate for user input. If these rules change silently, the routes can start accepting bad data or
rejecting good data in confusing ways. These tests make the contract visible before any deeper server
work happens.

Summary of tests:
1. It verifies that color strings are normalized and missing neutral values fall back to an empty string.
2. It verifies that route params reject invalid theme ids.
3. It verifies that current-theme updates reject malformed color payloads.
*/

import { describe, expect, it } from 'vitest';
import {
	createSavedThemeSchema,
	themeIdParamSchema,
	updateCurrentThemeSchema
} from '../../src/lib/server/theme-validation';

describe('theme validation', () => {
	it('normalizes hex colors and defaults missing neutral to empty string', () => {
		// parse throws on failure, so using it here proves we expect this payload to be valid.
		// this test protects the data-cleaning behavior that keeps later database writes consistent.
		const parsed = createSavedThemeSchema.parse({
			name: 'Spring Theme',
			colors: {
				primary: '#aa00cc',
				secondary: '00ff11'
			}
		});

		expect(parsed).toEqual({
			name: 'Spring Theme',
			colors: {
				primary: 'AA00CC',
				secondary: '00FF11',
				neutral: ''
			}
		});
	});

	it('requires a valid UUID theme id param', () => {
		// safe parse is used instead of parse because this test wants to inspect a clean failure
		// result rather than throw an exception. that makes the test easier to read and maintain.
		const parsed = themeIdParamSchema.safeParse({ themeId: 'not-a-uuid' });

		expect(parsed.success).toBe(false);
	});

	it('rejects malformed current-theme payloads', () => {
		// this protects the route layer from bad colors reaching the database update path.
		// if this ever turns true unexpectedly, it means invalid color strings are slipping through.
		const parsed = updateCurrentThemeSchema.safeParse({
			colors: {
				primary: '#123456',
				secondary: 'bad-color'
			}
		});

		expect(parsed.success).toBe(false);
	});
});
