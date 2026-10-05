/*
Brief description:
These tests protect color picker coordinates, manual input, and preview persistence.

Deeper explanation:
Black has no recoverable saturation, so the picker must retain its horizontal coordinate.
Incomplete input must not change the preview, and previewing must not save browser colors.

Summary of tests:
1. It characterizes the existing HSL and hex conversion.
2. It checks bottom-row coordinates and validates editable hex and HSL values.
3. It verifies exact hex round trips and preview, cancellation, and commit persistence.
4. It checks that the branding route uses temporary previews and explicit commits.
*/
import { describe, expect, it, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { previewColor, updateColor, themeColors } from '../../src/lib/theme';
import { readFileSync } from 'node:fs';
import {
	hexToHsl,
	hslToHex,
	colorFromPosition,
	parsePickerHex,
	parsePickerHsl
} from '../../src/lib/color-picker';

describe('branding color picker', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('previews and cancels without changing committed colors or writing storage', () => {
		// a small document stub checks real css output without requiring a browser test runtime.
		const properties = new Map<string, string>();
		vi.stubGlobal('document', {
			documentElement: {
				style: { setProperty: (name: string, value: string) => properties.set(name, value) }
			}
		});
		const original = get(themeColors);
		previewColor('primary', '0000FF');
		expect(get(themeColors)).toEqual(original);
		expect(properties.get('--color-primary-500')).toBe('#0000FF');
		previewColor('primary', original.primary);
		expect(properties.get('--color-primary-500')).toBe('#' + original.primary);
	});
	it('commits and persists only when apply updates the color', () => {
		const write = vi.fn();
		// storage spies distinguish permanent changes from temporary css previews.
		vi.stubGlobal('window', {
			localStorage: { setItem: write },
			sessionStorage: { setItem: write }
		});
		vi.stubGlobal('document', {
			documentElement: { style: { setProperty: vi.fn() } },
			querySelector: () => ({ getAttribute: () => '', setAttribute: vi.fn() })
		});
		const original = get(themeColors);
		previewColor('primary', '0000FF');
		expect(write).not.toHaveBeenCalled();
		updateColor('primary', '0000FF');
		expect(get(themeColors).primary).toBe('0000FF');
		expect(write).toHaveBeenCalled();
		themeColors.set(original);
	});
	it('preserves exact manually entered hex colors through conversion', () => {
		const { h, s, l } = hexToHsl('14213E');
		expect(hslToHex(h, s, l)).toBe('14213E');
	});
	it('converts known colors', () => {
		expect(hexToHsl('FF0000')).toEqual({ h: 0, s: 100, l: 50 });
		expect(hslToHex(240, 100, 50)).toBe('0000FF');
	});
	it('retains the horizontal coordinate at black and clamps outside drags', () => {
		// black cannot encode the horizontal position, so it must be stored separately.
		expect(colorFromPosition(353, 78, 100)).toEqual({ h: 353, s: 0, l: 0, x: 78, y: 100 });
		expect(colorFromPosition(0, 120, -5)).toEqual({ h: 0, s: 100, l: 50, x: 100, y: 0 });
	});
	it('accepts complete hex values without accepting unfinished input', () => {
		expect(parsePickerHex('#14a')).toBe('1144AA');
		expect(parsePickerHex('14213e')).toBe('14213E');
		expect(parsePickerHex('#14')).toBeNull();
		expect(parsePickerHex('xyzxyz')).toBeNull();
	});
	it('accepts hsl input and rejects invalid ranges', () => {
		expect(parsePickerHsl('221°, 51%, 16%')).toEqual({ h: 221, s: 51, l: 16 });
		expect(parsePickerHsl('hsl(360, 100%, 50%)')).toEqual({ h: 0, s: 100, l: 50 });
		for (const text of ['221, 101%, 16%', '221, 51%,', '-1, 50%, 50%']) {
			expect(parsePickerHsl(text)).toBeNull();
		}
	});
	it('wires the live route to temporary previews and a separate apply action', () => {
		// this protects the integration path so tested helpers are used by the actual editor.
		const source = readFileSync('src/routes/dashboard/settings/branding/+page.svelte', 'utf8');
		expect(source).toContain('colorFromPosition(');
		expect(source).toContain('previewColor(openPicker, hex)');
		expect(source).toContain('previewColor(openPicker, pickerOriginalColor)');
		expect(source).toContain('onclick={applyColorPicker}');
		expect(source).toContain('oninput={handlePickerHexInput}');
		expect(source).toContain('oninput={handlePickerHslInput}');
	});
});
