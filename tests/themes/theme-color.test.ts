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
5. It verifies that persisted browser theme-color values are normalized independently of the full theme payload.
6. It verifies that the standalone PWA chrome prefers the live org theme while the current org theme is active.
7. It verifies that the standalone PWA chrome falls back to persisted colors during startup fallback paths.
*/

import { describe, expect, it } from 'vitest';
import {
	buildThemeColorHex,
	parseStoredThemeColors,
	parseStoredThemeColorHex,
	resolveStandalonePwaChromePrimary,
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

	it('normalizes persisted browser theme-color values without requiring a full theme object', () => {
		// this protects the blocking app.html script, which reads one dedicated color value before
		// svelte hydration has loaded the complete theme store.
		expect(parseStoredThemeColorHex('#4a90e2')).toBe('4A90E2');
		expect(parseStoredThemeColorHex('4A90E2')).toBe('4A90E2');
		expect(parseStoredThemeColorHex('not-a-color')).toBeNull();
	});

	it('prefers the live org theme for standalone chrome when the current org theme is active', () => {
		// this protects the installed url bar from getting stuck on its old color after branding
		// changes, because the live theme store should win once the current org theme is loaded.
		expect(
			resolveStandalonePwaChromePrimary({
				themeSource: 'db',
				liveThemePrimary: '4A90E2',
				initialThemePrimary: 'CE1126',
				persistedBrowserThemeColor: '123456',
				persistedThemePrimary: '654321',
				initialPwaChromePrimary: 'CE1126'
			})
		).toBe('4A90E2');
	});

	it('falls back to persisted browser chrome color during startup fallback paths', () => {
		// this keeps refresh and client-switch startup stable before the app has confirmed the
		// current org theme from the database again.
		expect(
			resolveStandalonePwaChromePrimary({
				themeSource: 'fallback',
				liveThemePrimary: '4A90E2',
				initialThemePrimary: 'CE1126',
				persistedBrowserThemeColor: '#123456',
				persistedThemePrimary: '654321',
				initialPwaChromePrimary: 'CE1126'
			})
		).toBe('123456');
	});
});
