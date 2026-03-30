<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { afterNavigate, goto, invalidateAll } from '$app/navigation';
	import 'virtual:pwa-assets/head';
	// import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';
	import Toaster from '$lib/components/toast/Toaster.svelte';
	import UrlBar from '$lib/components/UrlBar.svelte';
	import * as theme from '$lib/theme';
	import { themeColors as liveThemeColorsStore } from '$lib/theme';
	import { forceRadioTabStop, selectArrow, skipDatePickerTabStop } from '$lib/actions';
	import {
		type PwaHistoryEntry,
		clearPwaReloadInFlight,
		markPwaReloadInFlight,
		parseStoredPwaHistoryEntries,
		readPwaReloadInFlight,
		readSvelteKitHistoryIndex,
		selectPwaHistoryMenuEntries,
		serializePwaHistoryEntries,
		STANDALONE_DISPLAY_MODE_QUERY,
		syncPwaHistoryEntries,
		isStandaloneDisplayMode
	} from '$lib/utils/pwa-navigation';

	let { children, data } = $props();
	// injectSpeedInsights();

	// use the server-provided theme as the initial paint values
	let initialTheme = $derived((data?.theme as theme.ThemeColors | null) ?? theme.DEFAULT_THEME);
	// only fetch the current theme when the server did not provide one
	let shouldFetchCurrent = $derived((data?.themeSource as 'db' | 'fallback' | undefined) !== 'db');
	let activeClientId = $derived((data?.activeClientId as string | null | undefined) ?? null);
	let lastActiveClientId = $state<string | null>(null);
	let clientSwitchRefreshInFlight = $state(false);

	let themeEtag = $derived((data?.themeEtag as string | undefined) ?? 'W/"theme-empty"');
	// serialize theme payloads for a blocking script in svelte:head
	let initialThemeJson = $derived(JSON.stringify(initialTheme ?? theme.DEFAULT_THEME));
	let zincPaletteJson = $derived(JSON.stringify(theme.ZINC_PALETTE));
	let themeStorageKeyJson = $derived(JSON.stringify(theme.CURRENT_THEME_STORAGE_KEY));
	let pwaChromePrimaryJson = $derived(
		JSON.stringify(
			((data?.pwaChromePrimary as string | undefined) ?? theme.STANDALONE_PWA_FALLBACK_PRIMARY)
				.replace('#', '')
				.toUpperCase()
		)
	);
	let isStandalonePwa = $state(false);
	let isReloadingStandalonePwa = $state(false);
	let pwaHistorySessionStart = $state<number | null>(null);
	let pwaHistoryCurrentIndex = $state<number | null>(null);
	let pwaHistoryMaxIndex = $state<number | null>(null);
	let pwaHistoryEntries = $state<PwaHistoryEntry[]>([]);
	// render css vars on the server so first paint already uses the active theme
	const buildThemeVarsCss = (colors: theme.ThemeColors) => {
		return `:root{${Object.entries(theme.buildThemeCssVariables(colors))
			.map(([variableName, value]) => `${variableName}:${value};`)
			.join('')}}`;
	};
	let initialThemeVarsCss = $derived(buildThemeVarsCss(initialTheme));
	let initialPwaChromePrimary = $derived.by(
		() =>
			((data?.pwaChromePrimary as string | undefined) ?? theme.STANDALONE_PWA_FALLBACK_PRIMARY)
				.replace('#', '')
				.toUpperCase()
	);
	let liveThemeColors = $derived($liveThemeColorsStore);
	let appShellStyle = $derived.by(() => `--pwa-top-bar-offset:${pwaTopBarOffset};`);
	/** applies the select arrow action to themed select elements. */
	const applySelectArrowToAll = () => {
		const selects = document.querySelectorAll<HTMLSelectElement>(
			'select.select-primary, select.select-secondary'
		);
		selects.forEach((select) => {
			// skip selects that already have the action
			if (!select.dataset.selectArrowApplied) {
				select.dataset.selectArrowApplied = 'true';
				selectArrow(select);
			}
		});
	};

	/** applies date-picker tab bypass action to date/time-like inputs. */
	const applyDateTabBypassToAll = () => {
		const inputs = document.querySelectorAll<HTMLInputElement>(
			"input[type='date'], input[type='datetime-local'], input[type='month'], input[type='week'], input[type='time']"
		);
		inputs.forEach((input) => {
			if (!input.dataset.dateTabBypassApplied) {
				input.dataset.dateTabBypassApplied = 'true';
				skipDatePickerTabStop(input);
			}
		});
	};

	/** ensures each radio input is individually tabbable (including unselected radios). */
	const applyRadioTabStopsToAll = () => {
		const radios = document.querySelectorAll<HTMLInputElement>("input[type='radio']");
		radios.forEach((radio) => {
			if (!radio.dataset.radioTabStopApplied) {
				radio.dataset.radioTabStopApplied = 'true';
				forceRadioTabStop(radio);
			}
		});
	};

	type NavigatorWithStandalone = Navigator & {
		standalone?: boolean;
	};
	type NavigationKind = 'enter' | 'form' | 'goto' | 'leave' | 'link' | 'popstate' | null;
	const PWA_HISTORY_SESSION_START_KEY = 'playims:pwa-history-session-start';
	const PWA_HISTORY_MAX_KEY = 'playims:pwa-history-max';
	const PWA_HISTORY_ENTRIES_KEY = 'playims:pwa-history-entries';
	const pwaTopBarOffset = $derived.by(() =>
		isStandalonePwa ? 'calc(env(safe-area-inset-top, 0px) + 2.75rem)' : '0px'
	);
	const canGoBack = $derived.by(() => {
		return (
			isStandalonePwa &&
			pwaHistorySessionStart !== null &&
			pwaHistoryCurrentIndex !== null &&
			pwaHistoryCurrentIndex > pwaHistorySessionStart
		);
	});
	const canGoForward = $derived.by(() => {
		return (
			isStandalonePwa &&
			pwaHistoryMaxIndex !== null &&
			pwaHistoryCurrentIndex !== null &&
			pwaHistoryCurrentIndex < pwaHistoryMaxIndex
		);
	});
	const backHistoryEntries = $derived.by(() => {
		if (pwaHistoryCurrentIndex === null) {
			return [];
		}

		return selectPwaHistoryMenuEntries({
			entries: pwaHistoryEntries,
			currentIndex: pwaHistoryCurrentIndex,
			direction: 'back'
		});
	});
	const forwardHistoryEntries = $derived.by(() => {
		if (pwaHistoryCurrentIndex === null) {
			return [];
		}

		return selectPwaHistoryMenuEntries({
			entries: pwaHistoryEntries,
			currentIndex: pwaHistoryCurrentIndex,
			direction: 'forward'
		});
	});

	const parseStoredHistoryIndex = (value: string | null): number | null => {
		if (!value) {
			return null;
		}

		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	};

	const syncPwaHistoryState = (navigationType: NavigationKind = null) => {
		if (!browser) {
			pwaHistorySessionStart = null;
			pwaHistoryCurrentIndex = null;
			pwaHistoryMaxIndex = null;
			pwaHistoryEntries = [];
			return;
		}

		const currentHistoryIndex = readSvelteKitHistoryIndex(window.history.state);
		if (currentHistoryIndex === null) {
			pwaHistorySessionStart = null;
			pwaHistoryCurrentIndex = null;
			pwaHistoryMaxIndex = null;
			pwaHistoryEntries = [];
			return;
		}

		let sessionStart = parseStoredHistoryIndex(
			window.sessionStorage.getItem(PWA_HISTORY_SESSION_START_KEY)
		);
		let maxHistoryIndex = parseStoredHistoryIndex(
			window.sessionStorage.getItem(PWA_HISTORY_MAX_KEY)
		);
		let historyEntries = parseStoredPwaHistoryEntries(
			window.sessionStorage.getItem(PWA_HISTORY_ENTRIES_KEY)
		);

		if (sessionStart === null) {
			sessionStart = currentHistoryIndex;
		}

		if (maxHistoryIndex === null) {
			maxHistoryIndex = currentHistoryIndex;
		}

		if (navigationType && navigationType !== 'popstate') {
			maxHistoryIndex = currentHistoryIndex;
		} else if (currentHistoryIndex > maxHistoryIndex) {
			maxHistoryIndex = currentHistoryIndex;
		}

		pwaHistorySessionStart = sessionStart;
		pwaHistoryCurrentIndex = currentHistoryIndex;
		pwaHistoryMaxIndex = maxHistoryIndex;
		historyEntries = syncPwaHistoryEntries({
			entries: historyEntries,
			currentIndex: currentHistoryIndex,
			url: new URL(window.location.href),
			title: document.title,
			navigationType
		});
		pwaHistoryEntries = historyEntries;

		try {
			window.sessionStorage.setItem(PWA_HISTORY_SESSION_START_KEY, String(sessionStart));
			window.sessionStorage.setItem(PWA_HISTORY_MAX_KEY, String(maxHistoryIndex));
			window.sessionStorage.setItem(
				PWA_HISTORY_ENTRIES_KEY,
				serializePwaHistoryEntries(historyEntries)
			);
		} catch {
			// Ignore storage failures; local state still powers the bar in the current session.
		}
	};

	const syncStandalonePwaState = () => {
		if (!browser) {
			isStandalonePwa = false;
			return;
		}

		const navigatorStandalone =
			typeof navigator !== 'undefined' && 'standalone' in navigator
				? Boolean((navigator as NavigatorWithStandalone).standalone)
				: false;

		isStandalonePwa = isStandaloneDisplayMode({
			matchMedia: (query) => window.matchMedia(query),
			navigatorStandalone
		});
	};

	const syncStandalonePwaChrome = () => {
		if (!browser) {
			return;
		}

		const root = document.documentElement;
		const persistedBrowserThemeColor = theme.readPersistedBrowserThemeColor();
		const persistedThemePrimary = theme.readPersistedThemeColors()?.primary ?? null;
		const chromePrimary = theme.resolveStandalonePwaChromePrimary({
			themeSource: data?.themeSource as 'db' | 'fallback' | undefined,
			liveThemePrimary: liveThemeColors?.primary ?? null,
			initialThemePrimary: initialTheme.primary,
			persistedBrowserThemeColor,
			persistedThemePrimary,
			initialPwaChromePrimary
		});
		const chromePalette = theme.generatePalette(chromePrimary);
		const chromeTextTokens = theme.resolveThemeSurfaceTextTokens(chromePalette);
		const chromePrimaryHex = theme.formatHex(chromePrimary);

		root.style.setProperty('--pwa-chrome-500', chromePrimaryHex);
		root.style.setProperty('--pwa-chrome-600', theme.formatHex(chromePalette['600']));
		root.style.setProperty('--pwa-chrome-foreground', chromeTextTokens.foreground);
		root.style.setProperty(
			'--pwa-chrome-placeholder',
			theme.buildHexAlphaColor(chromeTextTokens.foreground, 0.72)
		);
		theme.syncThemeColorMeta(chromePrimary);
	};

	const navigateBack = () => {
		if (!browser || !canGoBack) {
			return;
		}

		window.history.back();
	};

	const navigateForward = () => {
		if (!browser || !canGoForward) {
			return;
		}

		window.history.forward();
	};

	const jumpToHistoryIndex = (targetIndex: number) => {
		if (!browser || pwaHistoryCurrentIndex === null) {
			return;
		}

		const delta = targetIndex - pwaHistoryCurrentIndex;
		if (delta === 0) {
			return;
		}

		window.history.go(delta);
	};

	const reloadCurrentPage = () => {
		if (!browser) {
			return;
		}

		isReloadingStandalonePwa = true;
		try {
			markPwaReloadInFlight(window.sessionStorage);
		} catch {
			// ignore storage failures; the current document state still disables the button immediately
		}

		window.location.reload();
	};

	const navigateHome = async () => {
		if (!browser) {
			return;
		}

		await goto('/');
	};

	/** runs client-only setup after the component mounts. */
	const handleMount = () => {
		// critical: reveal is handled inside theme.init/markThemeReady only
		// do not add body.theme-ready toggles in this file or head script
		theme.init(initialTheme, { fetchCurrent: shouldFetchCurrent });
		syncStandalonePwaChrome();

		// apply select arrow once on mount
		applySelectArrowToAll();
		applyDateTabBypassToAll();
		applyRadioTabStopsToAll();

		// watch for dynamically added selects
		const observer = new MutationObserver(() => {
			applySelectArrowToAll();
			applyDateTabBypassToAll();
			applyRadioTabStopsToAll();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		syncStandalonePwaState();
		try {
			isReloadingStandalonePwa = readPwaReloadInFlight(window.sessionStorage);
		} catch {
			isReloadingStandalonePwa = false;
		}
		syncPwaHistoryState();
		const standaloneMediaQuery = window.matchMedia(STANDALONE_DISPLAY_MODE_QUERY);
		const legacyStandaloneMediaQuery = standaloneMediaQuery as MediaQueryList & {
			addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
			removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
		};
		const handleStandaloneModeChange = () => {
			syncStandalonePwaState();
			syncPwaHistoryState();
		};
		if ('addEventListener' in standaloneMediaQuery) {
			standaloneMediaQuery.addEventListener('change', handleStandaloneModeChange);
		} else if (legacyStandaloneMediaQuery.addListener) {
			legacyStandaloneMediaQuery.addListener(handleStandaloneModeChange);
		}

		window.addEventListener('pageshow', handleStandaloneModeChange);

		const clearReloadInFlight = () => {
			try {
				clearPwaReloadInFlight(window.sessionStorage);
			} catch {
				// ignore storage failures; clearing local state still restores the button
			}
			isReloadingStandalonePwa = false;
		};

		if (document.readyState === 'complete') {
			clearReloadInFlight();
		} else {
			window.addEventListener('load', clearReloadInFlight, { once: true });
		}

		return () => {
			if ('removeEventListener' in standaloneMediaQuery) {
				standaloneMediaQuery.removeEventListener('change', handleStandaloneModeChange);
			} else if (legacyStandaloneMediaQuery.removeListener) {
				legacyStandaloneMediaQuery.removeListener(handleStandaloneModeChange);
			}
			window.removeEventListener('pageshow', handleStandaloneModeChange);
			window.removeEventListener('load', clearReloadInFlight);
			observer.disconnect();
		};
	};

	onMount(handleMount);

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		if (lastActiveClientId === null) {
			lastActiveClientId = activeClientId;
			return;
		}

		if (
			clientSwitchRefreshInFlight ||
			!activeClientId ||
			!lastActiveClientId ||
			activeClientId === lastActiveClientId
		) {
			return;
		}

		lastActiveClientId = activeClientId;
		clientSwitchRefreshInFlight = true;
		void (async () => {
			try {
				await theme.init(initialTheme, { fetchCurrent: shouldFetchCurrent });
				await invalidateAll();
			} finally {
				clientSwitchRefreshInFlight = false;
			}
		})();
	});

	$effect(() => {
		if (!browser || !isStandalonePwa) {
			return;
		}

		const preventStandaloneContextMenu = (event: MouseEvent) => {
			event.preventDefault();
		};

		// installed app windows should not expose the browser's native right-click menu.
		window.addEventListener('contextmenu', preventStandaloneContextMenu);

		return () => {
			window.removeEventListener('contextmenu', preventStandaloneContextMenu);
		};
	});

	afterNavigate((navigation) => {
		syncStandalonePwaState();
		syncPwaHistoryState((navigation.type as NavigationKind) ?? null);
	});

	$effect(() => {
		if (!browser) {
			return;
		}

		syncStandalonePwaChrome();
	});

	$effect(() => {
		if (!browser || !isStandalonePwa) {
			return;
		}

		const html = document.documentElement;
		const body = document.body;
		const previousHtmlOverflow = html.style.overflow;
		const previousHtmlScrollbarGutter = html.style.scrollbarGutter;
		const previousBodyOverflow = body.style.overflow;
		const previousBodyScrollbarGutter = body.style.scrollbarGutter;

		html.style.overflow = 'hidden';
		html.style.scrollbarGutter = 'auto';
		body.style.overflow = 'hidden';
		body.style.scrollbarGutter = 'auto';

		return () => {
			html.style.overflow = previousHtmlOverflow;
			html.style.scrollbarGutter = previousHtmlScrollbarGutter;
			body.style.overflow = previousBodyOverflow;
			body.style.scrollbarGutter = previousBodyScrollbarGutter;
		};
	});
