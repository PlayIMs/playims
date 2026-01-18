<script lang="ts">
	import { onMount } from 'svelte';
	import {
		themeColors,
		updateColor,
		resetTheme,
		generatePalette,
		formatHex,
		savedThemes,
		saveCurrentTheme,
		loadTheme,
		deleteTheme,
		getSavedThemes,
		validateAccent,
		validateNeutral,
		getReadableTextColor,
		ZINC_PALETTE
	} from '$lib/theme';

	// Autofocus action for accessibility
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

	// Validation warnings
	let accentWarnings = $state<string[]>([]);
	let neutralWarnings = $state<string[]>([]);

	// Color picker state
	let openPicker: 'primary' | 'secondary' | 'neutral' | 'accent' | null = $state(null);
	let pickerColor = $state({ h: 0, s: 100, l: 50, a: 100 });

	// Helper to calculate cursor position (HSV) based on current state (HSL)
	// Returns {x: 0-100, y: 0-100}
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

	// Initialize and sync with store
	onMount(() => {
		const unsubscribe = themeColors.subscribe((colors) => {
			primaryInput = colors.primary;
			secondaryInput = colors.secondary;
			neutralInput = colors.neutral || '';
			accentInput = colors.accent;
			// Validate on load
			validateAccentColor();
			validateNeutralColor();
		});

		// Handle mouse move and up globally for color picker dragging
		function handleGlobalMouseMove(event: MouseEvent) {
			handleColorAreaMouseMove(event);
		}

		function handleGlobalMouseUp() {
			handleColorAreaMouseUp();
		}

		window.addEventListener('mousemove', handleGlobalMouseMove);
		window.addEventListener('mouseup', handleGlobalMouseUp);

		return () => {
			unsubscribe();
			window.removeEventListener('mousemove', handleGlobalMouseMove);
			window.removeEventListener('mouseup', handleGlobalMouseUp);
		};
	});

	function validateHex(hex: string): boolean {
		const cleanHex = hex.replace('#', '').toUpperCase();
		return /^[0-9A-F]{6}$/.test(cleanHex);
	}

	function handlePrimaryChange() {
		if (validateHex(primaryInput)) {
			updateColor('primary', primaryInput);
		}
	}

	function handleSecondaryChange() {
		if (validateHex(secondaryInput)) {
			updateColor('secondary', secondaryInput);
		}
	}

	function handleNeutralChange() {
		if (validateHex(neutralInput)) {
			updateColor('neutral', neutralInput);
			validateNeutralColor();
		} else if (neutralInput === '') {
			// Empty means use zinc default
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

	function validateAccentColor() {
		if (validateHex(accentInput)) {
			const result = validateAccent(accentInput, neutralInput);
			accentWarnings = result.warnings;
		} else {
			accentWarnings = [];
		}
	}

	function validateNeutralColor() {
		if (neutralInput && validateHex(neutralInput)) {
			const result = validateNeutral(neutralInput);
			neutralWarnings = result.warnings;
		} else {
			neutralWarnings = [];
		}
	}

	function handleReset() {
		resetTheme();
	}

	// Color picker functions
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
			.map((x) => {
				const hex = x.toString(16);
				return hex.length === 1 ? '0' + hex : hex;
			})
			.join('')
			.toUpperCase();
	}

	function openColorPicker(colorName: 'primary' | 'secondary' | 'neutral' | 'accent') {
		let currentHex = $themeColors[colorName];
		// For neutral, if empty, use zinc-500 as default
		if (colorName === 'neutral' && (!currentHex || currentHex.trim() === '')) {
			currentHex = ZINC_PALETTE['500'];
		}
		const hsl = hexToHsl(currentHex);
		pickerColor = { ...hsl, a: 100 };
		openPicker = colorName;
		// Draw canvas after a brief delay to ensure it's mounted
		setTimeout(() => {
			drawColorArea();
		}, 0);
	}

	function closeColorPicker() {
		openPicker = null;
	}

	function updatePickerColor() {
		if (!openPicker) return;
		const hex = hslToHex(pickerColor.h, pickerColor.s, pickerColor.l);
		updateColor(openPicker, hex);
		// Update input field
		if (openPicker === 'primary') {
			primaryInput = hex;
		} else if (openPicker === 'secondary') {
			secondaryInput = hex;
		} else if (openPicker === 'neutral') {
			neutralInput = hex;
			validateNeutralColor();
		} else if (openPicker === 'accent') {
			accentInput = hex;
			validateAccentColor();
		}
	}

	// Handle color area interaction
	let isDragging = $state(false);
	let colorAreaElement: HTMLCanvasElement | null = $state(null);

	// Draw color picker canvas
	function drawColorArea() {
		if (!colorAreaElement) return;
		const canvas = colorAreaElement;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const width = canvas.width;
		const height = canvas.height;

		// 1. Fill with the base Hue color
		ctx.fillStyle = `hsl(${pickerColor.h}, 100%, 50%)`;
		ctx.fillRect(0, 0, width, height);

		// 2. Gradient: White (Left) -> Transparent (Right)
		const gradWhite = ctx.createLinearGradient(0, 0, width, 0);
		gradWhite.addColorStop(0, 'rgba(255,255,255,1)');
		gradWhite.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = gradWhite;
		ctx.fillRect(0, 0, width, height);

		// 3. Gradient: Transparent (Top) -> Black (Bottom)
		const gradBlack = ctx.createLinearGradient(0, 0, 0, height);
		gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
		gradBlack.addColorStop(1, 'rgba(0,0,0,1)');
		ctx.fillStyle = gradBlack;
		ctx.fillRect(0, 0, width, height);
	}

	// Redraw canvas when hue changes
	$effect(() => {
		if (openPicker && colorAreaElement) {
			drawColorArea();
		}
	});

	// Re-validate accent color when neutral color changes
	$effect(() => {
		// Access neutralInput to track it
		neutralInput;
		if (validateHex(accentInput)) {
			validateAccentColor();
		}
	});

	function updateColorFromPosition(x: number, y: number, element: HTMLCanvasElement) {
		const rect = element.getBoundingClientRect();
		const relX = Math.max(0, Math.min(rect.width, x - rect.left));
		const relY = Math.max(0, Math.min(rect.height, y - rect.top));

		// Map cursor position (HSV) to HSL
		// x axis: Saturation (HSV)
		// y axis: Value (HSV)
		const s_hsv = relX / rect.width;
		const v = 1 - relY / rect.height;

		// HSV to HSL conversion
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

	// Handle hue slider
	function handleHueChange(event: Event) {
		const target = event.target as HTMLInputElement;
		pickerColor.h = parseInt(target.value);
		updatePickerColor();
	}

	// Handle opacity slider
	function handleOpacityChange(event: Event) {
		const target = event.target as HTMLInputElement;
		pickerColor.a = parseInt(target.value);
		// Note: Opacity is for preview only, hex doesn't store alpha
	}

	function getCurrentColorHex(colorName: 'primary' | 'secondary' | 'neutral' | 'accent'): string {
		const color = $themeColors[colorName];
		if (colorName === 'neutral' && (!color || color.trim() === '')) {
			// Return zinc-500 for default neutral
			return `#${ZINC_PALETTE['500']}`;
		}
		return formatHex(color);
	}

	// Computed position for the picker indicator
	// Using a derived state or function in the template
	let pickerPos = $derived(getPickerPosition());

	// Theme management state
	let showSaveModal = $state(false);
	let showReplaceModal = $state(false);
	let showOverwriteModal = $state(false);
	let themeNameInput = $state('');
	let replaceThemeIndex: number | null = $state(null);
	let existingThemeIndex: number | null = $state(null);

	// Initialize saved themes on mount
	onMount(() => {
		// Themes are already loaded by theme.init() in layout
		// Just ensure we're subscribed to updates
	});

	function handleSaveTheme() {
		const name = themeNameInput.trim();
		if (!name) {
			alert('Please enter a theme name');
			return;
		}

		// Check for duplicate name (case-insensitive)
		const existingIndex = $savedThemes.findIndex(
			(theme) => theme.name.toLowerCase() === name.toLowerCase()
		);

		if (existingIndex !== -1 && replaceThemeIndex !== existingIndex) {
			// Found duplicate, ask to overwrite
			existingThemeIndex = existingIndex;
			showSaveModal = false;
			showOverwriteModal = true;
			return;
		}

		const result = saveCurrentTheme(name, replaceThemeIndex ?? undefined);
		if (result === null) {
			// Need to show replace modal
			showSaveModal = false;
			showReplaceModal = true;
		} else {
			// Successfully saved
			showSaveModal = false;
			showReplaceModal = false;
			showOverwriteModal = false;
			themeNameInput = '';
			replaceThemeIndex = null;
			existingThemeIndex = null;
		}
	}

	function handleOverwriteTheme() {
		if (existingThemeIndex !== null) {
			replaceThemeIndex = existingThemeIndex;
			showOverwriteModal = false;
			handleSaveTheme();
		}
	}

	function handleReplaceTheme(index: number) {
		replaceThemeIndex = index;
		showReplaceModal = false;
		showSaveModal = true;
		handleSaveTheme();
	}

	function handleLoadTheme(themeId: string) {
		loadTheme(themeId);
		// Update inputs to match loaded theme
		const colors = $themeColors;
		primaryInput = colors.primary;
		secondaryInput = colors.secondary;
		neutralInput = colors.neutral || '';
		accentInput = colors.accent;
		validateAccentColor();
		validateNeutralColor();
	}

	function handleDeleteTheme(themeId: string, event: Event) {
		event.stopPropagation();
		if (confirm('Are you sure you want to delete this theme?')) {
			deleteTheme(themeId);
		}
	}

	function openSaveModal() {
		if ($savedThemes.length >= 5) {
			// Show replace modal first
			showReplaceModal = true;
		} else {
			// Show save modal
			showSaveModal = true;
		}
	}
</script>

<svelte:head>
	<title>Color Theme Editor - PlayIMs</title>
	<meta name="description" content="Customize your color theme with dynamic HEX color generation" />
</svelte:head>

<div class="min-h-screen bg-secondary-50 p-8">
	<div class="max-w-7xl mx-auto">
		<div class="mb-8">
			<h1 class="text-4xl font-bold text-primary-900 mb-2">Color Theme Editor</h1>
			<p class="text-secondary-700">
				Edit the base colors (500 shade) to generate a full palette. Colors are saved automatically
				to localStorage.
			</p>
		</div>

		<div class="bg-white border-2 border-primary-200 p-6 mb-8">
			<h2 class="text-2xl font-bold text-primary-900 mb-4">Base Colors (500 Shade)</h2>
			<p class="text-sm text-secondary mb-6">
				Enter hex color codes (e.g., "CE1126" or "#CE1126") or click the color preview to use the
				color picker.
			</p>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="relative">
					<label for="primary" class="block text-sm font-bold text-primary-900 mb-2">
						Primary
					</label>
					<p class="text-xs text-secondary mb-2">
						Used for: Main buttons, primary actions, brand elements, and dominant UI components
						(typically ~60% of your design). Choose a color that represents your brand identity.
					</p>
					<div class="flex gap-2">
						<input
							id="primary"
							type="text"
							bind:value={primaryInput}
							oninput={handlePrimaryChange}
							class="flex-1"
							placeholder="CE1126"
						/>
						<button
							type="button"
							onclick={() => openColorPicker('primary')}
							class="w-16 h-10 border-2 border-primary-300 hover:border-primary-500 transition-colors cursor-pointer"
							style="background-color: {getCurrentColorHex('primary')}"
							aria-label="Open primary color picker"
						></button>
					</div>
				</div>

				<div class="relative">
					<label for="secondary" class="block text-sm font-bold text-primary-900 mb-2">
						Secondary
					</label>
					<p class="text-xs text-secondary mb-2">
						Used for: Backgrounds, sidebars, headers, and supporting elements (typically ~30% of
						your design). Should complement the primary color and provide visual balance.
					</p>
					<div class="flex gap-2">
						<input
							id="secondary"
							type="text"
							bind:value={secondaryInput}
							oninput={handleSecondaryChange}
							class="flex-1"
							placeholder="F1D4C1"
						/>
						<button
							type="button"
							onclick={() => openColorPicker('secondary')}
							class="w-16 h-10 border-2 border-primary-300 hover:border-primary-500 transition-colors cursor-pointer"
							style="background-color: {getCurrentColorHex('secondary')}"
							aria-label="Open secondary color picker"
						></button>
					</div>
				</div>

				<div class="relative">
					<label for="neutral" class="block text-sm font-bold text-primary-900 mb-2">
						Neutral
					</label>
					<p class="text-xs text-secondary mb-2">
						Used for: Backgrounds, borders, and neutral UI elements. Leave empty to use default zinc
						palette, or define a custom neutral color (light shades of white, beige, or pastels).
					</p>
					<div class="flex gap-2">
						<input
							id="neutral"
							type="text"
							bind:value={neutralInput}
							oninput={handleNeutralChange}
							class="flex-1"
							placeholder="Leave empty for zinc default"
						/>
						<button
							type="button"
							onclick={() => openColorPicker('neutral')}
							class="w-16 h-10 border-2 border-primary-300 hover:border-primary-500 transition-colors cursor-pointer"
							style="background-color: {getCurrentColorHex('neutral')}"
							aria-label="Open neutral color picker"
						></button>
					</div>
					{#if neutralWarnings.length > 0}
						<div class="mt-2 p-2 bg-yellow-50 border-2 border-yellow-300">
							<p class="text-xs font-bold text-yellow-900 mb-1">Validation Warnings:</p>
							<ul class="text-xs text-yellow-800 list-disc list-inside">
								{#each neutralWarnings as warning}
									<li>{warning}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				<div class="relative">
					<label for="accent" class="block text-sm font-bold text-primary-900 mb-2"> Accent </label>
					<p class="text-xs text-secondary mb-2">
						Used for: Call-to-action buttons, important highlights, links, and attention-grabbing
						elements (typically ~10% of your design). Use sparingly for maximum impact. This color
						is used on top of static surface backgrounds.
					</p>
					<div class="flex gap-2">
						<input
							id="accent"
							type="text"
							bind:value={accentInput}
							oninput={handleAccentChange}
							class="flex-1"
							placeholder="006BA6"
						/>
						<button
							type="button"
							onclick={() => openColorPicker('accent')}
							class="w-16 h-10 border-2 border-primary-300 hover:border-primary-500 transition-colors cursor-pointer"
							style="background-color: {getCurrentColorHex('accent')}"
							aria-label="Open accent color picker"
						></button>
					</div>
					{#if accentWarnings.length > 0}
						<div class="mt-2 p-2 bg-yellow-50 border-2 border-yellow-300">
							<p class="text-xs font-bold text-yellow-900 mb-1">Validation Warnings:</p>
							<ul class="text-xs text-yellow-800 list-disc list-inside">
								{#each accentWarnings as warning}
									<li>{warning}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</div>

			<!-- Best Practices Section -->
			<div class="mt-6 p-4 bg-primary-50 border-2 border-primary-200">
				<h3 class="text-lg font-bold text-primary-900 mb-3">Design Best Practices</h3>
				<ul class="text-sm text-primary-800 space-y-2 list-disc list-inside">
					<li>
						<strong>Contrast:</strong> Ensure sufficient contrast between text and backgrounds (minimum
						4.5:1 for normal text, 3:1 for large text per WCAG guidelines).
					</li>
					<li>
						<strong>Color Blindness:</strong> Avoid relying solely on red/green or blue/yellow combinations
						to convey information. Use text labels, icons, or patterns as well.
					</li>
					<li>
						<strong>Accessibility:</strong> Test your color combinations to ensure they're distinguishable
						for users with color vision deficiencies.
					</li>
					<li>
						<strong>Consistency:</strong> Use colors uniformly across your interface to create a cohesive
						user experience.
					</li>
					<li>
						<strong>60-30-10 Rule:</strong> Aim for approximately 60% primary, 30% secondary, and 10%
						accent color usage for visual balance. Neutral colors are used for backgrounds and borders.
					</li>
				</ul>
			</div>

			<div class="mt-6 flex gap-4">
				<button onclick={openSaveModal} class="button-accent">Save Theme</button>
				<button onclick={handleReset} class="button-primary">Reset to Defaults</button>
			</div>
		</div>

		<!-- Saved Themes Section -->
		<div class="bg-white border-2 border-primary-200 p-6 mb-8">
			<h2 class="text-2xl font-bold text-primary-900 mb-4">Saved Themes</h2>
			{#if $savedThemes.length === 0}
				<p class="text-secondary">No saved themes yet. Save your current theme to get started!</p>
			{:else}
				<div class="overflow-x-auto -mx-6 px-6 md:overflow-x-scroll">
					<div class="flex gap-4">
						{#each $savedThemes as theme (theme.id)}
							<div
								class="border-2 border-primary-300 p-4 hover:border-primary-500 transition-colors cursor-pointer min-w-[280px] flex-shrink-0"
								onclick={() => handleLoadTheme(theme.id)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleLoadTheme(theme.id);
									}
								}}
								role="button"
								tabindex="0"
								aria-label="Load theme: {theme.name}"
							>
								<div class="flex justify-between items-start mb-3">
									<h3 class="text-lg font-bold text-primary-900">{theme.name}</h3>
									<button
										onclick={(e) => handleDeleteTheme(theme.id, e)}
										class="text-red-600 hover:text-red-800 text-xl font-bold cursor-pointer"
										title="Delete theme"
									>
										×
									</button>
								</div>
								<div class="grid grid-cols-4 gap-2 mb-2">
									<div
										class="h-12 border-2 border-primary-300"
										style="background-color: #{theme.colors.primary}"
										title="Primary: #{theme.colors.primary}"
									></div>
									<div
										class="h-12 border-2 border-primary-300"
										style="background-color: #{theme.colors.secondary}"
										title="Secondary: #{theme.colors.secondary}"
									></div>
									<div
										class="h-12 border-2 border-primary-300"
										style="background-color: {theme.colors.neutral &&
										theme.colors.neutral.trim() !== ''
											? '#' + theme.colors.neutral
											: '#' + ZINC_PALETTE['500']}"
										title="Neutral: {theme.colors.neutral && theme.colors.neutral.trim() !== ''
											? theme.colors.neutral
											: 'Zinc default'}"
									></div>
									<div
										class="h-12 border-2 border-primary-300"
										style="background-color: #{theme.colors.accent}"
										title="Accent: #{theme.colors.accent}"
									></div>
								</div>
								<p class="text-xs text-secondary-600">
									Saved {new Date(theme.createdAt).toLocaleDateString()}
								</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		{#if openPicker}
			<div
				class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
				onclick={closeColorPicker}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						closeColorPicker();
					}
				}}
				role="button"
				tabindex="0"
				aria-label="Close color picker"
			>
				<div
					class="bg-white border-4 border-primary p-6 max-w-md w-full"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="presentation"
				>
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-primary-900 capitalize">{openPicker} Color Picker</h3>
						<button
							onclick={closeColorPicker}
							class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
							aria-label="Close color picker"
						>
							×
						</button>
					</div>

					<div class="mb-4 relative">
						<canvas
							bind:this={colorAreaElement}
							class="w-full h-64 border-2 border-primary-300 cursor-crosshair select-none"
							width="400"
							height="256"
							onmousedown={handleColorAreaMouseDown}
							onclick={handleColorAreaClick}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									// Center click for keyboard users
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

					<div class="mb-4">
						<label for="hue-slider" class="block text-sm font-bold text-primary-900 mb-2">Hue</label
						>
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
						<div class="text-xs text-secondary-600 mt-1">{pickerColor.h}°</div>
					</div>

					<div class="mb-4">
						<label for="opacity-slider" class="block text-sm font-bold text-primary-900 mb-2"
							>Opacity (Preview Only)</label
						>
						<div class="relative h-8 border-2 border-primary-300">
							<div
								class="absolute inset-0"
								style="background: linear-gradient(to right, transparent, hsl({pickerColor.h}, {pickerColor.s}%, {pickerColor.l}%))"
							></div>
							<input
								id="opacity-slider"
								type="range"
								min="0"
								max="100"
								bind:value={pickerColor.a}
								oninput={handleOpacityChange}
								class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
							/>
							<div
								class="absolute top-0 w-1 h-full bg-white border border-primary-900 pointer-events-none"
								style="left: {pickerColor.a}%"
							></div>
						</div>
						<div class="text-xs text-secondary-600 mt-1">{pickerColor.a}%</div>
					</div>

					<div class="mb-4 p-4 border-2 border-primary-200">
						<div class="grid grid-cols-2 gap-4 text-sm">
							<div>
								<div class="font-bold text-primary-900">HSL</div>
								<div class="text-secondary-700 font-mono">
									{pickerColor.h}°, {pickerColor.s}%, {pickerColor.l}%
								</div>
							</div>
							<div>
								<div class="font-bold text-primary-900">Hex</div>
								<div class="text-secondary-700 font-mono">
									#{hslToHex(pickerColor.h, pickerColor.s, pickerColor.l)}
								</div>
							</div>
						</div>
					</div>

					<div class="mb-4">
						<div class="text-sm font-bold text-primary-900 mb-2">Preview</div>
						<div
							class="w-full h-16 border-2 border-primary-300"
							style="background-color: hsla({pickerColor.h}, {pickerColor.s}%, {pickerColor.l}%, {pickerColor.a /
								100})"
						></div>
					</div>

					<div class="flex gap-2">
						<button
							onclick={() => {
								const hex = hslToHex(pickerColor.h, pickerColor.s, pickerColor.l);
								updateColor(openPicker!, hex);
								// Update input field
								if (openPicker === 'primary') {
									primaryInput = hex;
								} else if (openPicker === 'secondary') {
									secondaryInput = hex;
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
						<button onclick={closeColorPicker} class="flex-1 button-secondary-outlined"
							>Cancel</button
						>
					</div>
				</div>
			</div>
		{/if}

		<!-- Save Theme Modal -->
		{#if showSaveModal}
			<div
				class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
				onclick={() => {
					showSaveModal = false;
					themeNameInput = '';
				}}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						showSaveModal = false;
						themeNameInput = '';
					}
				}}
				role="button"
				tabindex="0"
				aria-label="Close save theme modal"
			>
				<div
					class="bg-white border-4 border-primary p-6 max-w-md w-full"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="presentation"
				>
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-primary-900">Save Theme</h3>
						<button
							onclick={() => {
								showSaveModal = false;
								themeNameInput = '';
							}}
							class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
							aria-label="Close save theme modal"
						>
							×
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
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									handleSaveTheme();
								}
							}}
							use:autofocus
						/>
					</div>
					<div class="flex gap-2">
						<button onclick={handleSaveTheme} class="flex-1 button-primary">Save</button>
						<button
							onclick={() => {
								showSaveModal = false;
								themeNameInput = '';
							}}
							class="flex-1 button-secondary-outlined"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Overwrite Theme Modal -->
		{#if showOverwriteModal}
			<div
				class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
				onclick={() => {
					showOverwriteModal = false;
					existingThemeIndex = null;
				}}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						showOverwriteModal = false;
						existingThemeIndex = null;
					}
				}}
				role="button"
				tabindex="0"
				aria-label="Close overwrite theme modal"
			>
				<div
					class="bg-white border-4 border-primary p-6 max-w-md w-full"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="presentation"
				>
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-primary-900">Overwrite Theme?</h3>
						<button
							onclick={() => {
								showOverwriteModal = false;
								existingThemeIndex = null;
							}}
							class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
							aria-label="Close overwrite theme modal"
						>
							×
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
								existingThemeIndex = null;
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

		<!-- Replace Theme Modal -->
		{#if showReplaceModal}
			<div
				class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
				onclick={() => {
					showReplaceModal = false;
				}}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						showReplaceModal = false;
					}
				}}
				role="button"
				tabindex="0"
				aria-label="Close replace theme modal"
			>
				<div
					class="bg-white border-4 border-primary p-6 max-w-md w-full"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="presentation"
				>
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-primary-900">Replace Theme</h3>
						<button
							onclick={() => {
								showReplaceModal = false;
							}}
							class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
							aria-label="Close replace theme modal"
						>
							×
						</button>
					</div>
					<p class="text-secondary-700 mb-4">
						You have reached the maximum of 5 saved themes. Which theme would you like to replace?
					</p>
					<div class="space-y-2 mb-4 max-h-64 overflow-y-auto">
						{#each $savedThemes as theme, index}
							<button
								onclick={() => handleReplaceTheme(index)}
								class="w-full text-left border-2 border-primary-300 p-3 hover:border-primary-500 hover:bg-primary-50 transition-colors cursor-pointer"
							>
								<div class="flex items-center gap-3">
									<div class="grid grid-cols-4 gap-1 flex-shrink-0">
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
											style="background-color: {theme.colors.neutral &&
											theme.colors.neutral.trim() !== ''
												? '#' + theme.colors.neutral
												: '#' + ZINC_PALETTE['500']}"
										></div>
										<div
											class="w-8 h-8 border border-primary-300"
											style="background-color: #{theme.colors.accent}"
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
						}}
						class="w-full button-secondary-outlined"
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
			<div class="bg-white border-2 border-primary-200 p-4">
				<h3 class="text-xl font-bold text-primary-900 mb-4">Primary Palette</h3>
				<div class="space-y-2">
					{#each [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade}
						{@const palette = generatePalette($themeColors.primary)}
						{@const hexValue = palette[shade]}
						{@const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`}
						<div class="flex items-center gap-3">
							<div
								class="w-16 h-12 border-2 border-primary-300 flex-shrink-0"
								style="background-color: {hexWithHash}"
							></div>
							<div class="flex-1">
								<div class="text-xs font-mono text-secondary-700">primary-{shade}</div>
								<div class="text-xs text-secondary-600 font-mono">{hexWithHash}</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="bg-white border-2 border-primary-200 p-4">
				<h3 class="text-xl font-bold text-primary-900 mb-4">Secondary Palette</h3>
				<div class="space-y-2">
					{#each [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade}
						{@const palette = generatePalette($themeColors.secondary)}
						{@const hexValue = palette[shade]}
						{@const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`}
						<div class="flex items-center gap-3">
							<div
								class="w-16 h-12 border-2 border-primary-300 flex-shrink-0"
								style="background-color: {hexWithHash}"
							></div>
							<div class="flex-1">
								<div class="text-xs font-mono text-secondary-700">secondary-{shade}</div>
								<div class="text-xs text-secondary-600 font-mono">{hexWithHash}</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="bg-white border-2 border-primary-200 p-4">
				<h3 class="text-xl font-bold text-primary-900 mb-4">Accent Palette</h3>
				<div class="space-y-2">
					{#each [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade}
						{@const palette = generatePalette($themeColors.accent)}
						{@const hexValue = palette[shade]}
						{@const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`}
						<div class="flex items-center gap-3">
							<div
								class="w-16 h-12 border-2 border-primary-300 flex-shrink-0"
								style="background-color: {hexWithHash}"
							></div>
							<div class="flex-1">
								<div class="text-xs font-mono text-secondary-700">accent-{shade}</div>
								<div class="text-xs text-secondary-600 font-mono">{hexWithHash}</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="bg-white border-2 border-primary-200 p-4">
				<h3 class="text-xl font-bold text-primary-900 mb-4">Neutral Palette</h3>
				{#if $themeColors.neutral && $themeColors.neutral.trim() !== ''}
					<div class="space-y-2">
						{#each [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade}
							{@const palette = generatePalette($themeColors.neutral)}
							{@const hexValue = palette[shade]}
							{@const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`}
							<div class="flex items-center gap-3">
								<div
									class="w-16 h-12 border-2 border-primary-300 flex-shrink-0"
									style="background-color: {hexWithHash}"
								></div>
								<div class="flex-1">
									<div class="text-xs font-mono text-secondary-700">neutral-{shade}</div>
									<div class="text-xs text-secondary-600 font-mono">{hexWithHash}</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-xs text-secondary-600 mb-2">Default zinc palette</p>
					<div class="space-y-2">
						{#each [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade}
							{@const hexValue = ZINC_PALETTE[shade]}
							{@const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`}
							<div class="flex items-center gap-3">
								<div
									class="w-16 h-12 border-2 border-primary-300 flex-shrink-0"
									style="background-color: {hexWithHash}"
								></div>
								<div class="flex-1">
									<div class="text-xs font-mono text-secondary-700">neutral-{shade}</div>
									<div class="text-xs text-secondary-600 font-mono">{hexWithHash}</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-8 bg-white border-2 border-primary-200 p-6">
			<h2 class="text-2xl font-bold text-primary-900 mb-4">Usage Examples</h2>
			<p class="text-secondary-700 mb-4">
				Use the generated colors in your Tailwind classes. The theme is automatically applied to the
				entire application. Here are comprehensive examples of common UI components.
			</p>

			<!-- Buttons Section -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Buttons</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<!-- Row 1: Primary, Secondary, Accent -->
					<button class="button-primary">Primary Button</button>
					<button class="button-secondary">Secondary Button</button>
					<button class="button-accent">Accent Button</button>
					<!-- Row 2: Outlined versions -->
					<button class="button-primary-outlined">Outlined Primary</button>
					<button class="button-secondary-outlined">Outlined Secondary</button>
					<button class="button-accent-outlined">Outlined Accent</button>
					<!-- Row 3: Disabled versions of Row 1 -->
					<button class="button-primary" disabled>Disabled Primary</button>
					<button class="button-secondary" disabled>Disabled Secondary</button>
					<button class="button-accent" disabled>Disabled Accent</button>
					<!-- Row 4: Disabled versions of Row 2 -->
					<button class="button-primary-outlined" disabled>Disabled Outlined Primary</button>
					<button class="button-secondary-outlined" disabled>Disabled Outlined Secondary</button>
					<button class="button-accent-outlined" disabled>Disabled Outlined Accent</button>
				</div>
			</div>

			<!-- Form Elements Section -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Form Elements</h3>
				<div class="space-y-6">
					<!-- Text Input -->
					<div>
						<div class="block text-sm font-bold text-primary-950 mb-2">Text Input</div>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<input
									id="example-text-input-primary"
									type="text"
									class="input-primary"
									placeholder="Primary input..."
									aria-label="Primary text input example"
								/>
							</div>
							<div>
								<input
									id="example-text-input-secondary"
									type="text"
									class="input-secondary"
									placeholder="Secondary input..."
									aria-label="Secondary text input example"
								/>
							</div>
							<div>
								<input
									id="example-text-input-accent"
									type="text"
									class="input-accent"
									placeholder="Accent input..."
									aria-label="Accent text input example"
								/>
							</div>
						</div>
					</div>
					<!-- Email Input -->
					<div>
						<div class="block text-sm font-bold text-primary-950 mb-2">Email Input</div>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<input
									id="example-email-input-primary"
									type="email"
									class="input-primary"
									placeholder="primary@example.com"
									aria-label="Primary email input example"
								/>
							</div>
							<div>
								<input
									id="example-email-input-secondary"
									type="email"
									class="input-secondary"
									placeholder="secondary@example.com"
									aria-label="Secondary email input example"
								/>
							</div>
							<div>
								<input
									id="example-email-input-accent"
									type="email"
									class="input-accent"
									placeholder="accent@example.com"
									aria-label="Accent email input example"
								/>
							</div>
						</div>
					</div>
					<!-- Textarea -->
					<div>
						<div class="block text-sm font-bold text-primary-950 mb-2">Textarea</div>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<textarea
									id="example-textarea-primary"
									class="textarea-primary"
									placeholder="Primary textarea..."
									rows="3"
									aria-label="Primary textarea example"
								></textarea>
							</div>
							<div>
								<textarea
									id="example-textarea-secondary"
									class="textarea-secondary"
									placeholder="Secondary textarea..."
									rows="3"
									aria-label="Secondary textarea example"
								></textarea>
							</div>
							<div>
								<textarea
									id="example-textarea-accent"
									class="textarea-accent"
									placeholder="Accent textarea..."
									rows="3"
									aria-label="Accent textarea example"
								></textarea>
							</div>
						</div>
					</div>
					<!-- Select Dropdown -->
					<div>
						<div class="block text-sm font-bold text-primary-950 mb-2">Select Dropdown</div>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<select
									id="example-select-primary"
									class="select-primary"
									aria-label="Primary select dropdown example"
								>
									<option>Primary Option 1</option>
									<option>Primary Option 2</option>
									<option>Primary Option 3</option>
								</select>
							</div>
							<div>
								<select
									id="example-select-secondary"
									class="select-secondary"
									aria-label="Secondary select dropdown example"
								>
									<option>Secondary Option 1</option>
									<option>Secondary Option 2</option>
									<option>Secondary Option 3</option>
								</select>
							</div>
							<div>
								<select
									id="example-select-accent"
									class="select-accent"
									aria-label="Accent select dropdown example"
								>
									<option>Accent Option 1</option>
									<option>Accent Option 2</option>
									<option>Accent Option 3</option>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Checkboxes and Radio Buttons -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Checkboxes & Radio Buttons</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div>
						<div class="space-y-3">
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" class="checkbox-primary" />
								<span class="font-bold text-primary-950">Primary Checkbox</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" checked class="checkbox-primary" />
								<span class="font-bold text-primary-950">Primary Checkbox (Checked)</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" disabled class="checkbox-primary" />
								<span class="font-bold text-primary-950 opacity-50"
									>Primary Checkbox (Disabled)</span
								>
							</label>
						</div>
					</div>
					<div>
						<div class="space-y-3">
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" class="checkbox-secondary" />
								<span class="font-bold text-primary-950">Secondary Checkbox</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" checked class="checkbox-secondary" />
								<span class="font-bold text-primary-950">Secondary Checkbox (Checked)</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" disabled class="checkbox-secondary" />
								<span class="font-bold text-primary-950 opacity-50"
									>Secondary Checkbox (Disabled)</span
								>
							</label>
						</div>
					</div>
					<div>
						<div class="space-y-3">
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" class="checkbox-accent" />
								<span class="font-bold text-primary-950">Accent Checkbox</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" checked class="checkbox-accent" />
								<span class="font-bold text-primary-950">Accent Checkbox (Checked)</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" disabled class="checkbox-accent" />
								<span class="font-bold text-primary-950 opacity-50">Accent Checkbox (Disabled)</span
								>
							</label>
						</div>
					</div>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
					<div>
						<div class="space-y-3">
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group-primary" class="radio-primary" />
								<span class="font-bold text-primary-950">Primary Radio</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group-primary" checked class="radio-primary" />
								<span class="font-bold text-primary-950">Primary Radio (Selected)</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group-primary" disabled class="radio-primary" />
								<span class="font-bold text-primary-950 opacity-50">Primary Radio (Disabled)</span>
							</label>
						</div>
					</div>
					<div>
						<div class="space-y-3">
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group-secondary" class="radio-secondary" />
								<span class="font-bold text-primary-950">Secondary Radio</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group-secondary" checked class="radio-secondary" />
								<span class="font-bold text-primary-950">Secondary Radio (Selected)</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group-secondary" disabled class="radio-secondary" />
								<span class="font-bold text-primary-950 opacity-50">Secondary Radio (Disabled)</span
								>
							</label>
						</div>
					</div>
					<div>
						<div class="space-y-3">
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group-accent" class="radio-accent" />
								<span class="font-bold text-primary-950">Accent Radio</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group-accent" checked class="radio-accent" />
								<span class="font-bold text-primary-950">Accent Radio (Selected)</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group-accent" disabled class="radio-accent" />
								<span class="font-bold text-primary-950 opacity-50">Accent Radio (Disabled)</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<!-- Toggle Switch -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Toggle Switches</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" class="toggle-primary" />
						<span class="font-bold text-primary-950">Primary Toggle Off</span>
					</label>
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" checked class="toggle-primary" />
						<span class="font-bold text-primary-950">Primary Toggle On</span>
					</label>
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" disabled class="toggle-primary" />
						<span class="font-bold text-primary-950 opacity-50">Primary Toggle Disabled</span>
					</label>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" class="toggle-secondary" />
						<span class="font-bold text-primary-950">Secondary Toggle Off</span>
					</label>
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" checked class="toggle-secondary" />
						<span class="font-bold text-primary-950">Secondary Toggle On</span>
					</label>
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" disabled class="toggle-secondary" />
						<span class="font-bold text-primary-950 opacity-50">Secondary Toggle Disabled</span>
					</label>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" class="toggle-accent" />
						<span class="font-bold text-primary-950">Accent Toggle Off</span>
					</label>
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" checked class="toggle-accent" />
						<span class="font-bold text-primary-950">Accent Toggle On</span>
					</label>
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" disabled class="toggle-accent" />
						<span class="font-bold text-primary-950 opacity-50">Accent Toggle Disabled</span>
					</label>
				</div>
			</div>

			<!-- Cards Section -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Cards</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<!-- Primary, Secondary, Accent Cards -->
					<div class="card-primary">
						<h4 class="text-lg font-bold text-primary-950 mb-2">Primary Card</h4>
						<p class="text-primary-900 mb-3">Card with primary background and border.</p>
						<button class="button-primary">Action</button>
					</div>
					<div class="card-secondary">
						<h4 class="text-lg font-bold text-secondary-950 mb-2">Secondary Card</h4>
						<p class="text-secondary-900 mb-3">Card with secondary background and border.</p>
						<button class="button-secondary">Action</button>
					</div>
					<div class="card-accent">
						<h4 class="text-lg font-bold text-accent-950 mb-2">Accent Card</h4>
						<p class="text-accent-900 mb-3">Card with accent background and border.</p>
						<button class="button-accent">Action</button>
					</div>
					<!-- Outlined versions -->
					<div class="card-primary-outlined">
						<h4 class="text-lg font-bold text-primary-950 mb-2">Outlined Primary</h4>
						<p class="text-primary-900 mb-3">Card with primary border only.</p>
						<button class="button-primary">Action</button>
					</div>
					<div class="card-secondary-outlined">
						<h4 class="text-lg font-bold text-secondary-950 mb-2">Outlined Secondary</h4>
						<p class="text-secondary-900 mb-3">Card with secondary border only.</p>
						<button class="button-secondary">Action</button>
					</div>
					<div class="card-accent-outlined">
						<h4 class="text-lg font-bold text-accent-950 mb-2">Outlined Accent</h4>
						<p class="text-accent-900 mb-3">Card with accent border only.</p>
						<button class="button-accent">Action</button>
					</div>
				</div>
			</div>

			<!-- Badges -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Badges</h3>
				<div class="flex flex-wrap gap-3">
					<!-- Row 1: Primary, Secondary, Accent -->
					<span class="badge-primary w-fit">Primary Badge</span>
					<span class="badge-secondary w-fit">Secondary Badge</span>
					<span class="badge-accent w-fit">Accent Badge</span>
					<!-- Row 2: Outlined versions -->
					<span class="badge-primary-outlined w-fit">Outlined Primary</span>
					<span class="badge-secondary-outlined w-fit">Outlined Secondary</span>
					<span class="badge-accent-outlined w-fit">Outlined Accent</span>
				</div>
				<div class="flex flex-wrap gap-3 mt-3">
					<!-- Row 3: Disabled versions of Row 1 -->
					<span class="badge-primary opacity-50 w-fit">Disabled Primary</span>
					<span class="badge-secondary opacity-50 w-fit">Disabled Secondary</span>
					<span class="badge-accent opacity-50 w-fit">Disabled Accent</span>
					<!-- Row 4: Disabled versions of Row 2 -->
					<span class="badge-primary-outlined opacity-50 w-fit">Disabled Outlined Primary</span>
					<span class="badge-secondary-outlined opacity-50 w-fit">Disabled Outlined Secondary</span>
					<span class="badge-accent-outlined opacity-50 w-fit">Disabled Outlined Accent</span>
				</div>
			</div>

			<!-- Progress Bars -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Progress Bars</h3>
				<div class="space-y-4">
					<div>
						<div class="flex justify-between mb-1">
							<span class="text-sm font-bold text-primary-950">Primary Progress</span>
							<span class="text-sm font-bold text-primary-950">75%</span>
						</div>
						<div class="w-full progress-primary">
							<div class="progress-primary-bar" style="width: 75%"></div>
						</div>
					</div>
					<div>
						<div class="flex justify-between mb-1">
							<span class="text-sm font-bold text-secondary-950">Secondary Progress</span>
							<span class="text-sm font-bold text-secondary-950">60%</span>
						</div>
						<div class="w-full progress-secondary">
							<div class="progress-secondary-bar" style="width: 60%"></div>
						</div>
					</div>
					<div>
						<div class="flex justify-between mb-1">
							<span class="text-sm font-bold text-accent-950">Accent Progress</span>
							<span class="text-sm font-bold text-accent-950">50%</span>
						</div>
						<div class="w-full progress-accent">
							<div class="progress-accent-bar" style="width: 50%"></div>
						</div>
					</div>
				</div>
			</div>

			<!-- Toasts -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Toasts</h3>
				<div class="space-y-3">
					<!-- Primary, Secondary, Accent Toasts -->
					<div class="toast-primary">
						<div class="font-bold text-primary-950">Primary Toast</div>
						<div class="text-primary-900 text-sm mt-1">
							This is a primary toast notification message.
						</div>
					</div>
					<div class="toast-secondary">
						<div class="font-bold text-secondary-950">Secondary Toast</div>
						<div class="text-secondary-900 text-sm mt-1">
							This is a secondary toast notification message.
						</div>
					</div>
					<div class="toast-accent">
						<div class="font-bold text-accent-950">Accent Toast</div>
						<div class="text-accent-900 text-sm mt-1">
							This is an accent toast notification message.
						</div>
					</div>
					<!-- Outlined versions -->
					<div class="toast-primary-outlined">
						<div class="font-bold text-primary-950">Outlined Primary Toast</div>
						<div class="text-primary-900 text-sm mt-1">
							This is an outlined primary toast notification message.
						</div>
					</div>
					<div class="toast-secondary-outlined">
						<div class="font-bold text-secondary-950">Outlined Secondary Toast</div>
						<div class="text-secondary-900 text-sm mt-1">
							This is an outlined secondary toast notification message.
						</div>
					</div>
					<div class="toast-accent-outlined">
						<div class="font-bold text-accent-950">Outlined Accent Toast</div>
						<div class="text-accent-900 text-sm mt-1">
							This is an outlined accent toast notification message.
						</div>
					</div>
				</div>
			</div>

			<!-- Tables -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Tables</h3>
				<div class="border-2 border-primary-300 overflow-x-auto">
					<table class="w-full">
						<thead class="bg-primary">
							<tr>
								<th class="px-4 py-3 text-left font-bold text-white">Name</th>
								<th class="px-4 py-3 text-left font-bold text-white">Status</th>
								<th class="px-4 py-3 text-left font-bold text-white">Action</th>
							</tr>
						</thead>
						<tbody>
							<tr class="border-b-2 border-primary-200 bg-white">
								<td class="px-4 py-3 font-bold text-primary-950">Item 1</td>
								<td class="px-4 py-3">
									<span class="badge-accent">Active</span>
								</td>
								<td class="px-4 py-3">
									<button class="button-primary text-sm px-3 py-1">Edit</button>
								</td>
							</tr>
							<tr class="border-b-2 border-primary-200 bg-secondary-50">
								<td class="px-4 py-3 font-bold text-primary-950">Item 2</td>
								<td class="px-4 py-3">
									<span class="badge-secondary">Pending</span>
								</td>
								<td class="px-4 py-3">
									<button class="button-primary text-sm px-3 py-1">Edit</button>
								</td>
							</tr>
							<tr class="bg-white">
								<td class="px-4 py-3 font-bold text-primary-950">Item 3</td>
								<td class="px-4 py-3">
									<span class="badge-primary">Complete</span>
								</td>
								<td class="px-4 py-3">
									<button class="button-primary text-sm px-3 py-1">Edit</button>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Color Swatches -->
			<div>
				<h3 class="text-xl font-bold text-primary-950 mb-3">Color Swatches</h3>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div>
						<div class="bg-primary h-16 border-2 border-primary-300 mb-2"></div>
						<div class="text-xs font-bold text-primary-950">primary-500</div>
					</div>
					<div>
						<div class="bg-secondary h-16 border-2 border-primary-300 mb-2"></div>
						<div class="text-xs font-bold text-primary-950">secondary-500</div>
					</div>
					<div>
						<div class="bg-accent h-16 border-2 border-primary-300 mb-2"></div>
						<div class="text-xs font-bold text-primary-950">accent-500</div>
					</div>
					<div>
						<div class="bg-neutral h-16 border-2 border-primary-300 mb-2"></div>
						<div class="text-xs font-bold text-primary-950">neutral-500</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
