import { writable, get } from 'svelte/store';

// default zinc palette (tailwind css zinc colors)
export const ZINC_PALETTE: Record<string, string> = {
	'05': 'FEFEFE',
	'25': 'FDFDFD',
	'50': 'FAFAFA',
	'100': 'F4F4F5',
	'200': 'E4E4E7',
	'300': 'D4D4D8',
	'400': 'A1A1AA',
	'500': '71717A',
	'600': '52525B',
	'700': '3F3F46',
	'800': '27272A',
	'900': '18181B',
	'950': '09090B'
};

// default hex values (without #)
export const DEFAULT_THEME = {
	primary: 'CE1126',
	secondary: '14213D',
	neutral: 'F5ECE5'
} as const;

export const STANDALONE_PWA_FALLBACK_PRIMARY = DEFAULT_THEME.primary;

export type ThemeColors = {
	primary: string;
	secondary: string;
	neutral: string; // empty string means use zinc default
};

type SavedTheme = {
	id: string;
	name: string;
	colors: ThemeColors;
	createdAt: string;
};

type ThemeRecord = {
	id: string;
	clientId?: string;
	name: string;
	slug: string;
	primary: string;
	secondary: string;
	neutral: string;
	createdAt: string;
	updatedAt?: string;
	createdUser?: string;
	updatedUser?: string;
};

type ThemeApiResponse<T> = {
	success: boolean;
	data: T;
	error?: string;
};

type ThemeFetchResult = {
	theme: ThemeColors | null;
	notModified: boolean;
};

type Rgb = {
	r: number;
	g: number;
	b: number;
};

export type ThemeSurfaceTextTokens = {
	foreground: string;
	foregroundShade: '05' | '950';
	muted: string;
	mutedShade: '05' | '50' | '900' | '950';
};

const MAX_SAVED_THEMES = 15;
const API_BASE = '/api/themes';
export const CURRENT_THEME_STORAGE_KEY = 'playims:current-theme';
export const BROWSER_THEME_COLOR_STORAGE_KEY = 'playims:theme-color';
export const CURRENT_THEME_COOKIE_KEY = 'playims-current-theme';
const HEX_COLOR_PATTERN = /^[0-9A-F]{6}$/;
const WCAG_AA_NORMAL_TEXT_CONTRAST = 4.5;
const CORE_FILLED_SURFACE_SHADES = ['400', '500', '600'] as const;
let currentThemeETag: string | null = null;
const THEME_API_PROTECTED_PREFIXES = ['/dashboard', '/schedule', '/colors'];
let themeStoreSubscriptionInitialized = false;

// store the current theme in memory for immediate use
export const themeColors = writable<ThemeColors>(DEFAULT_THEME);
// store the list of saved themes for the editor ui
export const savedThemes = writable<SavedTheme[]>([]);

/** converts a hex string to a normalised uppercase hex string without '#'. */
const normalizeHex = (hex: string) => hex.replace('#', '').toUpperCase();

/** converts hex to full hex with '#'. */
export function formatHex(hex: string): string {
	const cleanHex = normalizeHex(hex);
	return `#${cleanHex}`;
}

/** returns the browser chrome color that should match the active primary theme color. */
export function buildThemeColorHex(colors: Pick<ThemeColors, 'primary'> | null | undefined): string {
	return formatHex(generatePalette(colors?.primary || DEFAULT_THEME.primary)['600']);
}

type StandalonePwaChromePrimaryInput = {
	themeSource: 'db' | 'fallback' | undefined;
	liveThemePrimary?: string | null;
	initialThemePrimary?: string | null;
	persistedBrowserThemeColor?: string | null;
	persistedThemePrimary?: string | null;
	initialPwaChromePrimary?: string | null;
};

