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
	neutral: 'F5ECE5',
	accent: '04669A'
} as const;

export type ThemeColors = {
	primary: string;
	secondary: string;
	neutral: string; // empty string means use zinc default
	accent: string;
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
	accent: string;
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

const MAX_SAVED_THEMES = 15;
const API_BASE = '/api/themes';
let currentThemeETag: string | null = null;

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
		return normalized <= 0.03928
			? normalized / 12.92
			: Math.pow((normalized + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** calculates wcag contrast ratio between two colors. */
function getContrastRatio(color1: string, color2: string): number {
	const rgb1 = hexToRgb(color1);
	const rgb2 = hexToRgb(color2);

	const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
	const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);

	return (lighter + 0.05) / (darker + 0.05);
}

/** determines if a color is light or dark based on luminance. */
function isLightColor(hex: string): boolean {
	const rgb = hexToRgb(hex);
	const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
	return luminance > 0.5;
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

/** gets a readable text color from a palette based on background color. */
export function getReadableTextColor(
	backgroundColorHex: string,
	themeColorPalette: Record<string, string>
): string {
	const hexWithHash = backgroundColorHex.startsWith('#')
		? backgroundColorHex
		: `#${backgroundColorHex}`;

	const isLight = isLightColor(hexWithHash);
	const shade = isLight ? '950' : '50';
	const hexValue = themeColorPalette[shade] || themeColorPalette['500'];

	return hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
}

/** validates that a color is not white, black, or grayscale. */
export function validateColorNotGrayscale(
	colorHex: string,
	colorName: 'primary' | 'secondary' | 'accent'
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

/** validates accent color against neutral background contrast. */
export function validateAccent(
	accentHex: string,
	neutralHex?: string
): { isValid: boolean; warnings: string[] } {
	const warnings: string[] = [];
	const cleanHex = normalizeHex(accentHex);
	const hexWithHash = `#${cleanHex}`;

	// check for white, black, or grayscale
	const grayscaleCheck = validateColorNotGrayscale(accentHex, 'accent');
	warnings.push(...grayscaleCheck.warnings);

	// check wcag aa contrast (4.5:1) against neutral
	const neutralColorHex =
		neutralHex && neutralHex.trim() !== ''
			? `#${normalizeHex(neutralHex)}`
			: `#${ZINC_PALETTE['500']}`;

	const contrast = getContrastRatio(hexWithHash, neutralColorHex);

	if (contrast < 4.5) {
		warnings.push('Low contrast ratio - this color may be hard to read on the neutral background.');
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

/** applies the theme to css variables on the document root. */
function applyThemeToDOM(colors: ThemeColors) {
	const root = document.documentElement;

	// generate and apply palettes for primary, secondary, and accent
	const colorNames: ('primary' | 'secondary' | 'accent')[] = ['primary', 'secondary', 'accent'];

	for (const colorName of colorNames) {
		const baseHex = colors[colorName];
		const palette = generatePalette(baseHex);

		// apply each shade to css variable
		for (const [shade, hexValue] of Object.entries(palette)) {
			const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
			root.style.setProperty(`--color-${colorName}-${shade}`, hexWithHash);
		}
	}

	// apply neutral color (use zinc default if empty)
	if (colors.neutral && colors.neutral.trim() !== '') {
		const neutralPalette = generatePalette(colors.neutral);
		for (const [shade, hexValue] of Object.entries(neutralPalette)) {
			const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
			root.style.setProperty(`--color-neutral-${shade}`, hexWithHash);
		}
	} else {
		for (const [shade, hexValue] of Object.entries(ZINC_PALETTE)) {
			const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
			root.style.setProperty(`--color-neutral-${shade}`, hexWithHash);
		}
	}

	// sync theme-color meta tag with primary-500
	const primaryPalette = generatePalette(colors.primary);
	const primary500Hex = primaryPalette['500'];
	const primary500WithHash = primary500Hex.startsWith('#') ? primary500Hex : `#${primary500Hex}`;
	let themeColorMeta = document.querySelector('meta[name="theme-color"]');
	if (!themeColorMeta) {
		themeColorMeta = document.createElement('meta');
		themeColorMeta.setAttribute('name', 'theme-color');
		document.head.appendChild(themeColorMeta);
	}
	themeColorMeta.setAttribute('content', primary500WithHash);
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
		neutral: record.neutral || '',
		accent: record.accent
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
					neutral: colors.neutral ? normalizeHex(colors.neutral) : '',
					accent: normalizeHex(colors.accent)
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
				neutral: colors.neutral ? normalizeHex(colors.neutral) : '',
				accent: normalizeHex(colors.accent)
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
				neutral: colors.neutral ? normalizeHex(colors.neutral) : '',
				accent: normalizeHex(colors.accent)
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
export async function saveCurrentTheme(name: string, replaceIndex?: number): Promise<number | null> {
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

	const fallbackTheme = initialTheme ?? DEFAULT_THEME;
	// keep the store in sync with the first paint
	themeColors.set(fallbackTheme);
	applyThemeToDOM(fallbackTheme);

	try {
		// load saved themes without blocking initial paint
		void loadSavedThemesFromDatabase()
			.then((saved) => {
				savedThemes.set(saved);
			})
			.catch((error) => {
				console.warn('Failed to load saved themes from database:', error);
			});

		const shouldFetchCurrent = options?.fetchCurrent ?? !initialTheme;
		if (shouldFetchCurrent) {
			const currentResult = await loadCurrentThemeFromDatabase();
			const currentTheme = currentResult.notModified ? null : currentResult.theme;
			const resolvedTheme = currentTheme || fallbackTheme;
			themeColors.set(resolvedTheme);
			applyThemeToDOM(resolvedTheme);
		}
	} catch (error) {
		console.warn('Failed to initialize themes from database:', error);
		themeColors.set(fallbackTheme);
		applyThemeToDOM(fallbackTheme);
	}

	// keep css variables in sync with store changes
	themeColors.subscribe((colors) => {
		applyThemeToDOM(colors);
	});

	// allow the body to display after theme and styles are fully settled
	await markThemeReady();
}
