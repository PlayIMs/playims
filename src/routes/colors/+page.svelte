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
		getSavedThemes
	} from '$lib/theme';

	let primaryInput = $state('');
	let secondaryInput = $state('');
	let tertiaryInput = $state('');
	let accentInput = $state('');

	// Color picker state
	let openPicker: 'primary' | 'secondary' | 'tertiary' | 'accent' | null = $state(null);
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
			tertiaryInput = colors.tertiary;
			accentInput = colors.accent;
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

	function handleTertiaryChange() {
		if (validateHex(tertiaryInput)) {
			updateColor('tertiary', tertiaryInput);
		}
	}

	function handleAccentChange() {
		if (validateHex(accentInput)) {
			updateColor('accent', accentInput);
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

	function openColorPicker(colorName: 'primary' | 'secondary' | 'tertiary' | 'accent') {
		const currentHex = $themeColors[colorName];
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
		} else if (openPicker === 'tertiary') {
			tertiaryInput = hex;
		} else if (openPicker === 'accent') {
			accentInput = hex;
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

	function getCurrentColorHex(colorName: 'primary' | 'secondary' | 'tertiary' | 'accent'): string {
		return formatHex($themeColors[colorName]);
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
		tertiaryInput = colors.tertiary;
		accentInput = colors.accent;
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
			<p class="text-sm text-secondary-600 mb-6">
				Enter hex color codes (e.g., "CE1126" or "#CE1126") or click the color preview to use the
				color picker.
			</p>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="relative">
					<label for="primary" class="block text-sm font-bold text-primary-900 mb-2">
						Primary
					</label>
					<div class="flex gap-2">
						<input
							id="primary"
							type="text"
							bind:value={primaryInput}
							oninput={handlePrimaryChange}
							class="flex-1 border-2 border-primary-300 px-4 py-2 focus:outline-none focus:border-primary-500"
							placeholder="CE1126"
						/>
						<button
							type="button"
							onclick={() => openColorPicker('primary')}
							class="w-16 h-10 border-2 border-primary-300 hover:border-primary-500 transition-colors cursor-pointer"
							style="background-color: {getCurrentColorHex('primary')}"
						></button>
					</div>
				</div>

				<div class="relative">
					<label for="secondary" class="block text-sm font-bold text-primary-900 mb-2">
						Secondary
					</label>
					<div class="flex gap-2">
						<input
							id="secondary"
							type="text"
							bind:value={secondaryInput}
							oninput={handleSecondaryChange}
							class="flex-1 border-2 border-primary-300 px-4 py-2 focus:outline-none focus:border-primary-500"
							placeholder="F1D4C1"
						/>
						<button
							type="button"
							onclick={() => openColorPicker('secondary')}
							class="w-16 h-10 border-2 border-primary-300 hover:border-primary-500 transition-colors cursor-pointer"
							style="background-color: {getCurrentColorHex('secondary')}"
						></button>
					</div>
				</div>

				<div class="relative">
					<label for="tertiary" class="block text-sm font-bold text-primary-900 mb-2">
						Tertiary
					</label>
					<div class="flex gap-2">
						<input
							id="tertiary"
							type="text"
							bind:value={tertiaryInput}
							oninput={handleTertiaryChange}
							class="flex-1 border-2 border-primary-300 px-4 py-2 focus:outline-none focus:border-primary-500"
							placeholder="14213D"
						/>
						<button
							type="button"
							onclick={() => openColorPicker('tertiary')}
							class="w-16 h-10 border-2 border-primary-300 hover:border-primary-500 transition-colors cursor-pointer"
							style="background-color: {getCurrentColorHex('tertiary')}"
						></button>
					</div>
				</div>

				<div class="relative">
					<label for="accent" class="block text-sm font-bold text-primary-900 mb-2"> Accent </label>
					<div class="flex gap-2">
						<input
							id="accent"
							type="text"
							bind:value={accentInput}
							oninput={handleAccentChange}
							class="flex-1 border-2 border-primary-300 px-4 py-2 focus:outline-none focus:border-primary-500"
							placeholder="006BA6"
						/>
						<button
							type="button"
							onclick={() => openColorPicker('accent')}
							class="w-16 h-10 border-2 border-primary-300 hover:border-primary-500 transition-colors cursor-pointer"
							style="background-color: {getCurrentColorHex('accent')}"
						></button>
					</div>
				</div>
			</div>

			<div class="mt-6 flex gap-4">
				<button
					onclick={openSaveModal}
					class="bg-accent-600 text-white px-6 py-2 font-bold hover:bg-accent-700 transition-colors cursor-pointer"
				>
					Save Theme
				</button>
				<button
					onclick={handleReset}
					class="bg-primary-600 text-white px-6 py-2 font-bold hover:bg-primary-700 transition-colors cursor-pointer"
				>
					Reset to Defaults
				</button>
			</div>
		</div>

		<!-- Saved Themes Section -->
		<div class="bg-white border-2 border-primary-200 p-6 mb-8">
			<h2 class="text-2xl font-bold text-primary-900 mb-4">Saved Themes</h2>
			{#if $savedThemes.length === 0}
				<p class="text-secondary-600">
					No saved themes yet. Save your current theme to get started!
				</p>
			{:else}
				<div class="overflow-x-auto -mx-6 px-6 md:overflow-x-scroll">
					<div class="flex gap-4">
						{#each $savedThemes as theme (theme.id)}
							<div
								class="border-2 border-primary-300 p-4 hover:border-primary-500 transition-colors cursor-pointer min-w-[280px] flex-shrink-0"
								onclick={() => handleLoadTheme(theme.id)}
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
										style="background-color: #{theme.colors.tertiary}"
										title="Tertiary: #{theme.colors.tertiary}"
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
			>
				<div
					class="bg-white border-4 border-primary-500 p-6 max-w-md w-full"
					onclick={(e) => e.stopPropagation()}
				>
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-primary-900 capitalize">{openPicker} Color Picker</h3>
						<button
							onclick={closeColorPicker}
							class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
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
							role="button"
							tabindex="0"
						></canvas>
						<div
							class="absolute w-4 h-4 border-2 border-white pointer-events-none"
							style="left: {pickerPos.x}%; top: {pickerPos.y}%; transform: translate(-50%, -50%); box-shadow: 0 0 0 1px rgba(0,0,0,0.5);"
						></div>
					</div>

					<div class="mb-4">
						<label class="block text-sm font-bold text-primary-900 mb-2">Hue</label>
						<div class="relative h-8 border-2 border-primary-300">
							<div
								class="absolute inset-0"
								style="background: linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))"
							></div>
							<input
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
						<label class="block text-sm font-bold text-primary-900 mb-2"
							>Opacity (Preview Only)</label
						>
						<div class="relative h-8 border-2 border-primary-300">
							<div
								class="absolute inset-0"
								style="background: linear-gradient(to right, transparent, hsl({pickerColor.h}, {pickerColor.s}%, {pickerColor.l}%))"
							></div>
							<input
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
								} else if (openPicker === 'tertiary') {
									tertiaryInput = hex;
								} else if (openPicker === 'accent') {
									accentInput = hex;
								}
								closeColorPicker();
							}}
							class="flex-1 bg-primary-600 text-white px-4 py-2 font-bold hover:bg-primary-700 transition-colors cursor-pointer"
						>
							Apply
						</button>
						<button
							onclick={closeColorPicker}
							class="flex-1 bg-secondary-500 text-primary-900 px-4 py-2 font-bold hover:bg-secondary-600 transition-colors cursor-pointer"
						>
							Cancel
						</button>
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
			>
				<div
					class="bg-white border-4 border-primary-500 p-6 max-w-md w-full"
					onclick={(e) => e.stopPropagation()}
				>
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-primary-900">Save Theme</h3>
						<button
							onclick={() => {
								showSaveModal = false;
								themeNameInput = '';
							}}
							class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
						>
							×
						</button>
					</div>
					<div class="mb-4">
						<label class="block text-sm font-bold text-primary-900 mb-2">Theme Name</label>
						<input
							type="text"
							bind:value={themeNameInput}
							placeholder="Enter theme name..."
							class="w-full border-2 border-primary-300 px-4 py-2 focus:outline-none focus:border-primary-500"
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									handleSaveTheme();
								}
							}}
							autofocus
						/>
					</div>
					<div class="flex gap-2">
						<button
							onclick={handleSaveTheme}
							class="flex-1 bg-primary-600 text-white px-4 py-2 font-bold hover:bg-primary-700 transition-colors cursor-pointer"
						>
							Save
						</button>
						<button
							onclick={() => {
								showSaveModal = false;
								themeNameInput = '';
							}}
							class="flex-1 bg-secondary-500 text-primary-900 px-4 py-2 font-bold hover:bg-secondary-600 transition-colors cursor-pointer"
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
			>
				<div
					class="bg-white border-4 border-primary-500 p-6 max-w-md w-full"
					onclick={(e) => e.stopPropagation()}
				>
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-primary-900">Overwrite Theme?</h3>
						<button
							onclick={() => {
								showOverwriteModal = false;
								existingThemeIndex = null;
							}}
							class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
						>
							×
						</button>
					</div>
					<p class="text-secondary-700 mb-4">
						A theme with the name "<strong>{themeNameInput}</strong>" already exists. Do you want to
						overwrite it?
					</p>
					<div class="flex gap-2">
						<button
							onclick={handleOverwriteTheme}
							class="flex-1 bg-primary-600 text-white px-4 py-2 font-bold hover:bg-primary-700 transition-colors cursor-pointer"
						>
							Overwrite
						</button>
						<button
							onclick={() => {
								showOverwriteModal = false;
								existingThemeIndex = null;
								showSaveModal = true;
							}}
							class="flex-1 bg-secondary-500 text-primary-900 px-4 py-2 font-bold hover:bg-secondary-600 transition-colors cursor-pointer"
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
			>
				<div
					class="bg-white border-4 border-primary-500 p-6 max-w-md w-full"
					onclick={(e) => e.stopPropagation()}
				>
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-primary-900">Replace Theme</h3>
						<button
							onclick={() => {
								showReplaceModal = false;
							}}
							class="text-primary-600 hover:text-primary-800 font-bold text-2xl cursor-pointer"
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
											style="background-color: #{theme.colors.tertiary}"
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
						class="w-full bg-secondary-500 text-primary-900 px-4 py-2 font-bold hover:bg-secondary-600 transition-colors cursor-pointer"
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
					{#each [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade}
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
					{#each [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade}
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
				<h3 class="text-xl font-bold text-primary-900 mb-4">Tertiary Palette</h3>
				<div class="space-y-2">
					{#each [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade}
						{@const palette = generatePalette($themeColors.tertiary)}
						{@const hexValue = palette[shade]}
						{@const hexWithHash = hexValue.startsWith('#') ? hexValue : `#${hexValue}`}
						<div class="flex items-center gap-3">
							<div
								class="w-16 h-12 border-2 border-primary-300 flex-shrink-0"
								style="background-color: {hexWithHash}"
							></div>
							<div class="flex-1">
								<div class="text-xs font-mono text-secondary-700">tertiary-{shade}</div>
								<div class="text-xs text-secondary-600 font-mono">{hexWithHash}</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="bg-white border-2 border-primary-200 p-4">
				<h3 class="text-xl font-bold text-primary-900 mb-4">Accent Palette</h3>
				<div class="space-y-2">
					{#each [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as shade}
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
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<button
						class="bg-primary-600 text-white px-6 py-3 font-bold hover:bg-primary-700 transition-colors flex items-center justify-center cursor-pointer"
					>
						Primary Button
					</button>
					<button
						class="bg-secondary-500 text-primary-950 px-6 py-3 font-bold hover:bg-secondary-600 transition-colors flex items-center justify-center cursor-pointer"
					>
						Secondary Button
					</button>
					<button
						class="bg-tertiary-600 text-tertiary-50 px-6 py-3 font-bold hover:bg-tertiary-700 transition-colors flex items-center justify-center cursor-pointer"
					>
						Tertiary Button
					</button>
					<button
						class="bg-accent-600 text-white px-6 py-3 font-bold hover:bg-accent-700 transition-colors flex items-center justify-center cursor-pointer"
					>
						Accent Button
					</button>
					<button
						class="bg-white border-2 border-primary-600 text-primary-950 px-6 py-3 font-bold hover:bg-primary-50 transition-colors flex items-center justify-center cursor-pointer"
					>
						Outlined Button
					</button>
					<button
						class="bg-primary-600/50 text-primary-950 px-6 py-3 font-bold hover:bg-primary-600 transition-colors flex items-center justify-center cursor-pointer"
					>
						With Opacity
					</button>
					<button
						class="bg-primary-600 text-white px-6 py-3 font-bold opacity-50 cursor-not-allowed flex items-center justify-center"
						disabled
					>
						Disabled Button
					</button>
					<button
						class="bg-secondary-500 text-primary-950 px-4 py-2 font-bold hover:bg-secondary-600 transition-colors flex items-center justify-center cursor-pointer"
					>
						Small Button
					</button>
				</div>
			</div>

			<!-- Form Elements Section -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Form Elements</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label class="block text-sm font-bold text-primary-950 mb-2">Text Input</label>
						<input
							type="text"
							placeholder="Enter text..."
							class="w-full border-2 border-primary-300 px-4 py-2 focus:outline-none focus:border-primary-500"
						/>
					</div>
					<div>
						<label class="block text-sm font-bold text-primary-950 mb-2">Email Input</label>
						<input
							type="email"
							placeholder="email@example.com"
							class="w-full border-2 border-primary-300 px-4 py-2 focus:outline-none focus:border-primary-500"
						/>
					</div>
					<div>
						<label class="block text-sm font-bold text-primary-950 mb-2">Textarea</label>
						<textarea
							placeholder="Enter message..."
							class="w-full border-2 border-primary-300 px-4 py-2 focus:outline-none focus:border-primary-500"
							rows="3"
						></textarea>
					</div>
					<div>
						<label class="block text-sm font-bold text-primary-950 mb-2">Select Dropdown</label>
						<select
							class="custom-select w-full border-2 border-primary-300 bg-white px-4 py-2 focus:outline-none focus:border-primary-500 text-primary-950"
						>
							<option>Option 1</option>
							<option>Option 2</option>
							<option>Option 3</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Checkboxes and Radio Buttons -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Checkboxes & Radio Buttons</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<div class="space-y-3">
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" class="custom-checkbox" />
								<span class="font-bold text-primary-950">Checkbox Option 1</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" checked class="custom-checkbox" />
								<span class="font-bold text-primary-950">Checkbox Option 2 (Checked)</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="checkbox" disabled class="custom-checkbox" />
								<span class="font-bold text-primary-950 opacity-50"
									>Checkbox Option 3 (Disabled)</span
								>
							</label>
						</div>
					</div>
					<div>
						<div class="space-y-3">
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group" class="custom-radio" />
								<span class="font-bold text-primary-950">Radio Option 1</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group" checked class="custom-radio" />
								<span class="font-bold text-primary-950">Radio Option 2 (Selected)</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input type="radio" name="radio-group" disabled class="custom-radio" />
								<span class="font-bold text-primary-950 opacity-50">Radio Option 3 (Disabled)</span>
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
						<input type="checkbox" role="switch" class="custom-toggle" />
						<span class="font-bold text-primary-950">Toggle Switch Off</span>
					</label>
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" checked class="custom-toggle" />
						<span class="font-bold text-primary-950">Toggle Switch On</span>
					</label>
					<label class="flex items-center gap-3 cursor-pointer">
						<input type="checkbox" role="switch" disabled class="custom-toggle" />
						<span class="font-bold text-primary-950 opacity-50">Toggle Switch Disabled</span>
					</label>
				</div>
			</div>

			<!-- Cards Section -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Cards</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="border-2 border-primary-300 p-4">
						<h4 class="text-lg font-bold text-primary-950 mb-2">Card Title</h4>
						<p class="text-secondary-900 mb-3">Card content with secondary text color.</p>
						<button
							class="bg-primary-600 text-white px-4 py-2 font-bold hover:bg-primary-700 transition-colors flex items-center justify-center cursor-pointer"
						>
							Action
						</button>
					</div>
					<div class="border-2 border-accent-300 bg-accent-50 p-4">
						<h4 class="text-lg font-bold text-accent-950 mb-2">Accent Card</h4>
						<p class="text-accent-900 mb-3">Card with accent background and border.</p>
						<button
							class="bg-accent-600 text-white px-4 py-2 font-bold hover:bg-accent-700 transition-colors flex items-center justify-center cursor-pointer"
						>
							Action
						</button>
					</div>
					<div class="border-2 border-tertiary-300 bg-tertiary-50 p-4">
						<h4 class="text-lg font-bold text-tertiary-950 mb-2">Tertiary Card</h4>
						<p class="text-tertiary-900 mb-3">Card with tertiary color scheme.</p>
						<button
							class="bg-tertiary-600 text-tertiary-50 px-4 py-2 font-bold hover:bg-tertiary-700 transition-colors flex items-center justify-center cursor-pointer"
						>
							Action
						</button>
					</div>
				</div>
			</div>

			<!-- Alerts/Notifications -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Alerts & Notifications</h3>
				<div class="space-y-3">
					<div class="border-2 border-primary-600 bg-primary-50 p-4">
						<div class="font-bold text-primary-950">Primary Alert</div>
						<div class="text-primary-900 text-sm mt-1">This is a primary alert message.</div>
					</div>
					<div class="border-2 border-secondary-600 bg-secondary-50 p-4">
						<div class="font-bold text-secondary-950">Secondary Alert</div>
						<div class="text-secondary-900 text-sm mt-1">This is a secondary alert message.</div>
					</div>
					<div class="border-2 border-accent-600 bg-accent-50 p-4">
						<div class="font-bold text-accent-950">Accent Alert</div>
						<div class="text-accent-900 text-sm mt-1">This is an accent alert message.</div>
					</div>
				</div>
			</div>

			<!-- Badges -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Badges</h3>
				<div class="flex flex-wrap gap-3">
					<span
						class="bg-primary-600 text-white px-3 py-1 font-bold flex items-center justify-center"
						>Primary Badge</span
					>
					<span
						class="bg-secondary-500 text-primary-950 px-3 py-1 font-bold flex items-center justify-center"
						>Secondary Badge</span
					>
					<span
						class="bg-tertiary-600 text-tertiary-50 px-3 py-1 font-bold flex items-center justify-center"
						>Tertiary Badge</span
					>
					<span
						class="bg-accent-600 text-white px-3 py-1 font-bold flex items-center justify-center"
						>Accent Badge</span
					>
					<span
						class="bg-primary-500/50 text-primary-950 px-3 py-1 font-bold flex items-center justify-center"
						>With Opacity</span
					>
					<span
						class="border-2 border-primary-600 text-primary-950 px-3 py-1 font-bold flex items-center justify-center"
						>Outlined Badge</span
					>
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
						<div class="w-full border-2 border-primary-300 bg-primary-100">
							<div class="bg-primary-600 h-6" style="width: 75%"></div>
						</div>
					</div>
					<div>
						<div class="flex justify-between mb-1">
							<span class="text-sm font-bold text-accent-950">Accent Progress</span>
							<span class="text-sm font-bold text-accent-950">50%</span>
						</div>
						<div class="w-full border-2 border-accent-300 bg-accent-100">
							<div class="bg-accent-600 h-6" style="width: 50%"></div>
						</div>
					</div>
					<div>
						<div class="flex justify-between mb-1">
							<span class="text-sm font-bold text-tertiary-950">Tertiary Progress</span>
							<span class="text-sm font-bold text-tertiary-950">90%</span>
						</div>
						<div class="w-full border-2 border-tertiary-300 bg-tertiary-100">
							<div class="bg-tertiary-600 h-6" style="width: 90%"></div>
						</div>
					</div>
				</div>
			</div>

			<!-- Tables -->
			<div class="mb-8">
				<h3 class="text-xl font-bold text-primary-950 mb-3">Tables</h3>
				<div class="border-2 border-primary-300 overflow-x-auto">
					<table class="w-full">
						<thead class="bg-primary-600">
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
									<span
										class="bg-accent-600 text-white px-2 py-1 font-bold text-sm flex items-center justify-center inline-block"
										>Active</span
									>
								</td>
								<td class="px-4 py-3">
									<button
										class="bg-primary-600 text-white px-3 py-1 font-bold text-sm hover:bg-primary-700 transition-colors flex items-center justify-center cursor-pointer"
									>
										Edit
									</button>
								</td>
							</tr>
							<tr class="border-b-2 border-primary-200 bg-secondary-50">
								<td class="px-4 py-3 font-bold text-primary-950">Item 2</td>
								<td class="px-4 py-3">
									<span
										class="bg-secondary-500 text-primary-950 px-2 py-1 font-bold text-sm flex items-center justify-center inline-block"
										>Pending</span
									>
								</td>
								<td class="px-4 py-3">
									<button
										class="bg-primary-600 text-white px-3 py-1 font-bold text-sm hover:bg-primary-700 transition-colors flex items-center justify-center cursor-pointer"
									>
										Edit
									</button>
								</td>
							</tr>
							<tr class="bg-white">
								<td class="px-4 py-3 font-bold text-primary-950">Item 3</td>
								<td class="px-4 py-3">
									<span
										class="bg-tertiary-600 text-tertiary-50 px-2 py-1 font-bold text-sm flex items-center justify-center inline-block"
										>Complete</span
									>
								</td>
								<td class="px-4 py-3">
									<button
										class="bg-primary-600 text-white px-3 py-1 font-bold text-sm hover:bg-primary-700 transition-colors flex items-center justify-center cursor-pointer"
									>
										Edit
									</button>
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
						<div class="bg-primary-500 h-16 border-2 border-primary-300 mb-2"></div>
						<div class="text-xs font-bold text-primary-950">primary-500</div>
					</div>
					<div>
						<div class="bg-secondary-500 h-16 border-2 border-primary-300 mb-2"></div>
						<div class="text-xs font-bold text-primary-950">secondary-500</div>
					</div>
					<div>
						<div class="bg-tertiary-500 h-16 border-2 border-primary-300 mb-2"></div>
						<div class="text-xs font-bold text-primary-950">tertiary-500</div>
					</div>
					<div>
						<div class="bg-accent-500 h-16 border-2 border-primary-300 mb-2"></div>
						<div class="text-xs font-bold text-primary-950">accent-500</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
