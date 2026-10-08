/*
Brief description:
This file verifies the shared cursor treatment for slug-revert buttons.

Deeper explanation:
The shared class keeps enabled buttons clickable-looking without suggesting disabled buttons work.
The live season wizard must use that class to inherit future shared style changes.

Summary of tests:
1. It verifies enabled and disabled cursor rules and the season wizard's integration.
*/
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('shares enabled and disabled cursor styles with the live slug-revert button', () => {
	const css = readFileSync('src/app.css', 'utf8');
	const route = readFileSync('src/routes/dashboard/offerings/+page.svelte', 'utf8');
	// the explicit shared class avoids coupling presentation to translated accessibility text.
	expect(css).toMatch(/\.slug-revert-button:not\(:disabled\)\s*\{\s*cursor: pointer/);
	expect(css).toMatch(/\.slug-revert-button:disabled\s*\{\s*cursor: not-allowed/);
	expect(route).toMatch(
		/class="slug-revert-button [^"]*"\s+aria-label="Revert season slug to default"/
	);
});