/** resolves the custom installed-pwa chrome color from the best available source. */
export function resolveStandalonePwaChromePrimary(
	input: StandalonePwaChromePrimaryInput
): string {
	if (input.themeSource === 'db') {
		return normalizeHex(
			input.liveThemePrimary ?? input.initialThemePrimary ?? input.initialPwaChromePrimary ?? DEFAULT_THEME.primary
		);
	}

	return (
		parseStoredThemeColorHex(input.persistedBrowserThemeColor) ??
		parseStoredThemeColorHex(input.persistedThemePrimary) ??
		parseStoredThemeColorHex(input.initialPwaChromePrimary) ??
		DEFAULT_THEME.primary
	);
}

/** parses a persisted browser theme-color value without throwing on malformed input. */
export function parseStoredThemeColorHex(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const normalized = normalizeHex(value);
	return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
}

/** serializes theme colors so the active theme can survive a same-window refresh. */
export function serializeThemeColors(colors: ThemeColors): string {
	return JSON.stringify({
		primary: normalizeHex(colors.primary),
		secondary: normalizeHex(colors.secondary),
		neutral: colors.neutral ? normalizeHex(colors.neutral) : ''
	});
}

/** parses a stored theme payload and ignores malformed values instead of throwing. */
export function parseStoredThemeColors(value: string | null | undefined): ThemeColors | null {
	if (!value) {
		return null;
	}

	try {
		const parsed = JSON.parse(value) as {
			primary?: unknown;
			secondary?: unknown;
			neutral?: unknown;
		};
		const primary =
			typeof parsed.primary === 'string' ? normalizeHex(parsed.primary) : '';
		const secondary =
			typeof parsed.secondary === 'string' ? normalizeHex(parsed.secondary) : '';
		const neutral =
			typeof parsed.neutral === 'string' ? normalizeHex(parsed.neutral) : '';

		if (!HEX_COLOR_PATTERN.test(primary) || !HEX_COLOR_PATTERN.test(secondary)) {
			return null;
		}

		if (neutral !== '' && !HEX_COLOR_PATTERN.test(neutral)) {
			return null;
		}

		return {
			primary,
			secondary,
			neutral
		};
	} catch {
		return null;
	}
}

/** reads the most recently persisted theme from browser storage. */
export function readPersistedThemeColors(): ThemeColors | null {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		const localTheme = parseStoredThemeColors(
			window.localStorage.getItem(CURRENT_THEME_STORAGE_KEY)
		);
		if (localTheme) {
			return localTheme;
		}
	} catch {
		// ignore local storage failures and fall through to session storage
	}

	try {
		return parseStoredThemeColors(window.sessionStorage.getItem(CURRENT_THEME_STORAGE_KEY));
	} catch {
		return null;
	}
}

/** reads the dedicated browser chrome theme-color from storage. */
export function readPersistedBrowserThemeColor(): string | null {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		const localColor = parseStoredThemeColorHex(
			window.localStorage.getItem(BROWSER_THEME_COLOR_STORAGE_KEY)
		);
		if (localColor) {
			return localColor;
		}
	} catch {
		// ignore local storage failures and fall through to session storage
	}

	try {
		return parseStoredThemeColorHex(
			window.sessionStorage.getItem(BROWSER_THEME_COLOR_STORAGE_KEY)
		);
	} catch {
		return null;
	}
}

/** converts hex to rgb. */
function hexToRgb(hex: string): Rgb {
	const cleanHex = normalizeHex(hex);
	const r = parseInt(cleanHex.substring(0, 2), 16);
	const g = parseInt(cleanHex.substring(2, 4), 16);
	const b = parseInt(cleanHex.substring(4, 6), 16);
	return { r, g, b };
}

/** converts rgb to hex (without '#'). */
function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (c: number) => {
		const hex = Math.round(c).toString(16);
		return hex.length === 1 ? `0${hex}` : hex;
	};
	return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** mixes two rgb colors by weight (0-1). */
function mixRgb(color: Rgb, mixColor: Rgb, weight: number): Rgb {
	return {
		r: color.r + (mixColor.r - color.r) * weight,
		g: color.g + (mixColor.g - color.g) * weight,
		b: color.b + (mixColor.b - color.b) * weight
	};
}

