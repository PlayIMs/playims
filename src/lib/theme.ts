import { writable, get } from 'svelte/store';

// Static surface colors (Tailwind zinc defaults)
export const SURFACE_LIGHT = '#E4E4E7'; // zinc-200
export const SURFACE_DARK = '#09090B'; // zinc-950

// Default zinc palette (Tailwind CSS zinc colors)
export const ZINC_PALETTE: Record<string, string> = {
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

// Default hex values (without #)
const DEFAULT_THEME = {
	primary: 'CE1126',
	secondary: '14213D',
	neutral: 'EEDBCE',
	accent: '04669A'
} as const;

// Theme store
type ThemeColors = {
	primary: string;
	secondary: string;
	neutral: string; // Empty string means use zinc default
	accent: string;
};

type SavedTheme = {
	id: string;
	name: string;
	colors: ThemeColors;
	createdAt: string;
};

const MAX_SAVED_THEMES = 15;
const API_BASE = '/api/themes';

export const themeColors = writable<ThemeColors>(DEFAULT_THEME);
export const savedThemes = writable<SavedTheme[]>([]);

export function generatePalette(baseHex: string): Record<string, string> {
	// Helper to parse hex to RGB
	const hexToRgb = (hex: string) => {
		const cleanHex = hex.replace('#', '');
		const r = parseInt(cleanHex.substring(0, 2), 16);
		const g = parseInt(cleanHex.substring(2, 4), 16);
		const b = parseInt(cleanHex.substring(4, 6), 16);
		return { r, g, b };
	};

	// Helper to format RGB to hex (without # for internal use, will add # when setting CSS vars)
	const rgbToHex = (r: number, g: number, b: number) => {
		const toHex = (c: number) => {
			const hex = Math.round(c).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};
		return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
	};

	// Mix two colors: color A mixed with color B by percentage (0-1)
	const mix = (
		color: { r: number; g: number; b: number },
		mixColor: { r: number; g: number; b: number },
		weight: number
	) => {
		return {
			r: color.r + (mixColor.r - color.r) * weight,
			g: color.g + (mixColor.g - color.g) * weight,
			b: color.b + (mixColor.b - color.b) * weight
		};
	};

	const base = hexToRgb(baseHex);
	const white = { r: 255, g: 255, b: 255 };
	const black = { r: 0, g: 0, b: 0 };

	// Ensure baseHex doesn't have # prefix for processing
	const cleanBaseHex = baseHex.replace('#', '').toUpperCase();

	// Mixing weights tuned to replicate the visual progression of Tailwind colors
	// 25-400 mix with White
	// 500 is base
	// 600-950 mix with Black
	const palette: Record<string, string> = {
		'25': rgbToHex(mix(base, white, 0.975).r, mix(base, white, 0.975).g, mix(base, white, 0.975).b),
		'50': rgbToHex(mix(base, white, 0.75).r, mix(base, white, 0.75).g, mix(base, white, 0.75).b),
		'100': rgbToHex(mix(base, white, 0.6).r, mix(base, white, 0.6).g, mix(base, white, 0.6).b),
		'200': rgbToHex(mix(base, white, 0.4).r, mix(base, white, 0.4).g, mix(base, white, 0.4).b),
		'300': rgbToHex(mix(base, white, 0.25).r, mix(base, white, 0.25).g, mix(base, white, 0.25).b),
		'400': rgbToHex(mix(base, white, 0.1).r, mix(base, white, 0.1).g, mix(base, white, 0.1).b),
		'500': cleanBaseHex,
		'600': rgbToHex(mix(base, black, 0.1).r, mix(base, black, 0.1).g, mix(base, black, 0.1).b),
		'700': rgbToHex(
			mix(base, black, 0.2625).r,
			mix(base, black, 0.2625).g,
			mix(base, black, 0.2625).b
		),
		'800': rgbToHex(
			mix(base, black, 0.425).r,
			mix(base, black, 0.425).g,
			mix(base, black, 0.425).b
		),
		'900': rgbToHex(
			mix(base, black, 0.5875).r,
			mix(base, black, 0.5875).g,
			mix(base, black, 0.5875).b
		),
		'950': rgbToHex(mix(base, black, 0.75).r, mix(base, black, 0.75).g, mix(base, black, 0.75).b)
	};

	return palette;
}

/**
 * Converts hex to full hex with #
 */
export function formatHex(hex: string): string {
	const cleanHex = hex.replace('#', '').toUpperCase();
	return `#${cleanHex}`;
}

/**
 * Converts hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const cleanHex = hex.replace('#', '');
	const r = parseInt(cleanHex.substring(0, 2), 16);
	const g = parseInt(cleanHex.substring(2, 4), 16);
	const b = parseInt(cleanHex.substring(4, 6), 16);
	return { r, g, b };
}

/**
 * Converts RGB to HSL
 */
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

/**
 * Calculates relative luminance for WCAG contrast calculation
 */
function getLuminance(r: number, g: number, b: number): number {
	const [rs, gs, bs] = [r, g, b].map((val) => {
		val = val / 255;
		return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates WCAG contrast ratio between two colors
 */
function getContrastRatio(color1: string, color2: string): number {
	const rgb1 = hexToRgb(color1);
	const rgb2 = hexToRgb(color2);

	const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
	const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);

	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validates that a color is not white, black, or grayscale
 * Returns validation status with warnings
 */
export function validateColorNotGrayscale(
	colorHex: string,
	colorName: 'primary' | 'secondary' | 'accent'
): { isValid: boolean; warnings: string[] } {
	const warnings: string[] = [];
	const cleanHex = colorHex.replace('#', '').toUpperCase();
	const hexWithHash = `#${cleanHex}`;

	const rgb = hexToRgb(hexWithHash);
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

	// Check if it's white (all RGB values close to 255, or lightness very high)
	const isWhite = rgb.r > 250 && rgb.g > 250 && rgb.b > 250;
	if (isWhite || hsl.l > 95) {
		warnings.push(
			`${colorName.charAt(0).toUpperCase() + colorName.slice(1)} color should not be white.`
		);
	}

	// Check if it's black (all RGB values close to 0, or lightness very low)
	const isBlack = rgb.r < 5 && rgb.g < 5 && rgb.b < 5;
	if (isBlack || hsl.l < 5) {
		warnings.push(
			`${colorName.charAt(0).toUpperCase() + colorName.slice(1)} color should not be black.`
		);
	}

	// Check if it's grayscale (low saturation)
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

/**
 * Validates accent color against the neutral color background
 * Returns validation status with warnings
 */
export function validateAccent(
	accentHex: string,
	neutralHex?: string
): { isValid: boolean; warnings: string[] } {
	const warnings: string[] = [];
	const cleanHex = accentHex.replace('#', '').toUpperCase();
	const hexWithHash = `#${cleanHex}`;

	// Check for white, black, or grayscale
	const grayscaleCheck = validateColorNotGrayscale(accentHex, 'accent');
	warnings.push(...grayscaleCheck.warnings);

	// Check 2: WCAG AA contrast (4.5:1) against neutral color
	// Use user's neutral color if provided, otherwise use default zinc-500
	const neutralColorHex =
		neutralHex && neutralHex.trim() !== ''
			? `#${neutralHex.replace('#', '').toUpperCase()}`
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

/**
 * Determines if a color is light or dark based on luminance
 */
function isLightColor(hex: string): boolean {
	const rgb = hexToRgb(hex);
	const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
	return luminance > 0.5;
}

/**
 * Gets readable text color based on background
 * Returns the 950 shade for light backgrounds, 50 shade for dark backgrounds
 */
export function getReadableTextColor(
	backgroundColorHex: string,
	themeColorPalette: Record<string, string>
): string {
	const hexWithHash = backgroundColorHex.startsWith('#')
		? backgroundColorHex
		: `#${backgroundColorHex}`;

	const isLight = isLightColor(hexWithHash);

	// For light backgrounds, use darkest shade (950)
	// For dark backgrounds, use lightest shade (50)
	const shade = isLight ? '950' : '50';
	const hexValue = themeColorPalette[shade] || themeColorPalette['500'];

	return hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
}

/**
 * Validates neutral color to ensure it's appropriate for neutral backgrounds
 * Neutral colors should be close to white, beige, or other light/pastel colors
 * More lenient validation to allow beige and light pastel colors
 */
export function validateNeutral(neutralHex: string): { isValid: boolean; warnings: string[] } {
	const warnings: string[] = [];
	const cleanHex = neutralHex.replace('#', '').toUpperCase();
	const hexWithHash = `#${cleanHex}`;

	const rgb = hexToRgb(hexWithHash);
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

	// Check lightness - neutral colors should be light (L > 60% - more lenient for beiges)
	if (hsl.l < 60) {
		warnings.push('Neutral color should be light (closer to white/beige).');
	}

	// Check saturation - neutral colors should have moderate saturation (< 65% - allows beiges)
	if (hsl.s > 65) {
		warnings.push('Neutral color should have moderate saturation (more gray/beige, less vibrant).');
	}

	// Check if it's too dark overall (luminance > 0.5 - more lenient)
	const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
	if (luminance < 0.5) {
		warnings.push('Neutral color is too dark. Use lighter shades closer to white or beige.');
	}

	return {
		isValid: warnings.length === 0,
		warnings
	};
}

/**
 * Applies theme colors to CSS variables on document.documentElement
 */
function applyThemeToDOM(colors: ThemeColors) {
	const root = document.documentElement;

	// Generate and apply palettes for primary, secondary, and accent
	const colorNames: ('primary' | 'secondary' | 'accent')[] = ['primary', 'secondary', 'accent'];

	for (const colorName of colorNames) {
		const baseHex = colors[colorName];
		const palette = generatePalette(baseHex);

		// Apply each shade to CSS variable (ensure hex has # prefix)
		for (const [shade, hexValue] of Object.entries(palette)) {
			const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
			root.style.setProperty(`--color-${colorName}-${shade}`, hexWithHash);
		}
	}

	// Apply neutral color (use zinc default if empty, otherwise generate palette)
	if (colors.neutral && colors.neutral.trim() !== '') {
		const neutralPalette = generatePalette(colors.neutral);
		for (const [shade, hexValue] of Object.entries(neutralPalette)) {
			const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
			root.style.setProperty(`--color-neutral-${shade}`, hexWithHash);
		}
	} else {
		// Use zinc default palette
		for (const [shade, hexValue] of Object.entries(ZINC_PALETTE)) {
			const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
			root.style.setProperty(`--color-neutral-${shade}`, hexWithHash);
		}
	}

	// Update theme-color meta tag for iOS Safari status bar
	// Use primary-500 color to match hero section
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

type ThemeRecord = {
	id: string;
	name: string;
	slug: string;
	primary: string;
	secondary: string;
	neutral: string;
	accent: string;
	createdAt: string;
};

type ThemeApiResponse<T> = {
	success: boolean;
	data: T;
	error?: string;
};

const normalizeHex = (hex: string) => hex.replace('#', '').toUpperCase();

const mapRecordToColors = (record: ThemeRecord): ThemeColors => ({
	primary: record.primary,
	secondary: record.secondary,
	neutral: record.neutral || '',
	accent: record.accent
});

const mapRecordToSavedTheme = (record: ThemeRecord): SavedTheme => ({
	id: record.id,
	name: record.name,
	colors: mapRecordToColors(record),
	createdAt: record.createdAt
});

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

async function loadCurrentThemeFromDatabase(): Promise<ThemeColors | null> {
	const data = await apiRequest<ThemeRecord | null>('/current');
	if (!data) {
		return null;
	}
	return mapRecordToColors(data);
}

async function loadSavedThemesFromDatabase(): Promise<SavedTheme[]> {
	const data = await apiRequest<ThemeRecord[]>('');
	return data.map(mapRecordToSavedTheme);
}

async function persistCurrentThemeToDatabase(colors: ThemeColors) {
	if (typeof window === 'undefined') {
		return;
	}
	try {
		await apiRequest<ThemeRecord>('/current', {
			method: 'PUT',
			body: JSON.stringify({
				colors: {
					primary: normalizeHex(colors.primary),
					secondary: normalizeHex(colors.secondary),
					neutral: colors.neutral ? normalizeHex(colors.neutral) : '',
					accent: normalizeHex(colors.accent)
				}
			})
		});
	} catch (error) {
		console.warn('Failed to save current theme to database:', error);
	}
}

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

/**
 * Updates a single color in the theme
 */
export function updateColor(colorName: keyof ThemeColors, hexValue: string) {
	// Remove # if present and uppercase
	const cleanHex = hexValue.replace('#', '').toUpperCase();
	let updatedColors: ThemeColors | null = null;
	themeColors.update((colors) => {
		const updated = { ...colors, [colorName]: cleanHex };
		updatedColors = updated;
		applyThemeToDOM(updated);
		return updated;
	});
	if (updatedColors) {
		void persistCurrentThemeToDatabase(updatedColors);
	}
}

/**
 * Resets theme to defaults
 */
export function resetTheme() {
	themeColors.set(DEFAULT_THEME);
	applyThemeToDOM(DEFAULT_THEME);
	void persistCurrentThemeToDatabase(DEFAULT_THEME);
}

/**
 * Saves the current theme with a name
 * Returns the index of the saved theme, or -1 if user needs to select which to replace
 */
export async function saveCurrentTheme(name: string, replaceIndex?: number): Promise<number | null> {
	const currentColors = get(themeColors);
	const themes = get(savedThemes);

	// If replaceIndex is provided, replace that theme
	if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < themes.length) {
		try {
			const record = await updateThemeInDatabase(themes[replaceIndex].id, name, currentColors);
			const updated = [...themes];
			updated[replaceIndex] = mapRecordToSavedTheme(record);
			savedThemes.set(updated);
			return replaceIndex;
		} catch (error) {
			console.warn('Failed to update theme:', error);
			return null;
		}
	}

	// If there's space, add new theme
	if (themes.length < MAX_SAVED_THEMES) {
		try {
			const record = await createThemeInDatabase(name, currentColors);
			const updated = [...themes, mapRecordToSavedTheme(record)];
			savedThemes.set(updated);
			return updated.length - 1;
		} catch (error) {
			console.warn('Failed to save theme:', error);
			return null;
		}
	}

	// No space, return null to indicate user needs to select which to replace
	return null;
}

/**
 * Loads a saved theme
 */
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
	void persistCurrentThemeToDatabase(theme.colors);
	return true;
}

/**
 * Deletes a saved theme
 */
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

/**
 * Gets the list of saved themes
 */
export function getSavedThemes(): SavedTheme[] {
	return get(savedThemes);
}

/**
 * Initializes the theme system
 * - Loads from database if available
 * - Applies theme to DOM
 * - Sets up subscription for future changes
 */
export async function init() {
	if (typeof window === 'undefined') return;

	try {
		const [currentTheme, saved] = await Promise.all([
			loadCurrentThemeFromDatabase(),
			loadSavedThemesFromDatabase()
		]);

		savedThemes.set(saved);

		const initialTheme = currentTheme || DEFAULT_THEME;
		themeColors.set(initialTheme);
		applyThemeToDOM(initialTheme);

		if (!currentTheme) {
			void persistCurrentThemeToDatabase(initialTheme);
		}
	} catch (error) {
		console.warn('Failed to initialize themes from database:', error);
		themeColors.set(DEFAULT_THEME);
		applyThemeToDOM(DEFAULT_THEME);
	}

	themeColors.subscribe((colors) => {
		applyThemeToDOM(colors);
	});
}
