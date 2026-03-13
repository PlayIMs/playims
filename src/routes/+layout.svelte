<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { afterNavigate, goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		IconChevronLeft,
		IconChevronRight,
		IconHome,
		IconRefresh
	} from '@tabler/icons-svelte';
	import 'virtual:pwa-assets/head';
	// import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';
	import Toaster from '$lib/components/toast/Toaster.svelte';
	import * as theme from '$lib/theme';
	import { forceRadioTabStop, selectArrow, skipDatePickerTabStop } from '$lib/actions';
	import {
		buildPwaAddressValue,
		readSvelteKitHistoryIndex,
		resolvePwaAddressInput,
		STANDALONE_DISPLAY_MODE_QUERY,
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
	let isStandalonePwa = $state(false);
	let pwaHistorySessionStart = $state<number | null>(null);
	let pwaHistoryCurrentIndex = $state<number | null>(null);
	let pwaHistoryMaxIndex = $state<number | null>(null);
	let isAddressEditing = $state(false);
	let addressInputValue = $state('');
	// render css vars on the server so first paint already uses the active theme
	const buildThemeVarsCss = (colors: theme.ThemeColors) => {
		const primary = theme.generatePalette(colors.primary);
		const secondary = theme.generatePalette(colors.secondary);
		const neutral =
			colors.neutral && colors.neutral.trim() !== ''
				? theme.generatePalette(colors.neutral)
				: theme.ZINC_PALETTE;

		const toCssVars = (
			name: 'primary' | 'secondary' | 'neutral',
			palette: Record<string, string>
		) =>
			Object.entries(palette)
				.map(([shade, value]) => `--color-${name}-${shade}:#${value};`)
				.join('');

		return `:root{${toCssVars('primary', primary)}${toCssVars('secondary', secondary)}${toCssVars('neutral', neutral)}}`;
	};
	let initialThemeVarsCss = $derived(buildThemeVarsCss(initialTheme));

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
	const currentAddressValue = $derived.by(() => buildPwaAddressValue($page.url));
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
			return;
		}

		const currentHistoryIndex = readSvelteKitHistoryIndex(window.history.state);
		if (currentHistoryIndex === null) {
			pwaHistorySessionStart = null;
			pwaHistoryCurrentIndex = null;
			pwaHistoryMaxIndex = null;
			return;
		}

		let sessionStart = parseStoredHistoryIndex(
			window.sessionStorage.getItem(PWA_HISTORY_SESSION_START_KEY)
		);
		let maxHistoryIndex = parseStoredHistoryIndex(window.sessionStorage.getItem(PWA_HISTORY_MAX_KEY));

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

		try {
			window.sessionStorage.setItem(PWA_HISTORY_SESSION_START_KEY, String(sessionStart));
			window.sessionStorage.setItem(PWA_HISTORY_MAX_KEY, String(maxHistoryIndex));
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

	const reloadCurrentPage = () => {
		if (!browser) {
			return;
		}

		window.location.reload();
	};

	const navigateHome = async () => {
		if (!browser) {
			return;
		}

		await goto('/');
	};

	const beginAddressEditing = (event: FocusEvent) => {
		isAddressEditing = true;
		const target = event.currentTarget;
		if (target instanceof HTMLInputElement) {
			target.select();
		}
	};

	const finishAddressEditing = () => {
		isAddressEditing = false;
		addressInputValue = currentAddressValue;
	};

	const handleAddressSubmit = async (event: SubmitEvent) => {
		event.preventDefault();
		if (!browser) {
			return;
		}

		const targetUrl = resolvePwaAddressInput(addressInputValue, $page.url);
		if (!targetUrl) {
			finishAddressEditing();
			return;
		}

		isAddressEditing = false;

		if (targetUrl.origin === window.location.origin) {
			const nextHref = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
			const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
			addressInputValue = buildPwaAddressValue(targetUrl);
			if (nextHref === currentHref) {
				return;
			}

			await goto(nextHref);
			return;
		}

		window.location.assign(targetUrl.href);
	};

	/** runs client-only setup after the component mounts. */
	const handleMount = () => {
		// critical: reveal is handled inside theme.init/markThemeReady only
		// do not add body.theme-ready toggles in this file or head script
		theme.init(initialTheme, { fetchCurrent: shouldFetchCurrent });

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

		return () => {
			observer.disconnect();
			if ('removeEventListener' in standaloneMediaQuery) {
				standaloneMediaQuery.removeEventListener('change', handleStandaloneModeChange);
			} else if (legacyStandaloneMediaQuery.removeListener) {
				legacyStandaloneMediaQuery.removeListener(handleStandaloneModeChange);
			}
			window.removeEventListener('pageshow', handleStandaloneModeChange);
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
		if (isAddressEditing) {
			return;
		}

		addressInputValue = currentAddressValue;
	});

	afterNavigate((navigation) => {
		syncStandalonePwaState();
		syncPwaHistoryState((navigation.type as NavigationKind) ?? null);
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
	<script>
		(() => {
			// critical: this head script may set variables/meta only
			// do not reveal body visibility from here
			function buildInlineThemeScript(themeInput, zincPaletteInput) {
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

				const root = document.documentElement;
				const primary = generatePalette(themeInput.primary);
				const secondary = generatePalette(themeInput.secondary);
				const neutral =
					themeInput.neutral && themeInput.neutral.trim() !== ''
						? generatePalette(themeInput.neutral)
						: zincPaletteInput;

				for (const [shade, value] of Object.entries(primary)) {
					root.style.setProperty('--color-primary-' + shade, '#' + value);
				}
				for (const [shade, value] of Object.entries(secondary)) {
					root.style.setProperty('--color-secondary-' + shade, '#' + value);
				}
				for (const [shade, value] of Object.entries(neutral)) {
					root.style.setProperty('--color-neutral-' + shade, '#' + value);
				}

				const primary500 = primary[500] || themeInput.primary;
				const metaColor = primary500.startsWith('#') ? primary500 : '#' + primary500;
				const themeColorMeta = document.querySelector('meta[name="theme-color"]');
				if (themeColorMeta) {
					themeColorMeta.setAttribute('content', metaColor);
				}
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

			const themeElement = document.getElementById('initial-theme-data');
			const zincElement = document.getElementById('zinc-palette-data');

			try {
				if (themeElement?.textContent) {
					safeTheme = JSON.parse(themeElement.textContent);
				}
			} catch {}

			try {
				if (zincElement?.textContent) {
					safeZinc = JSON.parse(zincElement.textContent);
				}
			} catch {}

			buildInlineThemeScript(safeTheme, safeZinc);
		})();
	</script>
	<meta name="theme-etag" content={themeEtag} />
</svelte:head>

<div class="app" style={`--pwa-top-bar-offset:${pwaTopBarOffset};`}>
	{#if isStandalonePwa}
		<div
			class="fixed inset-x-0 top-0 z-[70] bg-primary text-primary-25 shadow-[0_1px_0_rgba(255,255,255,0.18)]"
			style="padding-top: env(safe-area-inset-top, 0px);"
		>
			<form class="flex h-11 items-center gap-1 px-2" onsubmit={handleAddressSubmit}>
				<button
					type="button"
					class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-45"
					aria-label="Go back"
					disabled={!canGoBack}
					onclick={navigateBack}
				>
					<IconChevronLeft class="h-5 w-5" />
				</button>
				<button
					type="button"
					class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-45"
					aria-label="Go forward"
					disabled={!canGoForward}
					onclick={navigateForward}
				>
					<IconChevronRight class="h-5 w-5" />
				</button>
				<button
					type="button"
					class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600"
					aria-label="Reload page"
					onclick={reloadCurrentPage}
				>
					<IconRefresh class="h-4.5 w-4.5" />
				</button>
				<button
					type="button"
					class="flex h-8 w-8 cursor-pointer items-center justify-center text-primary-25 transition-colors duration-150 hover:bg-primary-600"
					aria-label="Go home"
					onclick={() => void navigateHome()}
				>
					<IconHome class="h-4.5 w-4.5" />
				</button>
				<div class="min-w-0 flex-1 bg-primary-600/80 px-3">
					<input
						type="text"
						bind:value={addressInputValue}
						class="h-8 w-full border-0 bg-transparent p-0 text-sm text-primary-25 placeholder:text-primary-100 focus:outline-none focus:ring-0"
						aria-label="Page address"
						autocapitalize="none"
						autocomplete="off"
						autocorrect="off"
						spellcheck="false"
						placeholder="Enter a URL"
						onfocus={beginAddressEditing}
						onblur={finishAddressEditing}
					/>
				</div>
			</form>
		</div>
	{/if}
	<main style="padding-top: var(--pwa-top-bar-offset, 0px);">
		{@render children()}
	</main>
	<Toaster />
</div>
