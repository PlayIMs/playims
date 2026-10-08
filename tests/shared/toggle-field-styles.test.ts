/*
Brief description:
This file protects consistent ToggleField sizing and borders.

Deeper explanation:
Toggle rows reuse the shared control styles rather than copying their own padding and border colors.
These small integration checks prevent the New Season wizard from returning to oversized cards.

Summary of tests:
1. It verifies toggles inherit the same minimum height and border tokens as other controls.
2. It verifies the live season wizard uses ToggleField and retains its keyboard handler.
3. It verifies migrated forms no longer bypass the shared toggle component.
*/
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('shared toggle field styles', () => {
	it('inherits common field dimensions and framing', () => {
		const css = readFileSync('src/app.css', 'utf8');
		const component = readFileSync('src/lib/components/ToggleField.svelte', 'utf8');
		// shared selectors mean future border and sizing changes update both kinds of control.
		expect(css).toMatch(
			/button\.select-secondary,\s*\.toggle-field-secondary\s*\{\s*width: 100%;[\s\S]*?border: 2px solid var\(--playims-control-border\)/
		);
		expect(css).toMatch(
			/button\.select-secondary,\s*\.toggle-field-secondary\s*\{\s*min-height: 2\.5rem/
		);
		expect(component).toContain("fieldClass = 'toggle-field-secondary flex w-full gap-2'");
	});
	it('uses the shared toggle rather than independent season card styles', () => {
		const route = readFileSync('src/routes/dashboard/offerings/+page.svelte', 'utf8');
		expect(route).toMatch(/<ToggleField\s+id="season-is-current"/);
		expect(route).toMatch(/<ToggleField\s+id="season-is-active"/);
		// preserving reverse tab keeps the existing date-to-toggle focus order intact.
		expect(route).toContain('onkeydown={focusCreateSeasonEndDateOnReverseTab}');
		expect(route).toContain('statusText={getSeasonToggleStatus(');
	});
	it('keeps the label above a separate state value and preserves input events', () => {
		const component = readFileSync('src/lib/components/ToggleField.svelte', 'utf8');
		expect(component).toMatch(/<label[^>]*>\{label\}<\/label>[\s\S]*?<input/);
		expect(component).toContain('statusText ?? getToggleStatus(checked, onLabel, offLabel)');
		expect(component).toContain('checked = $bindable()');
		expect(component).toContain('{onchange}');
		expect(component).toContain("dispatch('change', { checked: nextChecked })");
	});
	it.each([
		'src/routes/dashboard/offerings/+page.svelte',
		'src/routes/dashboard/offerings/[seasonSlug]/[offeringSlug]/+page.svelte',
		'src/routes/dashboard/clubs/+page.svelte',
		'src/routes/dashboard/facilities/_wizards/CreateFacilityWizard.svelte',
		'src/routes/dashboard/schedule/_wizards/CreateEventWizard.svelte',
		'src/routes/dashboard/account/_wizards/ManageOrganizationWizard.svelte',
		'src/lib/components/communications/CommunicationRichEditor.svelte'
	])('uses shared toggle fields in %s', (path) => {
		// checking each live consumer prevents a copied control from drifting away again.
		const source = readFileSync(path, 'utf8');
		expect(source).toContain('<ToggleField');
		expect(source).not.toContain('class="toggle-secondary"');
	});
});