/** converts rgb to hsl. */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		l: Math.round(l * 100)
	};
}

/** calculates relative luminance for wcag contrast. */
function getLuminance(r: number, g: number, b: number): number {
	const [rs, gs, bs] = [r, g, b].map((val) => {
		const normalized = val / 255;
		return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** calculates the wcag contrast ratio between two hex colors. */
export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
	const foreground = hexToRgb(foregroundHex);
	const background = hexToRgb(backgroundHex);
	const foregroundLuminance = getLuminance(foreground.r, foreground.g, foreground.b);
	const backgroundLuminance = getLuminance(background.r, background.g, background.b);
	const lighter = Math.max(foregroundLuminance, backgroundLuminance);
	const darker = Math.min(foregroundLuminance, backgroundLuminance);

	return (lighter + 0.05) / (darker + 0.05);
}

/** generates a full 05-950 palette for a base color (no '#'). */
export function generatePalette(baseHex: string): Record<string, string> {
	const base = hexToRgb(baseHex);
	const white = { r: 255, g: 255, b: 255 };
	const black = { r: 0, g: 0, b: 0 };
	const cleanBaseHex = normalizeHex(baseHex);
	// helper to convert a mixed rgb value to hex
	const toHex = (rgb: Rgb) => rgbToHex(rgb.r, rgb.g, rgb.b);
	// helper to mix the base with a target color
	const mixWith = (target: Rgb, weight: number) => mixRgb(base, target, weight);

	return {
		'05': toHex(mixWith(white, 0.975)),
		'25': toHex(mixWith(white, 0.8625)),
		'50': toHex(mixWith(white, 0.75)),
		'100': toHex(mixWith(white, 0.6)),
		'200': toHex(mixWith(white, 0.4)),
		'300': toHex(mixWith(white, 0.25)),
		'400': toHex(mixWith(white, 0.1)),
		'500': cleanBaseHex,
		'600': toHex(mixWith(black, 0.1)),
		'700': toHex(mixWith(black, 0.2625)),
		'800': toHex(mixWith(black, 0.425)),
		'900': toHex(mixWith(black, 0.5875)),
		'950': toHex(mixWith(black, 0.75))
	};
}

function getMinimumShadeContrast(
	themeColorPalette: Record<string, string>,
	textShade: string,
	backgroundShades: readonly string[]
): number {
	const textHex = themeColorPalette[textShade];
	if (!textHex) {
		return 0;
	}

	return backgroundShades.reduce((lowestContrast, backgroundShade) => {
		const backgroundHex = themeColorPalette[backgroundShade];
		if (!backgroundHex) {
			return lowestContrast;
		}

		return Math.min(lowestContrast, getContrastRatio(textHex, backgroundHex));
	}, Number.POSITIVE_INFINITY);
}

function pickBestContrastShade(
	themeColorPalette: Record<string, string>,
	candidateShades: readonly string[],
	backgroundShades: readonly string[],
	minimumContrast = WCAG_AA_NORMAL_TEXT_CONTRAST
): string {
	const scoredCandidates = candidateShades
		.map((shade) => ({
			shade,
			minimumContrast: getMinimumShadeContrast(themeColorPalette, shade, backgroundShades)
		}))
		.sort((left, right) => {
			const leftPasses = left.minimumContrast >= minimumContrast ? 1 : 0;
			const rightPasses = right.minimumContrast >= minimumContrast ? 1 : 0;

			if (leftPasses !== rightPasses) {
				return rightPasses - leftPasses;
			}

			return right.minimumContrast - left.minimumContrast;
		});

	return scoredCandidates[0]?.shade ?? candidateShades[0] ?? '950';
}

/** resolves the semantic foreground tokens for filled theme surfaces using wcag contrast rules. */
export function resolveThemeSurfaceTextTokens(
	themeColorPalette: Record<string, string>,
	options?: {
		backgroundShades?: readonly string[];
		minimumContrast?: number;
	}
): ThemeSurfaceTextTokens {
	const backgroundShades = options?.backgroundShades ?? CORE_FILLED_SURFACE_SHADES;
	const minimumContrast = options?.minimumContrast ?? WCAG_AA_NORMAL_TEXT_CONTRAST;
	const foregroundShade = pickBestContrastShade(
		themeColorPalette,
		['05', '950'],
		backgroundShades,
		minimumContrast
	) as ThemeSurfaceTextTokens['foregroundShade'];
	const mutedShadeCandidates =
		foregroundShade === '950' ? (['900', '950'] as const) : (['50', '05'] as const);
	const mutedShade = pickBestContrastShade(
		themeColorPalette,
		mutedShadeCandidates,
		backgroundShades,
		minimumContrast
	) as ThemeSurfaceTextTokens['mutedShade'];

	return {
		foregroundShade,
		foreground: formatHex(themeColorPalette[foregroundShade] ?? themeColorPalette['950']),
		mutedShade,
		muted: formatHex(themeColorPalette[mutedShade] ?? themeColorPalette[foregroundShade])
	};
}

/** gets a readable text color from a palette based on background color. */
export function getReadableTextColor(
	backgroundColorHex: string,
	themeColorPalette: Record<string, string>
): string {
	const normalizedBackgroundHex = normalizeHex(backgroundColorHex);
	const shade =
		['05', '950']
			.map((candidateShade) => ({
				shade: candidateShade,
				contrast: getContrastRatio(themeColorPalette[candidateShade], normalizedBackgroundHex)
			}))
			.sort((left, right) => right.contrast - left.contrast)[0]?.shade ?? '950';
	const hexValue = themeColorPalette[shade] || themeColorPalette['500'];

	return formatHex(hexValue);
}

/** builds an rgb alpha string from a hex color for placeholders and overlays. */
export function buildHexAlphaColor(hex: string, alpha: number): string {
	const rgb = hexToRgb(hex);
	return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${alpha})`;
}

/** builds the full shared theme css variable map for server and client paint paths. */
export function buildThemeCssVariables(colors: ThemeColors): Record<string, string> {
	const primaryPalette = generatePalette(colors.primary);
	const secondaryPalette = generatePalette(colors.secondary);
	const neutralPalette =
		colors.neutral && colors.neutral.trim() !== '' ? generatePalette(colors.neutral) : ZINC_PALETTE;
	const primaryTextTokens = resolveThemeSurfaceTextTokens(primaryPalette);
	const secondaryTextTokens = resolveThemeSurfaceTextTokens(secondaryPalette);
	const cssVariables: Record<string, string> = {};

	for (const [shade, value] of Object.entries(primaryPalette)) {
		cssVariables[`--color-primary-${shade}`] = formatHex(value);
	}
	for (const [shade, value] of Object.entries(secondaryPalette)) {
		cssVariables[`--color-secondary-${shade}`] = formatHex(value);
	}
	for (const [shade, value] of Object.entries(neutralPalette)) {
		cssVariables[`--color-neutral-${shade}`] = formatHex(value);
	}

	cssVariables['--color-primary-foreground'] = primaryTextTokens.foreground;
	cssVariables['--color-primary-foreground-muted'] = primaryTextTokens.muted;
	cssVariables['--color-secondary-foreground'] = secondaryTextTokens.foreground;
	cssVariables['--color-secondary-foreground-muted'] = secondaryTextTokens.muted;

	return cssVariables;
}

/** validates that a color is not white, black, or grayscale. */
export function validateColorNotGrayscale(
	colorHex: string,
	colorName: 'primary' | 'secondary'
): { isValid: boolean; warnings: string[] } {
	const warnings: string[] = [];
	const cleanHex = normalizeHex(colorHex);
	const hexWithHash = `#${cleanHex}`;

	const rgb = hexToRgb(hexWithHash);
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

	// check if it's white
	const isWhite = rgb.r > 250 && rgb.g > 250 && rgb.b > 250;
	if (isWhite || hsl.l > 95) {
		warnings.push(
			`${colorName.charAt(0).toUpperCase() + colorName.slice(1)} color should not be white.`
		);
	}

	// check if it's black
	const isBlack = rgb.r < 5 && rgb.g < 5 && rgb.b < 5;
	if (isBlack || hsl.l < 5) {
		warnings.push(
			`${colorName.charAt(0).toUpperCase() + colorName.slice(1)} color should not be black.`
		);
	}

	// check if it's grayscale
	if (hsl.s < 15 && !isWhite && !isBlack) {
		warnings.push(
			`${colorName.charAt(0).toUpperCase() + colorName.slice(1)} color is too gray. Use a more vibrant color.`
		);
	}

	return {
		isValid: warnings.length === 0,
		warnings
	};
}

/** validates neutral color for a light, usable background. */
export function validateNeutral(neutralHex: string): { isValid: boolean; warnings: string[] } {
	const warnings: string[] = [];
	const cleanHex = normalizeHex(neutralHex);
	const hexWithHash = `#${cleanHex}`;

	const rgb = hexToRgb(hexWithHash);
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

	// check lightness
	if (hsl.l < 60) {
		warnings.push('Neutral color should be light (closer to white/beige).');
	}

	// check saturation
	if (hsl.s > 65) {
		warnings.push('Neutral color should have moderate saturation (more gray/beige, less vibrant).');
	}

	// check luminance
	const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
	if (luminance < 0.5) {
		warnings.push('Neutral color is too dark. Use lighter shades closer to white or beige.');
	}

	return {
		isValid: warnings.length === 0,
		warnings
	};
}

function persistThemeColorsToBrowserStorage(colors: ThemeColors) {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		window.sessionStorage.setItem(CURRENT_THEME_STORAGE_KEY, serializeThemeColors(colors));
	} catch {
		// ignore storage failures; the theme can still apply for the current document
	}

	try {
		window.localStorage.setItem(CURRENT_THEME_STORAGE_KEY, serializeThemeColors(colors));
	} catch {
		// ignore storage failures; session storage is still enough for the current document
	}

	try {
		document.cookie = `${CURRENT_THEME_COOKIE_KEY}=${encodeURIComponent(serializeThemeColors(colors))}; path=/; max-age=31536000; samesite=lax`;
	} catch {
		// ignore cookie failures; storage fallback still covers the current browser
	}

	persistBrowserThemeColor(buildThemeColorHex(colors));
}

