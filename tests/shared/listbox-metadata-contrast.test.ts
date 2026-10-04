/*
Brief description:
These tests protect the muted navigation counts against unreadable dropdown hover colors.

Deeper explanation:
A selected option normally has a primary background, but pointer hover changes it to neutral.
An inherited CSS variable lets the counts follow that surface instead of selection alone.
These checks protect the stylesheet wiring, not browser-rendered contrast measurements.

Summary of tests:
1. Neutral rows and pointer interactions use the neutral muted text token.
2. Selected rows use the contrast-aware primary muted text token.
3. Navigation counts consume the inherited row token through the shared metadata class.
*/
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app.css', 'utf8').replace(/\r\n/g, '\n');
const metadata = readFileSync(
	'src/lib/components/navigation/NavigationOptionMetadata.svelte',
	'utf8'
);

function declarations(selector: string): string {
	// exact selectors distinguish hover rules from selected-row defaults.
	const start = css.indexOf(`${selector} {`);
	expect(start).toBeGreaterThanOrEqual(0);
	return css.slice(start, css.indexOf('}', start));
}

describe('dropdown metadata contrast', () => {
	it('matches the muted text token to the row surface, including selected hover', () => {
		for (const selector of [
			'.listbox-dropdown-option',
			'button.listbox-dropdown-option:active:not(:disabled)'
		]) {
			expect(declarations(selector)).toContain('--listbox-option-muted: var(--color-neutral-700)');
		}
		// hover and pressed share one rule, which outranks the selected class in the cascade.
		expect(css).toContain(
			'button.listbox-dropdown-option:hover:not(:disabled),\n\tbutton.listbox-dropdown-option:active:not(:disabled)'
		);
		for (const selector of [
			'.listbox-dropdown-option-selected',
			'.listbox-dropdown-option-selected-active'
		]) {
			expect(declarations(selector)).toContain(
				'--listbox-option-muted: var(--color-primary-foreground-muted)'
			);
		}
		expect(declarations('.listbox-dropdown-option-muted')).toContain(
			'color: var(--listbox-option-muted, var(--color-neutral-700))'
		);
		expect(metadata).toContain('class="listbox-dropdown-option-muted ');
	});
});
