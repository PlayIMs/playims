/*
Brief description:
This file verifies the public home page does not expose deployment internals.

Deeper explanation:
The landing page is intentionally public, so it should not reveal runtime details such as database
names or environment labels. Those values are helpful during local development, but exposing them to
anonymous users gives attackers extra context about the deployment and data plane.

Summary of tests:
1. It verifies that the public home page load does not return environment or database identifiers.
*/

import { describe, expect, it } from 'vitest';
import { load } from '../../src/routes/+page.server';

describe('public home page security', () => {
	it('does not expose environment or database details to anonymous visitors', async () => {
		// anonymous landing-page data should stay boring: no deployment names, no db names.
		const event = {
			locals: {},
			platform: {
				env: {
					DB: {}
				}
			}
		} as Parameters<typeof load>[0];

		const data = await load(event);

		expect(data).not.toHaveProperty('environment');
		expect(data).not.toHaveProperty('dbName');
		expect(data).not.toHaveProperty('isDevelopment');
	});
});