/** stores the exact browser chrome color so app.html can restore it before hydration. */
export function persistBrowserThemeColor(primaryHex: string): void {
	if (typeof window === 'undefined') {
		return;
	}

	const normalizedPrimary = parseStoredThemeColorHex(primaryHex);
	if (!normalizedPrimary) {
		return;
	}

	try {
		if (window.sessionStorage.getItem(BROWSER_THEME_COLOR_STORAGE_KEY) !== normalizedPrimary) {
			window.sessionStorage.setItem(BROWSER_THEME_COLOR_STORAGE_KEY, normalizedPrimary);
		}
	} catch {
		// ignore storage failures; local storage may still succeed
	}

	try {
		if (window.localStorage.getItem(BROWSER_THEME_COLOR_STORAGE_KEY) !== normalizedPrimary) {
			window.localStorage.setItem(BROWSER_THEME_COLOR_STORAGE_KEY, normalizedPrimary);
		}
	} catch {
		// ignore storage failures; session storage may still succeed
	}
}

/** updates the shared theme-color meta tag only when the value truly changed. */
export function syncThemeColorMeta(primaryHex: string): void {
	if (typeof document === 'undefined') {
		return;
	}

	const primary500WithHash = buildThemeColorHex({ primary: primaryHex });
	let themeColorMeta =
		document.querySelector<HTMLMetaElement>('#theme-meta') ??
		document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (!themeColorMeta) {
		themeColorMeta = document.createElement('meta');
		themeColorMeta.setAttribute('name', 'theme-color');
		themeColorMeta.setAttribute('id', 'theme-meta');
		document.head.appendChild(themeColorMeta);
	}

	if (themeColorMeta.getAttribute('content') !== primary500WithHash) {
		themeColorMeta.setAttribute('content', primary500WithHash);
	}

	persistBrowserThemeColor(primary500WithHash);
}

