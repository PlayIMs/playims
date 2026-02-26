<script lang="ts">
	import { onMount } from 'svelte';
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

	onMount(() => {
		const unsubscribe = themeColors.subscribe(() => {
			syncInputsFromStore();
		});
		syncInputsFromStore();
		return () => unsubscribe();
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

	function handleColorPickerChange(
		colorName: 'primary' | 'secondary' | 'neutral' | 'accent',
		event: Event
	) {
		const target = event.target as HTMLInputElement;
		const value = target.value.replace('#', '').toUpperCase();
		updateColor(colorName, value);
		if (colorName === 'primary') primaryInput = value;
		if (colorName === 'secondary') secondaryInput = value;
		if (colorName === 'neutral') neutralInput = value;
		if (colorName === 'accent') accentInput = value;
		validatePrimaryColor();
		validateSecondaryColor();
		validateNeutralColor();
		validateAccentColor();
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

<div class="space-y-4">
	<header class="border-2 border-secondary-300 bg-neutral p-4 lg:p-5">
		<h2 class="text-2xl lg:text-3xl font-bold font-serif text-neutral-950">Branding</h2>
		<p class="mt-2 text-sm text-neutral-950">Update your core colors in real time.</p>
	</header>

	<section class="border-2 border-secondary-300 bg-white p-4 lg:p-5 space-y-4">
		<div class="flex flex-wrap gap-2">
			<button type="button" class="button-primary" onclick={openSaveModal}>Save Theme</button>
			<button type="button" class="button-primary-outlined" onclick={handleReset}
				>Reset to Default</button
			>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
			{#each [{ key: 'primary', label: 'Primary', placeholder: 'CE1126', warnings: primaryWarnings, input: primaryInput }, { key: 'secondary', label: 'Secondary', placeholder: '14213D', warnings: secondaryWarnings, input: secondaryInput }, { key: 'neutral', label: 'Neutral', placeholder: 'Leave empty', warnings: neutralWarnings, input: neutralInput }, { key: 'accent', label: 'Accent', placeholder: '04669A', warnings: accentWarnings, input: accentInput }] as color}
				<div>
					<label
						for={`branding-${color.key}`}
						class="block text-sm font-semibold text-neutral-950 mb-1"
					>
						{color.label}
					</label>
					<div class="flex gap-2">
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
							class="w-full"
						/>
						<input
							type="color"
							value={getCurrentColorHex(
								color.key as 'primary' | 'secondary' | 'neutral' | 'accent'
							)}
							oninput={(event) =>
								handleColorPickerChange(
									color.key as 'primary' | 'secondary' | 'neutral' | 'accent',
									event
								)}
							class="h-10 w-14 border-2 border-secondary-300 bg-white cursor-pointer"
							aria-label={`Pick ${color.label} color`}
						/>
					</div>
					{#if color.warnings.length > 0}
						<div class="mt-2 border border-yellow-300 bg-yellow-50 p-2">
							<ul class="list-disc list-inside text-xs text-yellow-800">
								{#each color.warnings as warning}
									<li>{warning}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<section class="border-2 border-secondary-300 bg-white p-4 lg:p-5">
		<h3 class="text-lg font-bold text-neutral-950">Saved Themes</h3>
		<p class="text-xs text-secondary-700 mb-3">
			Capacity: {Math.min($savedThemes.length, MAX_BRANDING_THEMES)} / {MAX_BRANDING_THEMES}
		</p>

		{#if $savedThemes.length === 0}
			<p class="text-sm text-secondary-700">No saved themes yet.</p>
		{:else}
			<div class="space-y-3">
				{#each $savedThemes as theme (theme.id)}
					<div
						class="border-2 border-secondary-300 bg-neutral p-3 cursor-pointer hover:border-primary-500 transition-colors"
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
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div>
								<h4 class="text-sm font-semibold text-neutral-950">{theme.name}</h4>
								<p class="text-xs text-secondary-700">
									Saved {new Date(theme.createdAt).toLocaleDateString()}
								</p>
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
	</section>

	{#if showSaveModal}
		<div
			class="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"
			role="button"
			tabindex="0"
			aria-label="Close save theme modal"
			onclick={closeThemeModals}
			onkeydown={(event) => event.key === 'Escape' && closeThemeModals()}
		>
			<div
				class="w-full max-w-md border-4 border-primary-500 bg-white p-5"
				role="presentation"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
			>
				<h4 class="text-xl font-bold text-primary-900 mb-3">Save Theme</h4>
				<input
					type="text"
					bind:value={themeNameInput}
					placeholder="Theme name"
					class="w-full"
					onkeydown={(event) => event.key === 'Enter' && handleSaveTheme()}
					use:autofocus
				/>
				<div class="mt-4 flex gap-2">
					<button type="button" class="button-primary flex-1" onclick={handleSaveTheme}>Save</button
					>
					<button type="button" class="button-secondary-outlined flex-1" onclick={closeThemeModals}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showOverwriteModal}
		<div
			class="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"
			role="button"
			tabindex="0"
			aria-label="Close overwrite theme modal"
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
		>
			<div
				class="w-full max-w-md border-4 border-primary-500 bg-white p-5"
				role="presentation"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
			>
				<h4 class="text-xl font-bold text-primary-900 mb-3">Overwrite Theme?</h4>
				<p class="text-sm text-secondary-700">
					A theme named <strong>{themeNameInput}</strong> already exists.
				</p>
				<div class="mt-4 flex gap-2">
					<button type="button" class="button-primary flex-1" onclick={handleOverwriteTheme}>
						Overwrite
					</button>
					<button
						type="button"
						class="button-secondary-outlined flex-1"
						onclick={() => {
							showOverwriteModal = false;
							showSaveModal = true;
						}}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showReplaceModal}
		<div
			class="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"
			role="button"
			tabindex="0"
			aria-label="Close replace theme modal"
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
		>
			<div
				class="w-full max-w-md border-4 border-primary-500 bg-white p-5"
				role="presentation"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
			>
				<h4 class="text-xl font-bold text-primary-900 mb-3">Replace a Theme</h4>
				<p class="text-sm text-secondary-700 mb-3">
					You can save up to {MAX_BRANDING_THEMES} themes. Choose one to replace.
				</p>
				<div class="max-h-72 overflow-y-auto space-y-2">
					{#each $savedThemes as theme, index}
						<button
							type="button"
							class="w-full border-2 border-secondary-300 bg-neutral p-2 text-left hover:border-primary-500 cursor-pointer transition-colors"
							onclick={() => handleReplaceTheme(index)}
						>
							{theme.name}
						</button>
					{/each}
				</div>
				<button
					type="button"
					class="button-secondary-outlined w-full mt-3"
					onclick={() => {
						showReplaceModal = false;
						showSaveModal = true;
					}}
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	{#if showRenameModal}
		<div
			class="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"
			role="button"
			tabindex="0"
			aria-label="Close rename theme modal"
			onclick={closeRenameModal}
			onkeydown={(event) => event.key === 'Escape' && closeRenameModal()}
		>
			<div
				class="w-full max-w-md border-4 border-primary-500 bg-white p-5"
				role="presentation"
				onclick={(event) => event.stopPropagation()}
				onkeydown={(event) => event.stopPropagation()}
			>
				<h4 class="text-xl font-bold text-primary-900 mb-3">Rename Theme</h4>
				<input
					type="text"
					bind:value={renameThemeNameInput}
					class="w-full"
					onkeydown={(event) => event.key === 'Enter' && handleRenameTheme()}
					use:autofocus
				/>
				<div class="mt-4 flex gap-2">
					<button type="button" class="button-primary flex-1" onclick={handleRenameTheme}
						>Save</button
					>
					<button type="button" class="button-secondary-outlined flex-1" onclick={closeRenameModal}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
