import { writable, get } from 'svelte/store';

// Default hex values (without #)
const DEFAULT_THEME = {
	primary: 'CE1126',
	secondary: 'F1D4C1',
	tertiary: '14213D',
	accent: '006BA6'
} as const;

// Theme store
type ThemeColors = {
	primary: string;
	secondary: string;
	tertiary: string;
	accent: string;
};

type SavedTheme = {
	id: string;
	name: string;
	colors: ThemeColors;
	createdAt: number;
};

const MAX_SAVED_THEMES = 5;
const STORAGE_KEY_THEMES = 'saved-themes';
const STORAGE_KEY_CURRENT = 'current-theme';

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
	// 50-400 mix with White
	// 500 is base
	// 600-950 mix with Black
	const palette: Record<string, string> = {
		'50': rgbToHex(mix(base, white, 0.9).r, mix(base, white, 0.9).g, mix(base, white, 0.9).b),
		'100': rgbToHex(mix(base, white, 0.75).r, mix(base, white, 0.75).g, mix(base, white, 0.75).b),
		'200': rgbToHex(mix(base, white, 0.6).r, mix(base, white, 0.6).g, mix(base, white, 0.6).b),
		'300': rgbToHex(mix(base, white, 0.45).r, mix(base, white, 0.45).g, mix(base, white, 0.45).b),
		'400': rgbToHex(mix(base, white, 0.3).r, mix(base, white, 0.3).g, mix(base, white, 0.3).b),
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
 * Applies theme colors to CSS variables on document.documentElement
 */
function applyThemeToDOM(colors: ThemeColors) {
	const root = document.documentElement;

	// Generate and apply palettes for each color
	const colorNames: (keyof ThemeColors)[] = ['primary', 'secondary', 'tertiary', 'accent'];

	for (const colorName of colorNames) {
		const baseHex = colors[colorName];
		const palette = generatePalette(baseHex);

		// Apply each shade to CSS variable (ensure hex has # prefix)
		for (const [shade, hexValue] of Object.entries(palette)) {
			const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
			root.style.setProperty(`--color-${colorName}-${shade}`, hexWithHash);
		}
	}
}

/**
 * Saves current theme to localStorage
 */
function saveCurrentThemeToStorage(colors: ThemeColors) {
	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(colors));
		} catch (error) {
			console.warn('Failed to save current theme to localStorage:', error);
		}
	}
}

/**
 * Loads current theme from localStorage
 */
function loadCurrentThemeFromStorage(): ThemeColors | null {
	if (typeof window === 'undefined') return null;

	try {
		const stored = localStorage.getItem(STORAGE_KEY_CURRENT);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Validate structure
			if (
				parsed &&
				typeof parsed === 'object' &&
				'primary' in parsed &&
				'secondary' in parsed &&
				'tertiary' in parsed &&
				'accent' in parsed
			) {
				return parsed as ThemeColors;
			}
		}
	} catch (error) {
		console.warn('Failed to load current theme from localStorage:', error);
	}

	return null;
}

/**
 * Loads saved themes from localStorage
 */
function loadSavedThemesFromStorage(): SavedTheme[] {
	if (typeof window === 'undefined') return [];

	try {
		const stored = localStorage.getItem(STORAGE_KEY_THEMES);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed)) {
				return parsed.filter(
					(theme) =>
						theme &&
						typeof theme === 'object' &&
						'id' in theme &&
						'name' in theme &&
						'colors' in theme &&
						theme.colors &&
						'primary' in theme.colors &&
						'secondary' in theme.colors &&
						'tertiary' in theme.colors &&
						'accent' in theme.colors
				) as SavedTheme[];
			}
		}
	} catch (error) {
		console.warn('Failed to load saved themes from localStorage:', error);
	}

	return [];
}

/**
 * Saves themes array to localStorage
 */
function saveThemesToStorage(themes: SavedTheme[]) {
	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(STORAGE_KEY_THEMES, JSON.stringify(themes));
		} catch (error) {
			console.warn('Failed to save themes to localStorage:', error);
		}
	}
}

/**
 * Updates a single color in the theme
 */
export function updateColor(colorName: keyof ThemeColors, hexValue: string) {
	// Remove # if present and uppercase
	const cleanHex = hexValue.replace('#', '').toUpperCase();
	themeColors.update((colors) => {
		const updated = { ...colors, [colorName]: cleanHex };
		applyThemeToDOM(updated);
		saveCurrentThemeToStorage(updated);
		return updated;
	});
}

/**
 * Resets theme to defaults
 */
export function resetTheme() {
	themeColors.set(DEFAULT_THEME);
	applyThemeToDOM(DEFAULT_THEME);
	saveCurrentThemeToStorage(DEFAULT_THEME);
}

/**
 * Saves the current theme with a name
 * Returns the index of the saved theme, or -1 if user needs to select which to replace
 */
export function saveCurrentTheme(name: string, replaceIndex?: number): number | null {
	const currentColors = get(themeColors);
	const themes = get(savedThemes);

	// If replaceIndex is provided, replace that theme
	if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < themes.length) {
		const updated = [...themes];
		updated[replaceIndex] = {
			id: themes[replaceIndex].id,
			name,
			colors: { ...currentColors },
			createdAt: Date.now()
		};
		savedThemes.set(updated);
		saveThemesToStorage(updated);
		return replaceIndex;
	}

	// If there's space, add new theme
	if (themes.length < MAX_SAVED_THEMES) {
		const newTheme: SavedTheme = {
			id: `theme-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name,
			colors: { ...currentColors },
			createdAt: Date.now()
		};
		const updated = [...themes, newTheme];
		savedThemes.set(updated);
		saveThemesToStorage(updated);
		return updated.length - 1;
	}

	// No space, return null to indicate user needs to select which to replace
	return null;
}

/**
 * Loads a saved theme
 */
export function loadTheme(themeId: string) {
	const themes = get(savedThemes);
	const theme = themes.find((t) => t.id === themeId);
	if (theme) {
		themeColors.set({ ...theme.colors });
		applyThemeToDOM(theme.colors);
		saveCurrentThemeToStorage(theme.colors);
		return true;
	}
	return false;
}

/**
 * Deletes a saved theme
 */
export function deleteTheme(themeId: string) {
	const themes = get(savedThemes);
	const updated = themes.filter((t) => t.id !== themeId);
	savedThemes.set(updated);
	saveThemesToStorage(updated);
}

/**
 * Gets the list of saved themes
 */
export function getSavedThemes(): SavedTheme[] {
	return get(savedThemes);
}

/**
 * Initializes the theme system
 * - Loads from localStorage if available
 * - Applies theme to DOM
 * - Sets up subscription for future changes
 */
export function init() {
	if (typeof window === 'undefined') return;

	// Load saved themes
	const saved = loadSavedThemesFromStorage();
	savedThemes.set(saved);

	// Load current theme from localStorage or use defaults
	const savedTheme = loadCurrentThemeFromStorage();
	const initialTheme = savedTheme || DEFAULT_THEME;

	// Set initial theme
	themeColors.set(initialTheme);

	// Apply to DOM immediately
	applyThemeToDOM(initialTheme);

	// Subscribe to future changes
	themeColors.subscribe((colors) => {
		applyThemeToDOM(colors);
		saveCurrentThemeToStorage(colors);
	});
}