/** applies the theme to css variables on the document root. */
function applyThemeToDOM(colors: ThemeColors, options?: { persist?: boolean }) {
	const root = document.documentElement;
	for (const [variableName, variableValue] of Object.entries(buildThemeCssVariables(colors))) {
		root.style.setProperty(variableName, variableValue);
	}

	// sync theme-color meta tag with primary-600 for browser/pwa chrome
	syncThemeColorMeta(colors.primary);

	if (options?.persist !== false) {
		persistThemeColorsToBrowserStorage(colors);
	}
}

/** marks the ui as safe to show after theme variables are applied. */
async function markThemeReady() {
	if (typeof document === 'undefined') return;
	if (document.body?.classList.contains('theme-ready')) return;

	// wait for pending stylesheets so themed backgrounds are available on first visible frame
	const stylesheetLinks = Array.from(
		document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
	);
	const pendingStylesheetLinks = stylesheetLinks.filter((link) => !link.sheet);
	if (pendingStylesheetLinks.length > 0) {
		await new Promise<void>((resolve) => {
			let pendingCount = pendingStylesheetLinks.length;
			const handleComplete = () => {
				pendingCount -= 1;
				if (pendingCount <= 0) {
					resolve();
				}
			};
			pendingStylesheetLinks.forEach((link) => {
				link.addEventListener('load', handleComplete, { once: true });
				link.addEventListener('error', handleComplete, { once: true });
			});
		});
	}

	// wait two paint frames to ensure css variables and computed styles are settled
	// critical: this is the only allowed body reveal path for no-flicker startup
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve());
		});
	});

	document.body?.classList.add('theme-ready');
}

