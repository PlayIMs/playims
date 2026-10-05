/*
Brief description:
These tests verify selection and confirmation when saving over an existing branding theme.

Deeper explanation:
Selecting a saved theme must only prepare an overwrite. The database save happens after the
user confirms, and canceling confirmation must keep the save dialog available.

Summary of tests:
1. It characterizes confirmation for a typed existing theme name.
2. It checks that selecting a saved theme prepares confirmation without saving.
3. It checks that confirming replaces the selected theme with its original name.
4. It checks that the save dialog renders the selection list, color swatches, and last saved date.
5. It verifies that API timestamps are retained for the last saved date.
*/
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync('src/routes/dashboard/settings/branding/+page.svelte', 'utf8');

function setup() {
	// execute the route's real handlers so tests cannot drift away from the live save flow.
	const start = source.indexOf('\tfunction openSaveModal()');
	const end = source.indexOf('\tasync function handleLoadTheme(', start);
	const handlers = ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2022 });
	const save = vi.fn().mockResolvedValue('saved-id');
	const api = new Function(
		'saveCurrentTheme',
		`
		const $savedThemes = [{name: 'First'}, {name: 'Second'}];
		const MAX_BRANDING_THEMES = 3;
		let showSaveModal = true, showReplaceModal = false, showOverwriteModal = false;
		let themeNameInput = '', replaceThemeIndex = null, existingThemeIndex = null;
		${handlers}
		return {
			typeName: (name) => { themeNameInput = name; },
			save: handleSaveTheme,
			select: typeof selectSavedTheme === 'function' ? selectSavedTheme : undefined,
			confirm: handleOverwriteTheme,
			state: () => ({themeNameInput, existingThemeIndex, showSaveModal, showOverwriteModal})
		};
	`
	)(save);
	return { api, save };
}

describe('saved theme selection', () => {
	it('requests confirmation for a typed existing theme name', async () => {
		const { api, save } = setup();
		api.typeName('Second');
		await api.save();
		expect(api.state()).toEqual({
			themeNameInput: 'Second',
			existingThemeIndex: 1,
			showSaveModal: false,
			showOverwriteModal: true
		});
		expect(save).not.toHaveBeenCalled();
	});
	it('selects a saved theme without writing until confirmation', () => {
		const { api, save } = setup();
		api.select(1);
		expect(api.state()).toEqual({
			themeNameInput: 'Second',
			existingThemeIndex: 1,
			showSaveModal: false,
			showOverwriteModal: true
		});
		expect(save).not.toHaveBeenCalled();
	});
	it('overwrites the selected theme after confirmation', async () => {
		const { api, save } = setup();
		api.select(1);
		await api.confirm();
		// the index and original name prevent creating a duplicate theme instead of replacing it.
		expect(save).toHaveBeenCalledWith('Second', 1);
		expect(api.state().showSaveModal).toBe(false);
		expect(api.state().showOverwriteModal).toBe(false);
	});
	it('retains the latest saved timestamp from the api', () => {
		// exercise the mapper directly to protect the timestamp passed to the browser list.
		const themeSource = readFileSync('src/lib/theme.ts', 'utf8');
		const start = themeSource.indexOf('function mapRecordToSavedTheme(');
		const end = themeSource.indexOf('function canUseThemeApiFromCurrentPath', start);
		const mapper = new Function(
			'mapRecordToColors',
			ts.transpile(themeSource.slice(start, end)) + '; return mapRecordToSavedTheme;'
		)(() => ({}));
		expect(
			mapper({ id: 'one', name: 'Example', createdAt: '2026-01-01', updatedAt: '2026-10-04' })
				.updatedAt
		).toBe('2026-10-04');
	});

	it('renders selectable saved themes beneath the name field', () => {
		const dialog = source.slice(
			source.indexOf('{#if showSaveModal}'),
			source.indexOf('{#if showOverwriteModal}')
		);
		expect(dialog).toContain('onclick={() => selectSavedTheme(index)}');
		expect(dialog).toContain('Saved Themes');
		expect(dialog).toContain('getSavedThemeColorHex(theme.colors, colorName');
		expect(dialog).toContain('theme.updatedAt ?? theme.createdAt');
		expect(dialog.indexOf('Saved Themes')).toBeGreaterThan(dialog.indexOf('id="theme-name-input"'));
	});
});
