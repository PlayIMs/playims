<script lang="ts">
	import { onMount } from 'svelte';
	import IconDeviceFloppy from '@tabler/icons-svelte/icons/device-floppy';
	import IconRestore from '@tabler/icons-svelte/icons/restore';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import {
		themeColors,
		updateColor,
		resetTheme,
		formatHex,
		savedThemes,
		saveCurrentTheme,
		loadTheme,
		deleteTheme,
		renameSavedTheme,
		validateAccent,
		validateNeutral,
		validateColorNotGrayscale,
		ZINC_PALETTE
	} from '$lib/theme';

	const MAX_BRANDING_THEMES = 3;

	function autofocus(node: HTMLElement) {
		if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
			node.focus();
		}
		return {};
	}

	let primaryInput = $state('');
	let secondaryInput = $state('');
	let neutralInput = $state('');
	let accentInput = $state('');

	let primaryWarnings = $state<string[]>([]);
	let secondaryWarnings = $state<string[]>([]);
	let neutralWarnings = $state<string[]>([]);
	let accentWarnings = $state<string[]>([]);

	let openPicker: 'primary' | 'secondary' | 'neutral' | 'accent' | null = $state(null);
	let pickerColor = $state({ h: 0, s: 100, l: 50, saturation: 100 });
	let isDragging = $state(false);
	let colorAreaElement: HTMLCanvasElement | null = $state(null);
	let showNeutralPalettePicker = $state(false);

	let showSaveModal = $state(false);
	let showReplaceModal = $state(false);
	let showOverwriteModal = $state(false);
	let showRenameModal = $state(false);
	let themeNameInput = $state('');
	let replaceThemeIndex: number | null = $state(null);
	let existingThemeIndex: number | null = $state(null);
	let renameThemeId: string | null = $state(null);
	let renameThemeNameInput = $state('');

	function validateHex(hex: string): boolean {
		const cleanHex = hex.replace('#', '').toUpperCase();
		return /^[0-9A-F]{6}$/.test(cleanHex);
	}

	function syncInputsFromStore() {
		const colors = $themeColors;
		primaryInput = colors.primary;
		secondaryInput = colors.secondary;
		neutralInput = colors.neutral || '';
		accentInput = colors.accent;
		validatePrimaryColor();
		validateSecondaryColor();
		validateNeutralColor();
		validateAccentColor();
	}

	function getPickerPosition() {
		const s = pickerColor.s / 100;
		const l = pickerColor.l / 100;
		const v = l + s * Math.min(l, 1 - l);
		const s_v = v === 0 ? 0 : 2 * (1 - l / v);

		return {
			x: s_v * 100,
			y: (1 - v) * 100
		};
	}

	onMount(() => {
		const unsubscribe = themeColors.subscribe(() => {
			syncInputsFromStore();
		});

		function handleGlobalMouseMove(event: MouseEvent) {
			handleColorAreaMouseMove(event);
		}

		function handleGlobalMouseUp() {
			handleColorAreaMouseUp();
		}

		window.addEventListener('mousemove', handleGlobalMouseMove);
		window.addEventListener('mouseup', handleGlobalMouseUp);

		syncInputsFromStore();

		return () => {
			unsubscribe();
			window.removeEventListener('mousemove', handleGlobalMouseMove);
			window.removeEventListener('mouseup', handleGlobalMouseUp);
		};
	});

	function validatePrimaryColor() {
		if (validateHex(primaryInput)) {
			primaryWarnings = validateColorNotGrayscale(primaryInput, 'primary').warnings;
		} else {
			primaryWarnings = [];
		}
	}

	function validateSecondaryColor() {
		if (validateHex(secondaryInput)) {
			secondaryWarnings = validateColorNotGrayscale(secondaryInput, 'secondary').warnings;
		} else {
			secondaryWarnings = [];
		}
	}

	function validateNeutralColor() {
		if (neutralInput && validateHex(neutralInput)) {
			neutralWarnings = validateNeutral(neutralInput).warnings;
		} else {
			neutralWarnings = [];
		}
	}

	function validateAccentColor() {
		if (validateHex(accentInput)) {
			accentWarnings = validateAccent(accentInput, neutralInput).warnings;
		} else {
			accentWarnings = [];
		}
	}

	function handlePrimaryChange() {
		if (validateHex(primaryInput)) {
			updateColor('primary', primaryInput);
			validatePrimaryColor();
		}
	}

	function handleSecondaryChange() {
		if (validateHex(secondaryInput)) {
			updateColor('secondary', secondaryInput);
			validateSecondaryColor();
		}
	}

	function handleNeutralChange() {
		if (validateHex(neutralInput)) {
			updateColor('neutral', neutralInput);
			validateNeutralColor();
		} else if (neutralInput === '') {
			updateColor('neutral', '');
			neutralWarnings = [];
		}
	}

	function handleAccentChange() {
		if (validateHex(accentInput)) {
			updateColor('accent', accentInput);
			validateAccentColor();
		}
	}

	function getCurrentColorHex(colorName: 'primary' | 'secondary' | 'neutral' | 'accent'): string {
		const color = $themeColors[colorName];
		if (colorName === 'neutral' && (!color || color.trim() === '')) {
			return `#${ZINC_PALETTE['500']}`;
		}
		return formatHex(color);
	}

	function getSavedThemeColorHex(
		colors: { primary: string; secondary: string; neutral: string; accent: string },
		colorName: 'primary' | 'secondary' | 'neutral' | 'accent'
	): string {
		const color = colors[colorName];
		if (colorName === 'neutral' && (!color || color.trim() === '')) {
			return `#${ZINC_PALETTE['500']}`;
		}
		return formatHex(color);
	}

	const NEUTRAL_GRAY_PRESETS = ['FAFAFA', 'F5F5F5', 'EFEFEF', 'E8E8E8'];
	const NEUTRAL_BEIGE_PRESETS = ['FAF6F0', 'F5EEE3', 'EFE4D5', 'E7D8C5'];

	function buildMutedNeutralShades(baseHex: string, saturation: number): string[] {
		if (!validateHex(baseHex)) {
			return [];
		}

		const { h } = hexToHsl(baseHex);
		const lightnessValues = [96, 92, 88, 84];
		return lightnessValues.map((lightness) => hslToHex(h, saturation, lightness));
	}

	function getNeutralPaletteOptions(): string[] {
		const primaryBase = validateHex(primaryInput) ? primaryInput : $themeColors.primary;
		const secondaryBase = validateHex(secondaryInput) ? secondaryInput : $themeColors.secondary;

		const options = [
			...buildMutedNeutralShades(primaryBase, 12),
			...buildMutedNeutralShades(secondaryBase, 10),
			...NEUTRAL_GRAY_PRESETS,
			...NEUTRAL_BEIGE_PRESETS
		].map((hex) => hex.replace('#', '').toUpperCase());

		return [...new Set(options)];
	}

	function hexToHsl(hex: string): { h: number; s: number; l: number } {
		const cleanHex = hex.replace('#', '');
		const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
		const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
		const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

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

	function hslToHex(h: number, s: number, l: number): string {
		s /= 100;
		l /= 100;

		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = l - c / 2;
		let r = 0;
		let g = 0;
		let b = 0;

		if (0 <= h && h < 60) {
			r = c;
			g = x;
			b = 0;
		} else if (60 <= h && h < 120) {
			r = x;
			g = c;
			b = 0;
		} else if (120 <= h && h < 180) {
			r = 0;
			g = c;
			b = x;
		} else if (180 <= h && h < 240) {
			r = 0;
			g = x;
			b = c;
		} else if (240 <= h && h < 300) {
			r = x;
			g = 0;
			b = c;
		} else if (300 <= h && h < 360) {
			r = c;
			g = 0;
			b = x;
		}

		r = Math.round((r + m) * 255);
		g = Math.round((g + m) * 255);
		b = Math.round((b + m) * 255);

		return [r, g, b]
			.map((value) => {
				const hex = value.toString(16);
				return hex.length === 1 ? `0${hex}` : hex;
			})
			.join('')
			.toUpperCase();
	}

	function applySaturationToHex(hex: string, saturation: number): string {
		const cleanHex = hex.replace('#', '');
		const factor = Math.max(0, Math.min(100, saturation)) / 100;
		const r = parseInt(cleanHex.substring(0, 2), 16);
		const g = parseInt(cleanHex.substring(2, 4), 16);
		const b = parseInt(cleanHex.substring(4, 6), 16);

		const toHex = (value: number) => {
			const saturated = Math.round(255 - (255 - value) * factor);
			const clamped = Math.max(0, Math.min(255, saturated));
			const result = clamped.toString(16);
			return result.length === 1 ? `0${result}` : result;
		};

		return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
	}

	function getPickerHex(): string {
		const baseHex = hslToHex(pickerColor.h, pickerColor.s, pickerColor.l);
		return applySaturationToHex(baseHex, pickerColor.saturation);
	}

	function openNeutralPaletteModal() {
		showNeutralPalettePicker = true;
	}

	function closeNeutralPaletteModal() {
		showNeutralPalettePicker = false;
	}

	function applyNeutralPreset(hex: string) {
		neutralInput = hex.replace('#', '').toUpperCase();
		handleNeutralChange();
		showNeutralPalettePicker = false;
	}

	function openColorPicker(colorName: 'primary' | 'secondary' | 'neutral' | 'accent') {
		let currentHex = $themeColors[colorName];
		if (colorName === 'neutral' && (!currentHex || currentHex.trim() === '')) {
			currentHex = ZINC_PALETTE['500'];
		}
		const hsl = hexToHsl(currentHex);
		pickerColor = { ...hsl, saturation: 100 };
		openPicker = colorName;

		setTimeout(() => {
			drawColorArea();
		}, 0);
	}

	function closeColorPicker() {
		openPicker = null;
	}

	function updatePickerColor() {
		if (!openPicker) return;
		const hex = getPickerHex();
		updateColor(openPicker, hex);

		if (openPicker === 'primary') {
			primaryInput = hex;
			validatePrimaryColor();
		} else if (openPicker === 'secondary') {
			secondaryInput = hex;
			validateSecondaryColor();
		} else if (openPicker === 'neutral') {
			neutralInput = hex;
			validateNeutralColor();
		} else if (openPicker === 'accent') {
			accentInput = hex;
			validateAccentColor();
		}
	}

	function drawColorArea() {
		if (!colorAreaElement) return;
		const canvas = colorAreaElement;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const width = canvas.width;
		const height = canvas.height;

		ctx.fillStyle = `hsl(${pickerColor.h}, 100%, 50%)`;
		ctx.fillRect(0, 0, width, height);

		const gradWhite = ctx.createLinearGradient(0, 0, width, 0);
		gradWhite.addColorStop(0, 'rgba(255,255,255,1)');
		gradWhite.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = gradWhite;
		ctx.fillRect(0, 0, width, height);

		const gradBlack = ctx.createLinearGradient(0, 0, 0, height);
		gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
		gradBlack.addColorStop(1, 'rgba(0,0,0,1)');
		ctx.fillStyle = gradBlack;
		ctx.fillRect(0, 0, width, height);
	}

	function updateColorFromPosition(x: number, y: number, element: HTMLCanvasElement) {
		const rect = element.getBoundingClientRect();
		const relX = Math.max(0, Math.min(rect.width, x - rect.left));
		const relY = Math.max(0, Math.min(rect.height, y - rect.top));
		const s_hsv = relX / rect.width;
		const v = 1 - relY / rect.height;
		const l = v * (1 - s_hsv / 2);
		let s_hsl = 0;
		if (l > 0 && l < 1) {
			s_hsl = (v - l) / Math.min(l, 1 - l);
		}

		pickerColor.s = Math.round(s_hsl * 100);
		pickerColor.l = Math.round(l * 100);
		updatePickerColor();
	}

	function handleColorAreaMouseDown(event: MouseEvent) {
		isDragging = true;
		updateColorFromPosition(event.clientX, event.clientY, event.currentTarget as HTMLCanvasElement);
	}

	function handleColorAreaMouseMove(event: MouseEvent) {
		if (isDragging && colorAreaElement) {
			updateColorFromPosition(event.clientX, event.clientY, colorAreaElement);
		}
	}

	function handleColorAreaMouseUp() {
		isDragging = false;
	}

	function handleColorAreaClick(event: MouseEvent) {
		updateColorFromPosition(event.clientX, event.clientY, event.currentTarget as HTMLCanvasElement);
	}

	function handleHueChange(event: Event) {
		const target = event.target as HTMLInputElement;
		pickerColor.h = parseInt(target.value, 10);
		updatePickerColor();
	}

	function handleSaturationChange(event: Event) {
		const target = event.target as HTMLInputElement;
		pickerColor.saturation = parseInt(target.value, 10);
		updatePickerColor();
	}

	function getActivePickerWarnings(): string[] {
		if (openPicker === 'primary') return primaryWarnings;
		if (openPicker === 'secondary') return secondaryWarnings;
		if (openPicker === 'neutral') return neutralWarnings;
		if (openPicker === 'accent') return accentWarnings;
		return [];
	}

	function openSaveModal() {
		showSaveModal = true;
		themeNameInput = '';
		replaceThemeIndex = null;
		existingThemeIndex = null;
	}

	function closeThemeModals() {
		showSaveModal = false;
		showReplaceModal = false;
		showOverwriteModal = false;
		themeNameInput = '';
		replaceThemeIndex = null;
		existingThemeIndex = null;
	}

	async function handleSaveTheme() {
		const name = themeNameInput.trim();
		if (!name) {
			alert('Please enter a theme name.');
			return;
		}

		const existingIndex = $savedThemes.findIndex(
			(theme) => theme.name.toLowerCase() === name.toLowerCase()
		);

		if (existingIndex !== -1 && replaceThemeIndex !== existingIndex) {
			existingThemeIndex = existingIndex;
			showSaveModal = false;
			showOverwriteModal = true;
			return;
		}

		if (replaceThemeIndex === null && $savedThemes.length >= MAX_BRANDING_THEMES) {
			showSaveModal = false;
			showReplaceModal = true;
			return;
		}

		const result = await saveCurrentTheme(name, replaceThemeIndex ?? undefined);
		if (result === null) {
			showSaveModal = false;
			showReplaceModal = true;
			return;
		}

		closeThemeModals();
	}

	async function handleOverwriteTheme() {
		if (existingThemeIndex === null) return;
		replaceThemeIndex = existingThemeIndex;
		showOverwriteModal = false;
		await handleSaveTheme();
	}

	async function handleReplaceTheme(index: number) {
		replaceThemeIndex = index;
		if (!themeNameInput.trim()) {
			themeNameInput = $savedThemes[index].name;
		}
		showReplaceModal = false;
		await handleSaveTheme();
	}

	async function handleLoadTheme(themeId: string) {
		await loadTheme(themeId);
		syncInputsFromStore();
	}

	async function handleDeleteTheme(themeId: string, event: Event) {
		event.stopPropagation();
		if (confirm('Delete this saved theme?')) {
			await deleteTheme(themeId);
		}
	}

	function openRenameModal(themeId: string, name: string, event: Event) {
		event.stopPropagation();
		renameThemeId = themeId;
		renameThemeNameInput = name;
		showRenameModal = true;
	}

	function closeRenameModal() {
		showRenameModal = false;
		renameThemeId = null;
		renameThemeNameInput = '';
	}

	async function handleRenameTheme() {
		if (!renameThemeId) return;
		const name = renameThemeNameInput.trim();
		if (!name) {
			alert('Please enter a theme name.');
			return;
		}

		const hasDuplicate = $savedThemes.some(
			(theme) => theme.id !== renameThemeId && theme.name.toLowerCase() === name.toLowerCase()
		);
		if (hasDuplicate) {
			alert('A saved theme with that name already exists.');
			return;
		}

		const renamed = await renameSavedTheme(renameThemeId, name);
		if (!renamed) {
			alert('Unable to rename theme right now. Please try again.');
			return;
		}

		closeRenameModal();
	}

	function handleReset() {
		resetTheme();
	}

	let pickerPos = $derived(getPickerPosition());
	let activePickerWarnings = $derived(getActivePickerWarnings());
	let neutralPaletteOptions = $derived(getNeutralPaletteOptions());

	$effect(() => {
		if (openPicker && colorAreaElement) {
			drawColorArea();
		}
	});

	$effect(() => {
		neutralInput;
		if (validateHex(accentInput)) {
			validateAccentColor();
		}
	});
</script>

<svelte:head>
	<title>Branding Settings - PlayIMs</title>
	<meta
		name="description"
		content="Set your organization color system and manage reusable branding themes."
	/>
</svelte:head>

<div class="w-full space-y-4">
	<header class="border-2 border-secondary-300 bg-neutral p-4 lg:p-5">
		<h2 class="text-2xl lg:text-3xl font-bold font-serif text-neutral-950">Branding</h2>
		<p class="mt-2 text-sm text-neutral-950">Update your core colors in real time.</p>
	</header>

	<section class="border-2 border-secondary-300 bg-neutral">
		<div
			class="flex flex-wrap items-start justify-between gap-3 border-b border-secondary-300 bg-neutral-600/66 p-4"
		>
			<div>
				<h3 class="text-xl font-bold font-serif text-neutral-950">Theme Colors</h3>
				<p class="mt-1 text-xs text-neutral-950">
					Set your primary, secondary, accent, and neutral colors.
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<HoverTooltip text="Save Theme">
					<button
						type="button"
						class="button-primary h-10 w-10 p-0 flex items-center justify-center"
						onclick={openSaveModal}
						aria-label="Save Theme"
					>
						<IconDeviceFloppy class="h-5 w-5" />
					</button>
				</HoverTooltip>
				<HoverTooltip text="Reset to Default">
					<button
						type="button"
						class="button-primary-outlined h-10 w-10 p-0 flex items-center justify-center"
						onclick={handleReset}
						aria-label="Reset to Default"
					>
						<IconRestore class="h-5 w-5" />
					</button>
				</HoverTooltip>
			</div>
		</div>

		<div class="p-4 lg:p-5">
			<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
				{#each [
					{
						key: 'primary',
						label: 'Primary',
						description: 'Your main brand color for key elements and primary calls to action.',
						placeholder: 'CE1126',
						warnings: primaryWarnings,
						input: primaryInput
					},
					{
						key: 'secondary',
						label: 'Secondary',
						description: 'Supporting color for backgrounds and secondary elements.',
						placeholder: '14213D',
						warnings: secondaryWarnings,
						input: secondaryInput
					},
					{
						key: 'accent',
						label: 'Accent',
						description: 'Accent color for highlights and important actions.',
						placeholder: '04669A',
						warnings: accentWarnings,
						input: accentInput
					},
					{
						key: 'neutral',
						description: 'Neutral color for backgrounds and borders. Leave empty for default.',
						label: 'Neutral',
						placeholder: 'Leave empty',
						warnings: neutralWarnings,
						input: neutralInput
					}
				] as color}
					<div class="border border-secondary-300 bg-white p-3 h-full flex flex-col">
						<label for={`branding-${color.key}`} class="block text-sm font-bold text-neutral-950 mb-1">
							{color.label}
						</label>
						<p class="text-xs text-neutral-950 mb-2">{color.description}</p>
						<div class="mt-auto pt-2 flex gap-2">
							<input
								id={`branding-${color.key}`}
								type="text"
								value={color.input}
								oninput={(event) => {
									const next = (event.target as HTMLInputElement).value;
									if (color.key === 'primary') {
										primaryInput = next;
										handlePrimaryChange();
									}
									if (color.key === 'secondary') {
										secondaryInput = next;
										handleSecondaryChange();
									}
									if (color.key === 'neutral') {
										neutralInput = next;
										handleNeutralChange();
									}
									if (color.key === 'accent') {
										accentInput = next;
										handleAccentChange();
									}
								}}
								placeholder={color.placeholder}
								class="input-secondary h-10 flex-1"
							/>
							<button
								type="button"
								onclick={() => {
									if (color.key === 'neutral') {
										openNeutralPaletteModal();
										return;
									}
									openColorPicker(color.key as 'primary' | 'secondary' | 'neutral' | 'accent');
								}}
								class="w-16 h-10 border-2 border-secondary-300 hover:border-secondary-500 transition-colors cursor-pointer"
								style="background-color: {getCurrentColorHex(
									color.key as 'primary' | 'secondary' | 'neutral' | 'accent'
								)}"
								aria-label={color.key === 'neutral'
									? 'Open neutral shade picker'
									: `Open ${color.label} color picker`}
							></button>
						</div>
						{#if color.warnings.length > 0}
							<div class="mt-2 p-2 bg-yellow-50 border-2 border-yellow-300">
								<p class="text-xs font-bold text-yellow-900 mb-1">Validation Warnings:</p>
								<ul class="text-xs text-yellow-800 list-disc list-inside">
									{#each color.warnings as warning}
										<li>{warning}</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="border-2 border-secondary-300 bg-neutral">
		<div class="border-b border-secondary-300 bg-neutral-600/66 p-4">
			<h3 class="text-lg font-bold font-serif text-neutral-950">Saved Themes</h3>
			<p class="mt-1 text-xs text-neutral-950">
				Capacity: {Math.min($savedThemes.length, MAX_BRANDING_THEMES)} / {MAX_BRANDING_THEMES}
			</p>
		</div>

		<div class="p-4 lg:p-5">
			{#if $savedThemes.length === 0}
				<p class="text-sm text-neutral-950">No saved themes yet.</p>
			{:else}
				<div class="space-y-3">
					{#each $savedThemes as theme (theme.id)}
						<div
							class="border border-secondary-300 bg-white p-3 cursor-pointer hover:bg-neutral-05 hover:border-secondary-500 transition-colors"
							role="button"
							tabindex="0"
							onclick={() => handleLoadTheme(theme.id)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									handleLoadTheme(theme.id);
								}
							}}
							aria-label={`Load ${theme.name}`}
						>
							<div class="flex flex-wrap items-start justify-between gap-2">
								<div class="flex items-center gap-3 min-w-0">
									<div class="min-w-0">
										<h4 class="text-sm font-semibold text-neutral-950">{theme.name}</h4>
										<p class="text-xs text-neutral-950 mt-1">
											Saved {new Date(theme.createdAt).toLocaleDateString()}
										</p>
									</div>
									<div
										class="grid grid-cols-4 gap-2 shrink-0"
										aria-label={`Theme color preview for ${theme.name}`}
									>
										<span
											class="h-6 w-6 border border-secondary-400"
											style={`background-color: ${getSavedThemeColorHex(theme.colors, 'primary')}`}
											title="Primary color"
											aria-hidden="true"
										></span>
										<span
											class="h-6 w-6 border border-secondary-400"
											style={`background-color: ${getSavedThemeColorHex(theme.colors, 'secondary')}`}
											title="Secondary color"
											aria-hidden="true"
										></span>
										<span
											class="h-6 w-6 border border-secondary-400"
											style={`background-color: ${getSavedThemeColorHex(theme.colors, 'accent')}`}
											title="Accent color"
											aria-hidden="true"
										></span>
										<span
											class="h-6 w-6 border border-secondary-400"
											style={`background-color: ${getSavedThemeColorHex(theme.colors, 'neutral')}`}
											title="Neutral color"
											aria-hidden="true"
										></span>
									</div>
								</div>
								<div class="flex gap-2">
									<HoverTooltip text="Rename theme">
										<button
											type="button"
											class="button-secondary-outlined text-xs px-2 py-1"
											onclick={(event) => openRenameModal(theme.id, theme.name, event)}
										>
											Rename
										</button>
									</HoverTooltip>
									<HoverTooltip text="Delete theme">
										<button
											type="button"
											class="button-accent-outlined text-xs px-2 py-1"
											onclick={(event) => handleDeleteTheme(theme.id, event)}
										>
											Delete
										</button>
									</HoverTooltip>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</section>

	{#if showNeutralPalettePicker}
		<div
			class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
			onclick={closeNeutralPaletteModal}
			onkeydown={(event) => {
				if (event.key === 'Escape') {
					closeNeutralPaletteModal();
				}
			}}
			role="button"
			tabindex="0"
			aria-label="Close neutral shade picker"
		>
			<div
				class="bg-white border-4 border-primary-500 p-4 md:p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
				role="presentation"
			>
				<div class="flex justify-between items-center mb-3">
					<h3 class="text-xl font-bold text-primary-900">Neutral Shade Picker</h3>
					<button
						onclick={closeNeutralPaletteModal}
						class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
						aria-label="Close neutral shade picker"
					>
						&times;
					</button>
				</div>
				<p class="text-sm text-secondary-700 mb-4">
					Choose a muted neutral tone based on your primary/secondary colors, or pick a light gray/beige.
				</p>

				<div class="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
					{#each neutralPaletteOptions as hex}
						<button
							type="button"
							class="h-12 border-2 cursor-pointer transition-colors {neutralInput.toUpperCase() ===
							hex.toUpperCase()
								? 'border-primary-700'
								: 'border-secondary-300 hover:border-secondary-500'}"
							style="background-color: #{hex}"
							onclick={() => applyNeutralPreset(hex)}
							aria-label={`Select neutral shade #${hex}`}
							title={`#${hex}`}
						></button>
					{/each}
				</div>

				<div class="flex flex-col sm:flex-row gap-2">
					<button
						type="button"
						class="flex-1 button-primary-outlined"
						onclick={() => {
							neutralInput = '';
							handleNeutralChange();
							closeNeutralPaletteModal();
						}}
					>
						Use Default Neutral
					</button>
					<button type="button" class="flex-1 button-secondary-outlined" onclick={closeNeutralPaletteModal}
						>Cancel</button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if openPicker}
		<div
			class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
			onclick={closeColorPicker}
			onkeydown={(event) => {
				if (event.key === 'Escape') {
					closeColorPicker();
				}
			}}
			role="button"
			tabindex="0"
			aria-label="Close color picker"
		>
			<div
				class="bg-white border-4 border-primary-500 p-4 md:p-6 max-w-md lg:max-w-5xl w-full max-h-[90vh] overflow-y-auto"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
				role="presentation"
			>
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-xl font-bold text-primary-900 capitalize">{openPicker} Color Picker</h3>
					<button
						onclick={closeColorPicker}
						class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
						aria-label="Close color picker"
					>
						&times;
					</button>
				</div>

				<div class="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-4">
					<div class="mb-4 lg:mb-0 relative lg:col-span-3 lg:self-stretch">
						<canvas
							bind:this={colorAreaElement}
							class="w-full h-64 lg:h-full border-2 border-primary-300 cursor-crosshair select-none"
							width="400"
							height="256"
							onmousedown={handleColorAreaMouseDown}
							onclick={handleColorAreaClick}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									if (colorAreaElement) {
										const rect = colorAreaElement.getBoundingClientRect();
										updateColorFromPosition(
											rect.left + rect.width / 2,
											rect.top + rect.height / 2,
											colorAreaElement
										);
									}
								}
							}}
							role="button"
							tabindex="0"
							aria-label="Color picker area. Use arrow keys to adjust, Enter or Space to select center color."
						></canvas>
						<div
							class="absolute w-4 h-4 border-2 border-white pointer-events-none"
							style="left: {pickerPos.x}%; top: {pickerPos.y}%; transform: translate(-50%, -50%); box-shadow: 0 0 0 1px rgba(0,0,0,0.5);"
						></div>
					</div>

					<div class="lg:col-span-2">
						<div class="mb-4">
							<label for="hue-slider" class="block text-sm font-bold text-primary-900 mb-2">Hue</label>
							<div class="relative h-8 border-2 border-primary-300">
								<div
									class="absolute inset-0"
									style="background: linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))"
								></div>
								<input
									id="hue-slider"
									type="range"
									min="0"
									max="360"
									bind:value={pickerColor.h}
									oninput={handleHueChange}
									class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
								/>
								<div
									class="absolute top-0 w-1 h-full bg-white border border-primary-900 pointer-events-none"
									style="left: {(pickerColor.h / 360) * 100}%"
								></div>
							</div>
							<div class="text-xs text-secondary-600 mt-1">{pickerColor.h}&deg;</div>
						</div>

						<div class="mb-4">
							<label for="saturation-slider" class="block text-sm font-bold text-primary-900 mb-2"
								>Saturation</label
							>
							<div class="relative h-8 border-2 border-primary-300">
								<div
									class="absolute inset-0"
									style="background: linear-gradient(to right, #FFFFFF, #{hslToHex(
										pickerColor.h,
										pickerColor.s,
										pickerColor.l
									)})"
								></div>
								<input
									id="saturation-slider"
									type="range"
									min="0"
									max="100"
									bind:value={pickerColor.saturation}
									oninput={handleSaturationChange}
									class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
								/>
								<div
									class="absolute top-0 w-1 h-full bg-white border border-primary-900 pointer-events-none"
									style="left: {pickerColor.saturation}%"
								></div>
							</div>
							<div class="text-xs text-secondary-600 mt-1">{pickerColor.saturation}%</div>
						</div>

						<div class="mb-4 p-4 border-2 border-primary-200">
							<div class="grid grid-cols-2 gap-4 text-sm">
								<div>
									<div class="font-bold text-primary-900">HSL</div>
									<div class="text-secondary-700 font-mono">
										{pickerColor.h}&deg;, {pickerColor.s}%, {pickerColor.l}%
									</div>
								</div>
								<div>
									<div class="font-bold text-primary-900">Hex</div>
									<div class="text-secondary-700 font-mono">#{getPickerHex()}</div>
								</div>
							</div>
						</div>

						<div>
							<div class="text-sm font-bold text-primary-900 mb-2">Preview</div>
							<div
								class="w-full h-16 border-2 border-primary-300"
								style="background-color: #{getPickerHex()}"
							></div>
						</div>
					</div>
				</div>

				{#if activePickerWarnings.length > 0}
					<div class="mb-4 p-2 bg-yellow-50 border-2 border-yellow-300">
						<p class="text-xs font-bold text-yellow-900 mb-1">Validation Warnings:</p>
						<ul class="text-xs text-yellow-800 list-disc list-inside">
							{#each activePickerWarnings as warning}
								<li>{warning}</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="flex flex-col sm:flex-row gap-2">
					<button
						onclick={() => {
							const hex = getPickerHex();
							updateColor(openPicker!, hex);
							if (openPicker === 'primary') {
								primaryInput = hex;
								validatePrimaryColor();
							} else if (openPicker === 'secondary') {
								secondaryInput = hex;
								validateSecondaryColor();
							} else if (openPicker === 'neutral') {
								neutralInput = hex;
								validateNeutralColor();
							} else if (openPicker === 'accent') {
								accentInput = hex;
								validateAccentColor();
							}
							closeColorPicker();
						}}
						class="flex-1 button-primary"
					>
						Apply
					</button>
					<button onclick={closeColorPicker} class="flex-1 button-secondary-outlined">Cancel</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showSaveModal}
		<div
			class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
			onclick={closeThemeModals}
			onkeydown={(event) => {
				if (event.key === 'Escape') {
					closeThemeModals();
				}
			}}
			role="button"
			tabindex="0"
			aria-label="Close save theme modal"
		>
			<div
				class="bg-white border-4 border-primary-500 p-6 max-w-md w-full"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
				role="presentation"
			>
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-xl font-bold text-primary-900">Save Theme</h3>
					<button
						onclick={closeThemeModals}
						class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
						aria-label="Close save theme modal"
					>
						&times;
					</button>
				</div>
				<div class="mb-4">
					<label for="theme-name-input" class="block text-sm font-bold text-primary-900 mb-2"
						>Theme Name</label
					>
					<input
						id="theme-name-input"
						type="text"
						bind:value={themeNameInput}
						placeholder="Enter theme name..."
						class="w-full"
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								handleSaveTheme();
							}
						}}
						use:autofocus
					/>
				</div>
				<div class="flex gap-2">
					<button onclick={handleSaveTheme} class="flex-1 button-primary">Save</button>
					<button onclick={closeThemeModals} class="flex-1 button-secondary-outlined">Cancel</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showOverwriteModal}
		<div
			class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
			onclick={() => {
				showOverwriteModal = false;
				showSaveModal = true;
			}}
			onkeydown={(event) => {
				if (event.key === 'Escape') {
					showOverwriteModal = false;
					showSaveModal = true;
				}
			}}
			role="button"
			tabindex="0"
			aria-label="Close overwrite theme modal"
		>
			<div
				class="bg-white border-4 border-primary-500 p-6 max-w-md w-full"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
				role="presentation"
			>
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-xl font-bold text-primary-900">Overwrite Theme?</h3>
					<button
						onclick={() => {
							showOverwriteModal = false;
							showSaveModal = true;
						}}
						class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
						aria-label="Close overwrite theme modal"
					>
						&times;
					</button>
				</div>
				<p class="text-secondary-700 mb-4">
					A theme with the name "<strong>{themeNameInput}</strong>" already exists. Do you want to
					overwrite it?
				</p>
				<div class="flex gap-2">
					<button onclick={handleOverwriteTheme} class="flex-1 button-primary">Overwrite</button>
					<button
						onclick={() => {
							showOverwriteModal = false;
							showSaveModal = true;
						}}
						class="flex-1 button-secondary-outlined"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showReplaceModal}
		<div
			class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
			onclick={() => {
				showReplaceModal = false;
				showSaveModal = true;
			}}
			onkeydown={(event) => {
				if (event.key === 'Escape') {
					showReplaceModal = false;
					showSaveModal = true;
				}
			}}
			role="button"
			tabindex="0"
			aria-label="Close replace theme modal"
		>
			<div
				class="bg-white border-4 border-primary-500 p-6 max-w-md w-full"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
				role="presentation"
			>
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-xl font-bold text-primary-900">Replace Theme</h3>
					<button
						onclick={() => {
							showReplaceModal = false;
							showSaveModal = true;
						}}
						class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
						aria-label="Close replace theme modal"
					>
						&times;
					</button>
				</div>
				<p class="text-secondary-700 mb-4">
					You can save up to {MAX_BRANDING_THEMES} themes. Choose one to replace.
				</p>
				<div class="space-y-2 mb-4 max-h-64 overflow-y-auto">
					{#each $savedThemes as theme, index}
						<button
							onclick={() => handleReplaceTheme(index)}
							class="w-full text-left border-2 border-primary-300 p-3 hover:border-primary-500 hover:bg-primary-50 transition-colors cursor-pointer"
						>
							<div class="flex items-center gap-3">
								<div class="grid grid-cols-4 gap-1 shrink-0">
									<div
										class="w-8 h-8 border border-primary-300"
										style="background-color: #{theme.colors.primary}"
									></div>
									<div
										class="w-8 h-8 border border-primary-300"
										style="background-color: #{theme.colors.secondary}"
									></div>
									<div
										class="w-8 h-8 border border-primary-300"
										style="background-color: #{theme.colors.accent}"
									></div>
									<div
										class="w-8 h-8 border border-primary-300"
										style="background-color: {theme.colors.neutral &&
										theme.colors.neutral.trim() !== ''
											? '#' + theme.colors.neutral
											: '#' + ZINC_PALETTE['500']}"
									></div>
								</div>
								<div class="flex-1">
									<div class="font-bold text-primary-900">{theme.name}</div>
									<div class="text-xs text-secondary-600">
										{new Date(theme.createdAt).toLocaleDateString()}
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
				<button
					onclick={() => {
						showReplaceModal = false;
						showSaveModal = true;
					}}
					class="w-full button-secondary-outlined"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	{#if showRenameModal}
		<div
			class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
			onclick={closeRenameModal}
			onkeydown={(event) => {
				if (event.key === 'Escape') {
					closeRenameModal();
				}
			}}
			role="button"
			tabindex="0"
			aria-label="Close rename theme modal"
		>
			<div
				class="bg-white border-4 border-primary-500 p-6 max-w-md w-full"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
				role="presentation"
			>
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-xl font-bold text-primary-900">Rename Theme</h3>
					<button
						onclick={closeRenameModal}
						class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
						aria-label="Close rename theme modal"
					>
						&times;
					</button>
				</div>
				<div class="mb-4">
					<label for="rename-theme-input" class="block text-sm font-bold text-primary-900 mb-2"
						>Theme Name</label
					>
					<input
						id="rename-theme-input"
						type="text"
						bind:value={renameThemeNameInput}
						class="w-full"
						onkeydown={(event) => event.key === 'Enter' && handleRenameTheme()}
						use:autofocus
					/>
				</div>
				<div class="flex gap-2">
					<button type="button" class="button-primary flex-1" onclick={handleRenameTheme}>Save</button>
					<button type="button" class="button-secondary-outlined flex-1" onclick={closeRenameModal}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