/** maps a database theme record to the theme color shape. */
function mapRecordToColors(record: ThemeRecord): ThemeColors {
	return {
		primary: record.primary,
		secondary: record.secondary,
		neutral: record.neutral || ''
	};
}

/** maps a database theme record to a saved theme entry. */
function mapRecordToSavedTheme(record: ThemeRecord): SavedTheme {
	return {
		id: record.id,
		name: record.name,
		colors: mapRecordToColors(record),
		createdAt: record.createdAt
	};
}

function canUseThemeApiFromCurrentPath(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	const pathname = window.location.pathname;
	return THEME_API_PROTECTED_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
}

/** wraps api calls with json parsing and error handling. */
async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
	if (typeof window === 'undefined') {
		throw new Error('Theme API requests are only available in the browser');
	}
	const response = await fetch(`${API_BASE}${path}`, {
		headers: {
			'Content-Type': 'application/json'
		},
		...options
	});
	const payload = (await response.json()) as ThemeApiResponse<T>;
	if (!response.ok || !payload.success) {
		throw new Error(payload.error || 'Theme request failed');
	}
	return payload.data;
}

/** fetches the current theme and honors etag caching. */
async function loadCurrentThemeFromDatabase(useEtag = true): Promise<ThemeFetchResult> {
	if (typeof window === 'undefined') {
		throw new Error('Theme API requests are only available in the browser');
	}

	// send etag to avoid refetching unchanged themes
	const headers: HeadersInit = {};
	if (useEtag && currentThemeETag) {
		headers['If-None-Match'] = currentThemeETag;
	}

	const response = await fetch(`${API_BASE}/current`, { headers });
	if (response.status === 304) {
		return { theme: null, notModified: true };
	}

	const payload = (await response.json()) as ThemeApiResponse<ThemeRecord | null>;
	if (!response.ok || !payload.success) {
		throw new Error(payload.error || 'Theme request failed');
	}

	const etag = response.headers.get('etag');
	if (etag) {
		currentThemeETag = etag;
	}

	if (!payload.data) {
		return { theme: null, notModified: false };
	}

	return { theme: mapRecordToColors(payload.data), notModified: false };
}

