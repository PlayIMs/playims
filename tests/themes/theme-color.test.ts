/*
Brief description:
This file verifies the shared helper that derives the browser chrome color from the active theme.

Deeper explanation:
Installed PWAs and browser tabs can use the document theme color before the app hydrates. That means
the server-rendered value must already match the active primary color, or the title bar flashes the
wrong brand color on refresh. These tests protect that small formatting rule directly.

Summary of tests:
1. It verifies that the active primary color becomes the theme-color hex value.
2. It verifies that missing theme input falls back to the default PlayIMs primary color.
3. It verifies that theme cache payloads are normalized when they are serialized.
4. It verifies that malformed cached theme payloads are ignored safely.
*/

import { describe, expect, it } from 'vitest';
import {
	buildThemeColorHex,
	parseStoredThemeColors,
	serializeThemeColors
} from '../../src/lib/theme';

describe('theme color helper', () => {
	it('formats the active primary color as a browser theme-color value', () => {
		// this locks in the exact color string used for browser chrome and installed pwa title bars.
		expect(
			buildThemeColorHex({
				primary: '4A90E2'
			})
		).toBe('#4A90E2');
	});

	it('falls back to the default primary color when no theme is available', () => {
		// this keeps server rendering resilient if a page loads before tenant theme data is available.
		expect(buildThemeColorHex(null)).toBe('#CE1126');
	});

	it('serializes the active theme into normalized cache data', () => {
		// this protects the refresh cache path that restores the last known good theme in the same app window.
		expect(
			serializeThemeColors({
				primary: '#4a90e2',
				secondary: '112233',
				neutral: '#abcdef'
			})
		).toBe('{"primary":"4A90E2","secondary":"112233","neutral":"ABCDEF"}');
	});

	it('ignores malformed cached theme payloads instead of reviving bad theme colors', () => {
		// this keeps corrupted session storage from forcing broken browser chrome colors on refresh.
		expect(parseStoredThemeColors('{"primary":"not-a-color"}')).toBeNull();
		expect(parseStoredThemeColors('not json')).toBeNull();
		expect(
			parseStoredThemeColors('{"primary":"4a90e2","secondary":"112233","neutral":""}')
		).toEqual({
			primary: '4A90E2',
			secondary: '112233',
			neutral: ''
		});
	});
});
