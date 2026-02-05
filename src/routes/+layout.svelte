<script lang="ts">
	import { onMount } from 'svelte';
	import 'virtual:pwa-assets/head';
	// import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	import '../app.css';
	import * as theme from '$lib/theme';
	import { selectArrow } from '$lib/actions';

	let { children, data } = $props();
	// injectSpeedInsights();

	let initialTheme = $derived((data?.theme as theme.ThemeColors | null) ?? theme.DEFAULT_THEME);
	let shouldFetchCurrent = $derived((data?.themeSource as 'db' | 'fallback' | undefined) !== 'db');

	let themeEtag = $derived((data?.themeEtag as string | undefined) ?? 'W/"theme-empty"');
	const buildInlineThemeScript = (colors: theme.ThemeColors) => {
		const themeJson = JSON.stringify(colors ?? theme.DEFAULT_THEME);
		const zincJson = JSON.stringify(theme.ZINC_PALETTE);

		return `(function () {
			const theme = ${themeJson};
			const ZINC_PALETTE = ${zincJson};

			function generatePalette(baseHex) {
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

				const base = hexToRgb(baseHex);
				const white = { r: 255, g: 255, b: 255 };
				const black = { r: 0, g: 0, b: 0 };
				const cleanBaseHex = baseHex.replace('#', '').toUpperCase();

				return {
					25: rgbToHex(mix(base, white, 0.975).r, mix(base, white, 0.975).g, mix(base, white, 0.975).b),
					50: rgbToHex(mix(base, white, 0.75).r, mix(base, white, 0.75).g, mix(base, white, 0.75).b),
					100: rgbToHex(mix(base, white, 0.6).r, mix(base, white, 0.6).g, mix(base, white, 0.6).b),
					200: rgbToHex(mix(base, white, 0.4).r, mix(base, white, 0.4).g, mix(base, white, 0.4).b),
					300: rgbToHex(mix(base, white, 0.25).r, mix(base, white, 0.25).g, mix(base, white, 0.25).b),
					400: rgbToHex(mix(base, white, 0.1).r, mix(base, white, 0.1).g, mix(base, white, 0.1).b),
					500: cleanBaseHex,
					600: rgbToHex(mix(base, black, 0.1).r, mix(base, black, 0.1).g, mix(base, black, 0.1).b),
					700: rgbToHex(mix(base, black, 0.2625).r, mix(base, black, 0.2625).g, mix(base, black, 0.2625).b),
					800: rgbToHex(mix(base, black, 0.425).r, mix(base, black, 0.425).g, mix(base, black, 0.425).b),
					900: rgbToHex(mix(base, black, 0.5875).r, mix(base, black, 0.5875).g, mix(base, black, 0.5875).b),
					950: rgbToHex(mix(base, black, 0.75).r, mix(base, black, 0.75).g, mix(base, black, 0.75).b)
				};
			}

			const root = document.documentElement;
			const primary = generatePalette(theme.primary);
			const secondary = generatePalette(theme.secondary);
			const accent = generatePalette(theme.accent);
			const neutral =
				theme.neutral && theme.neutral.trim() !== ''
					? generatePalette(theme.neutral)
					: ZINC_PALETTE;

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

			const primary500 = primary[500] || theme.primary;
			const metaColor = primary500.startsWith('#') ? primary500 : '#' + primary500;
			let themeColorMeta = document.querySelector('meta[name="theme-color"]');
			if (!themeColorMeta) {
				themeColorMeta = document.createElement('meta');
				themeColorMeta.setAttribute('name', 'theme-color');
				document.head.appendChild(themeColorMeta);
			}
			themeColorMeta.setAttribute('content', metaColor);

			if (document.body) {
				document.body.classList.add('theme-ready');
			} else {
				document.addEventListener('DOMContentLoaded', function () {
					document.body && document.body.classList.add('theme-ready');
				});
			}
		})()`;
	};

	let inlineThemeScript = $derived(buildInlineThemeScript(initialTheme));

	onMount(() => {
		theme.init(initialTheme, { fetchCurrent: shouldFetchCurrent });

		// Automatically apply selectArrow action to all themed select elements
		function applySelectArrowToAll() {
			const selects = document.querySelectorAll<HTMLSelectElement>(
				'select.select-primary, select.select-secondary, select.select-accent'
			);
			selects.forEach((select) => {
				// Only apply if not already applied (check for a data attribute)
				if (!select.dataset.selectArrowApplied) {
					select.dataset.selectArrowApplied = 'true';
					selectArrow(select);
				}
			});
		}

		// Apply immediately
		applySelectArrowToAll();

		// Watch for new selects added dynamically
		const observer = new MutationObserver(() => {
			applySelectArrowToAll();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		return () => {
			observer.disconnect();
		};
	});
</script>

<svelte:head>
	{@html `<script>${inlineThemeScript}</script>`}
	<meta name="theme-etag" content={themeEtag} />
</svelte:head>

<div class="app">
	<main>
		{@render children()}
	</main>
</div>