/** fetches the list of saved themes from the database. */
async function loadSavedThemesFromDatabase(): Promise<SavedTheme[]> {
	const data = await apiRequest<ThemeRecord[]>('');
	return data.map(mapRecordToSavedTheme);
}

/** saves the current theme to the database and updates etag state. */
async function persistCurrentThemeToDatabase(colors: ThemeColors) {
	if (typeof window === 'undefined') {
		return;
	}
	try {
		const response = await fetch(`${API_BASE}/current`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				colors: {
					primary: normalizeHex(colors.primary),
					secondary: normalizeHex(colors.secondary),
					neutral: colors.neutral ? normalizeHex(colors.neutral) : ''
				}
			})
		});

		const payload = (await response.json()) as ThemeApiResponse<ThemeRecord>;
		if (!response.ok || !payload.success) {
			throw new Error(payload.error || 'Theme request failed');
		}

		const etag = response.headers.get('etag');
		if (etag) {
			currentThemeETag = etag;
		}
	} catch (error) {
		console.warn('Failed to save current theme to database:', error);
	}
}

/** creates a new saved theme in the database. */
async function createThemeInDatabase(name: string, colors: ThemeColors) {
	return await apiRequest<ThemeRecord>('', {
		method: 'POST',
		body: JSON.stringify({
			name,
			colors: {
				primary: normalizeHex(colors.primary),
				secondary: normalizeHex(colors.secondary),
				neutral: colors.neutral ? normalizeHex(colors.neutral) : ''
			}
		})
	});
}

/** updates an existing saved theme in the database. */
async function updateThemeInDatabase(themeId: string, name: string, colors: ThemeColors) {
	return await apiRequest<ThemeRecord>(`/${themeId}`, {
		method: 'PUT',
		body: JSON.stringify({
			name,
			colors: {
				primary: normalizeHex(colors.primary),
				secondary: normalizeHex(colors.secondary),
				neutral: colors.neutral ? normalizeHex(colors.neutral) : ''
			}
		})
	});
}

/** updates a single color in the current theme locally. */
export function updateColor(colorName: keyof ThemeColors, hexValue: string) {
	// normalize incoming values before writing them
	const cleanHex = normalizeHex(hexValue);
	// update the store and keep css vars in sync
	themeColors.update((colors) => {
		const updated = { ...colors, [colorName]: cleanHex };
		applyThemeToDOM(updated);
		return updated;
	});
}

/** resets the theme back to defaults locally. */
export function resetTheme() {
	// set the store first to keep ui responsive
	themeColors.set(DEFAULT_THEME);
	applyThemeToDOM(DEFAULT_THEME);
}

/** saves the current theme with a name, optionally replacing an existing one. */
export async function saveCurrentTheme(
	name: string,
	replaceIndex?: number
): Promise<number | null> {
	const currentColors = get(themeColors);
	const themes = get(savedThemes);

	// replace an existing theme when requested
	if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < themes.length) {
		try {
			const record = await updateThemeInDatabase(themes[replaceIndex].id, name, currentColors);
			const updated = [...themes];
			updated[replaceIndex] = mapRecordToSavedTheme(record);
			savedThemes.set(updated);
			await persistCurrentThemeToDatabase(currentColors);
			return replaceIndex;
		} catch (error) {
			console.warn('Failed to update theme:', error);
			return null;
		}
	}

	// create a new theme if there is room
	if (themes.length < MAX_SAVED_THEMES) {
		try {
			const record = await createThemeInDatabase(name, currentColors);
			const updated = [...themes, mapRecordToSavedTheme(record)];
			savedThemes.set(updated);
			await persistCurrentThemeToDatabase(currentColors);
			return updated.length - 1;
		} catch (error) {
			console.warn('Failed to save theme:', error);
			return null;
		}
	}

	// no space left, ask the caller to choose a replacement
	return null;
}

