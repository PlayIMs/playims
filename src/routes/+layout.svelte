<script lang="ts">
	import { onMount } from 'svelte';
	import 'virtual:pwa-assets/head';
	// import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';
	import * as theme from '$lib/theme';
	import { forceRadioTabStop, selectArrow, skipDatePickerTabStop } from '$lib/actions';

	let { children, data } = $props();
	// injectSpeedInsights();

	// use the server-provided theme as the initial paint values
	let initialTheme = $derived((data?.theme as theme.ThemeColors | null) ?? theme.DEFAULT_THEME);
	// only fetch the current theme when the server did not provide one
	let shouldFetchCurrent = $derived((data?.themeSource as 'db' | 'fallback' | undefined) !== 'db');

	let themeEtag = $derived((data?.themeEtag as string | undefined) ?? 'W/"theme-empty"');
	// serialize theme payloads for a blocking script in svelte:head
	let initialThemeJson = $derived(JSON.stringify(initialTheme ?? theme.DEFAULT_THEME));
	let zincPaletteJson = $derived(JSON.stringify(theme.ZINC_PALETTE));
	// render css vars on the server so first paint already uses the active theme
	const buildThemeVarsCss = (colors: theme.ThemeColors) => {
		const primary = theme.generatePalette(colors.primary);
		const secondary = theme.generatePalette(colors.secondary);
		const accent = theme.generatePalette(colors.accent);
		const neutral =
			colors.neutral && colors.neutral.trim() !== ''
				? theme.generatePalette(colors.neutral)
				: theme.ZINC_PALETTE;

		const toCssVars = (
			name: 'primary' | 'secondary' | 'neutral' | 'accent',
			palette: Record<string, string>
		) =>
			Object.entries(palette)
				.map(([shade, value]) => `--color-${name}-${shade}:#${value};`)
				.join('');

		return `:root{${toCssVars('primary', primary)}${toCssVars('secondary', secondary)}${toCssVars('neutral', neutral)}${toCssVars('accent', accent)}}`;
	};
	let initialThemeVarsCss = $derived(buildThemeVarsCss(initialTheme));

	/** applies the select arrow action to themed select elements. */
	const applySelectArrowToAll = () => {
		const selects = document.querySelectorAll<HTMLSelectElement>(
			'select.select-primary, select.select-secondary, select.select-accent'
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

		return () => {
			observer.disconnect();
		};
	};

	onMount(handleMount);
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
				const accent = generatePalette(themeInput.accent);
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
				for (const [shade, value] of Object.entries(accent)) {
					root.style.setProperty('--color-accent-' + shade, '#' + value);
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
				neutral: 'EEDBCE',
				accent: '04669A'
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

<div class="app">
	<main>
		{@render children()}
	</main>
</div>