</script>

<svelte:head>
	<!-- critical: keep server-side theme vars in head so first visible frame is themed -->
	<style id="initial-theme-vars">
{initialThemeVarsCss}
	</style>
	<script id="initial-theme-data" type="application/json">
		{initialThemeJson}
	</script>
	<script id="zinc-palette-data" type="application/json">
		{zincPaletteJson}
	</script>
	<script id="theme-storage-key-data" type="application/json">
		{themeStorageKeyJson}
	</script>
	<script id="pwa-chrome-primary-data" type="application/json">
		{pwaChromePrimaryJson}
	</script>
	<script>
		(() => {
			// critical: this head script may set variables/meta only
			// do not reveal body visibility from here
			const hexToRgb = (hex) => {
				const cleanHex = hex.replace('#', '');
				return {
					r: parseInt(cleanHex.substring(0, 2), 16),
					g: parseInt(cleanHex.substring(2, 4), 16),
					b: parseInt(cleanHex.substring(4, 6), 16)
				};
			};

			const rgbToHex = (r, g, b) => {
				const toHex = (c) => {
					const hex = Math.round(c).toString(16);
					return hex.length === 1 ? '0' + hex : hex;
				};
				return (toHex(r) + toHex(g) + toHex(b)).toUpperCase();
			};

			const mix = (color, mixColor, weight) => ({
				r: color.r + (mixColor.r - color.r) * weight,
				g: color.g + (mixColor.g - color.g) * weight,
				b: color.b + (mixColor.b - color.b) * weight
			});

			const generatePalette = (baseHex) => {
				const base = hexToRgb(baseHex);
				const white = { r: 255, g: 255, b: 255 };
				const black = { r: 0, g: 0, b: 0 };
				const cleanBaseHex = baseHex.replace('#', '').toUpperCase();

				return {
					'05': rgbToHex(
						mix(base, white, 0.975).r,
						mix(base, white, 0.975).g,
						mix(base, white, 0.975).b
					),
					25: rgbToHex(
						mix(base, white, 0.8625).r,
						mix(base, white, 0.8625).g,
						mix(base, white, 0.8625).b
					),
					50: rgbToHex(
						mix(base, white, 0.75).r,
						mix(base, white, 0.75).g,
						mix(base, white, 0.75).b
					),
					100: rgbToHex(
						mix(base, white, 0.6).r,
						mix(base, white, 0.6).g,
						mix(base, white, 0.6).b
					),
					200: rgbToHex(
						mix(base, white, 0.4).r,
						mix(base, white, 0.4).g,
						mix(base, white, 0.4).b
					),
					300: rgbToHex(
						mix(base, white, 0.25).r,
						mix(base, white, 0.25).g,
						mix(base, white, 0.25).b
					),
					400: rgbToHex(
						mix(base, white, 0.1).r,
						mix(base, white, 0.1).g,
						mix(base, white, 0.1).b
					),
					500: cleanBaseHex,
					600: rgbToHex(
						mix(base, black, 0.1).r,
						mix(base, black, 0.1).g,
						mix(base, black, 0.1).b
					),
					700: rgbToHex(
						mix(base, black, 0.2625).r,
						mix(base, black, 0.2625).g,
						mix(base, black, 0.2625).b
					),
					800: rgbToHex(
						mix(base, black, 0.425).r,
						mix(base, black, 0.425).g,
						mix(base, black, 0.425).b
					),
					900: rgbToHex(
						mix(base, black, 0.5875).r,
						mix(base, black, 0.5875).g,
						mix(base, black, 0.5875).b
					),
					950: rgbToHex(
						mix(base, black, 0.75).r,
						mix(base, black, 0.75).g,
						mix(base, black, 0.75).b
					)
				};
			};

			const getLuminance = (hex) => {
				const color = hexToRgb(hex);
				const channels = [color.r, color.g, color.b].map((value) => {
					const normalized = value / 255;
					return normalized <= 0.03928
						? normalized / 12.92
						: Math.pow((normalized + 0.055) / 1.055, 2.4);
				});

				return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
			};

			const getContrastRatio = (foregroundHex, backgroundHex) => {
				const foreground = getLuminance(foregroundHex);
				const background = getLuminance(backgroundHex);
				const lighter = Math.max(foreground, background);
				const darker = Math.min(foreground, background);

				return (lighter + 0.05) / (darker + 0.05);
			};

			const getMinimumShadeContrast = (palette, textShade, backgroundShades) => {
				const textHex = palette[textShade];
				if (!textHex) {
					return 0;
				}

				return backgroundShades.reduce((lowestContrast, backgroundShade) => {
					const backgroundHex = palette[backgroundShade];
					if (!backgroundHex) {
						return lowestContrast;
					}

					return Math.min(lowestContrast, getContrastRatio(textHex, backgroundHex));
				}, Number.POSITIVE_INFINITY);
			};

			const pickBestContrastShade = (palette, candidateShades, backgroundShades, minimumContrast = 4.5) => {
				return (
					candidateShades
						.map((shade) => ({
							shade,
							minimumContrast: getMinimumShadeContrast(palette, shade, backgroundShades)
						}))
						.sort((left, right) => {
							const leftPasses = left.minimumContrast >= minimumContrast ? 1 : 0;
							const rightPasses = right.minimumContrast >= minimumContrast ? 1 : 0;

							if (leftPasses !== rightPasses) {
								return rightPasses - leftPasses;
							}

							return right.minimumContrast - left.minimumContrast;
						})[0]?.shade ?? candidateShades[0]
				);
			};

			const resolveSurfaceTextTokens = (palette) => {
				const backgroundShades = ['400', '500', '600'];
				const foregroundShade = pickBestContrastShade(palette, ['05', '950'], backgroundShades);
				const mutedShade =
					foregroundShade === '950'
						? pickBestContrastShade(palette, ['900', '950'], backgroundShades)
						: pickBestContrastShade(palette, ['50', '05'], backgroundShades);

				return {
					foreground: '#' + palette[foregroundShade],
					muted: '#' + palette[mutedShade]
				};
			};

			const buildHexAlphaColor = (hex, alpha) => {
				const color = hexToRgb(hex);
				return `rgb(${color.r} ${color.g} ${color.b} / ${alpha})`;
			};

			function buildInlineThemeScript(themeInput, zincPaletteInput) {
				const root = document.documentElement;
				const primary = generatePalette(themeInput.primary);
				const secondary = generatePalette(themeInput.secondary);
				const neutral =
					themeInput.neutral && themeInput.neutral.trim() !== ''
						? generatePalette(themeInput.neutral)
						: zincPaletteInput;
				const primaryTextTokens = resolveSurfaceTextTokens(primary);
				const secondaryTextTokens = resolveSurfaceTextTokens(secondary);

				for (const [shade, value] of Object.entries(primary)) {
					root.style.setProperty('--color-primary-' + shade, '#' + value);
				}
				for (const [shade, value] of Object.entries(secondary)) {
					root.style.setProperty('--color-secondary-' + shade, '#' + value);
				}
				for (const [shade, value] of Object.entries(neutral)) {
					root.style.setProperty('--color-neutral-' + shade, '#' + value);
				}
				root.style.setProperty('--color-primary-foreground', primaryTextTokens.foreground);
				root.style.setProperty('--color-primary-foreground-muted', primaryTextTokens.muted);
				root.style.setProperty('--color-secondary-foreground', secondaryTextTokens.foreground);
				root.style.setProperty('--color-secondary-foreground-muted', secondaryTextTokens.muted);
			}

			const defaultTheme = {
				primary: 'CE1126',
				secondary: '14213D',
				neutral: 'EEDBCE'
			};
			const defaultZinc = {
				'05': 'FEFEFE',
				25: 'FDFDFD',
				50: 'FAFAFA',
				100: 'F4F4F5',
				200: 'E4E4E7',
				300: 'D4D4D8',
				400: 'A1A1AA',
				500: '71717A',
				600: '52525B',
				700: '3F3F46',
				800: '27272A',
				900: '18181B',
				950: '09090B'
			};

			let safeTheme = defaultTheme;
			let safeZinc = defaultZinc;
			let themeStorageKey = 'current-theme';
			let browserThemeColorStorageKey = 'playims:theme-color';
			let initialPwaChromePrimary = defaultTheme.primary;

			const themeElement = document.getElementById('initial-theme-data');
			const zincElement = document.getElementById('zinc-palette-data');
			const themeStorageKeyElement = document.getElementById('theme-storage-key-data');
			const pwaChromePrimaryElement = document.getElementById('pwa-chrome-primary-data');
			const themeEtagMeta = document.querySelector('meta[name="theme-etag"]');

			const readStoredTheme = () => {
				try {
					const stored =
						window.localStorage.getItem(themeStorageKey) ??
						window.sessionStorage.getItem(themeStorageKey);
					if (!stored) {
						return null;
					}

					const parsed = JSON.parse(stored);
					const normalizeHex = (value) =>
						typeof value === 'string' ? value.replace('#', '').toUpperCase() : '';
					const hexPattern = /^[0-9A-F]{6}$/;
					const primary = normalizeHex(parsed?.primary);
					const secondary = normalizeHex(parsed?.secondary);
					const neutral = normalizeHex(parsed?.neutral);

					if (!hexPattern.test(primary) || !hexPattern.test(secondary)) {
						return null;
					}

					if (neutral !== '' && !hexPattern.test(neutral)) {
						return null;
					}

					return { primary, secondary, neutral };
				} catch {
					return null;
				}
			};

			const readStoredBrowserThemeColor = () => {
				try {
					const stored =
						window.localStorage.getItem(browserThemeColorStorageKey) ??
						window.sessionStorage.getItem(browserThemeColorStorageKey);
					if (!stored) {
						return null;
					}

					const normalized = stored.replace('#', '').toUpperCase();
					return /^[0-9A-F]{6}$/.test(normalized) ? normalized : null;
				} catch {
					return null;
				}
			};

			try {
				if (themeElement?.textContent) {
					safeTheme = JSON.parse(themeElement.textContent);
				}
			} catch {}

			try {
				if (themeStorageKeyElement?.textContent) {
					themeStorageKey = JSON.parse(themeStorageKeyElement.textContent);
				}
			} catch {}

			try {
				if (pwaChromePrimaryElement?.textContent) {
					initialPwaChromePrimary = JSON.parse(pwaChromePrimaryElement.textContent);
				}
			} catch {}

			try {
				if (zincElement?.textContent) {
					safeZinc = JSON.parse(zincElement.textContent);
				}
			} catch {}

			const storedTheme = readStoredTheme();
			const storedBrowserThemeColor = readStoredBrowserThemeColor();
			const shouldPreferStoredTheme =
				themeEtagMeta?.getAttribute('content') === 'W/"theme-empty"' && storedTheme;
			if (shouldPreferStoredTheme) {
				safeTheme = storedTheme;
			}

			buildInlineThemeScript(safeTheme, safeZinc);

			const root = document.documentElement;
			const chromePrimary =
				themeEtagMeta?.getAttribute('content') === 'W/"theme-empty"'
					? storedBrowserThemeColor ?? (shouldPreferStoredTheme ? storedTheme.primary : initialPwaChromePrimary)
					: initialPwaChromePrimary;
			const chromePalette = generatePalette(chromePrimary);
			const chromeTextTokens = resolveSurfaceTextTokens(chromePalette);
			root.style.setProperty('--pwa-chrome-500', '#' + chromePrimary);
			root.style.setProperty('--pwa-chrome-600', '#' + chromePalette['600']);
			root.style.setProperty('--pwa-chrome-foreground', chromeTextTokens.foreground);
			root.style.setProperty(
				'--pwa-chrome-placeholder',
				buildHexAlphaColor(chromeTextTokens.foreground, 0.72)
			);
		})();
	</script>
	<meta name="theme-etag" content={themeEtag} />
</svelte:head>

<div
	class:app--standalone-pwa={isStandalonePwa}
	class="app"
	style={appShellStyle}
>
	{#if isStandalonePwa}
		<UrlBar
			{canGoBack}
			{canGoForward}
			{backHistoryEntries}
			{forwardHistoryEntries}
			isReloading={isReloadingStandalonePwa}
			onBack={navigateBack}
			onForward={navigateForward}
			onJumpToHistory={jumpToHistoryIndex}
			onReload={reloadCurrentPage}
			onHome={navigateHome}
		/>
	{/if}
	<main class="app-main">
		{@render children()}
	</main>
	<Toaster />
</div>