/** loads a saved theme and makes it the current theme. */
export async function loadTheme(themeId: string) {
	const themes = get(savedThemes);
	let theme = themes.find((t) => t.id === themeId);

	if (!theme) {
		try {
			const record = await apiRequest<ThemeRecord>(`/${themeId}`);
			theme = mapRecordToSavedTheme(record);
		} catch (error) {
			console.warn('Failed to load theme:', error);
			return false;
		}
	}

	themeColors.set({ ...theme.colors });
	applyThemeToDOM(theme.colors);
	await persistCurrentThemeToDatabase(theme.colors);
	return true;
}

/** deletes a saved theme from the database and store. */
export async function deleteTheme(themeId: string) {
	try {
		await apiRequest<boolean>(`/${themeId}`, { method: 'DELETE' });
		const themes = get(savedThemes);
		const updated = themes.filter((t) => t.id !== themeId);
		savedThemes.set(updated);
	} catch (error) {
		console.warn('Failed to delete theme:', error);
	}
}

/** renames an existing saved theme while keeping its current colors. */
export async function renameSavedTheme(themeId: string, name: string) {
	const trimmedName = name.trim();
	if (!trimmedName) {
		return false;
	}

	const themes = get(savedThemes);
	const themeIndex = themes.findIndex((theme) => theme.id === themeId);
	if (themeIndex === -1) {
		return false;
	}

	try {
		const record = await updateThemeInDatabase(themeId, trimmedName, themes[themeIndex].colors);
		const updated = [...themes];
		updated[themeIndex] = mapRecordToSavedTheme(record);
		savedThemes.set(updated);
		return true;
	} catch (error) {
		console.warn('Failed to rename theme:', error);
		return false;
	}
}

/** initializes the theme system and keeps css variables in sync. */
export async function init(
	initialTheme?: ThemeColors,
	options?: {
		fetchCurrent?: boolean;
	}
) {
	if (typeof window === 'undefined') return;

	// pull etag from the server-rendered meta tag
	const etagMeta = document.querySelector('meta[name="theme-etag"]');
	if (etagMeta) {
		const value = etagMeta.getAttribute('content');
		if (value) {
			currentThemeETag = value;
		}
	}

	const canUseThemeApi = canUseThemeApiFromCurrentPath();
	const shouldFetchCurrent = options?.fetchCurrent ?? !initialTheme;
	const persistedTheme = readPersistedThemeColors();
	const fallbackTheme =
		shouldFetchCurrent && persistedTheme ? persistedTheme : (initialTheme ?? DEFAULT_THEME);
	// keep the store in sync with the first paint
	themeColors.set(fallbackTheme);
	applyThemeToDOM(fallbackTheme, {
		persist: !canUseThemeApi || !shouldFetchCurrent
	});
	// clear saved themes immediately so stale org data is not shown during a client switch
	savedThemes.set([]);

	try {
		if (canUseThemeApi) {
			// load saved themes without blocking initial paint
			void loadSavedThemesFromDatabase()
				.then((saved) => {
					savedThemes.set(saved);
				})
				.catch((error) => {
					console.warn('Failed to load saved themes from database:', error);
				});
		} else {
			savedThemes.set([]);
		}

		if (canUseThemeApi && shouldFetchCurrent) {
			const currentResult = await loadCurrentThemeFromDatabase();
			const currentTheme = currentResult.notModified ? null : currentResult.theme;
			const resolvedTheme = currentTheme || fallbackTheme;
			themeColors.set(resolvedTheme);
			applyThemeToDOM(resolvedTheme);
		}
	} catch (error) {
		console.warn('Failed to initialize themes from database:', error);
		themeColors.set(fallbackTheme);
		applyThemeToDOM(fallbackTheme, { persist: false });
	}

	// keep css variables in sync with store changes
	if (!themeStoreSubscriptionInitialized) {
		themeStoreSubscriptionInitialized = true;
		themeColors.subscribe((colors) => {
			applyThemeToDOM(colors, { persist: false });
		});
	}

	// allow the body to display after theme and styles are fully settled
	await markThemeReady();
}
