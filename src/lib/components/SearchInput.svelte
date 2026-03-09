<script lang="ts">
	import { IconSearch, IconX } from '@tabler/icons-svelte';
	import { createEventDispatcher } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type ClearButtonMode = 'icon' | 'text' | 'icon-text';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'type' | 'children'> {
		id: string;
		label: string;
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		type?: 'text' | 'search';
		autocomplete?: HTMLInputAttributes['autocomplete'];
		wrapperClass?: string;
		iconClass?: string;
		inputClass?: string;
		clearButtonClass?: string;
		clearIconClass?: string;
		clearTextClass?: string;
		clearAriaLabel?: string;
		showLeadingIcon?: boolean;
		showClearButton?: boolean;
		clearButtonMode?: ClearButtonMode;
		clearButtonText?: string;
		inputElement?: HTMLInputElement | null;
		onInputKeydown?: ((event: KeyboardEvent) => void) | null;
		leadingVisual?: Snippet<[]>;
		clearVisual?: Snippet<[]>;
	}

	let {
		id,
		label,
		value = $bindable(''),
		placeholder = 'Search',
		disabled = false,
		type = 'text',
		autocomplete = 'off',
		wrapperClass = 'relative',
		iconClass = 'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950',
		inputClass = 'input-secondary pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed',
		clearButtonClass = 'absolute right-2 top-1/2 -translate-y-1/2 text-neutral-950 hover:text-secondary-900 cursor-pointer',
		clearIconClass = 'w-4 h-4',
		clearTextClass = 'text-xs font-semibold',
		clearAriaLabel = 'Clear search',
		showLeadingIcon = true,
		showClearButton = true,
		clearButtonMode = 'icon',
		clearButtonText = 'Clear',
		inputElement = $bindable<HTMLInputElement | null>(null),
		onInputKeydown = null,
		leadingVisual,
		clearVisual,
		...inputProps
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		input: { value: string };
		clear: { value: '' };
	}>();

	function getValueText(): string {
		return String(value ?? '');
	}

	function hasValue(): boolean {
		return getValueText().trim().length > 0;
	}

	function handleInput(event: Event): void {
		const next = (event.currentTarget as HTMLInputElement).value;
		value = next;
		dispatch('input', { value: next });
	}

	function handleKeydown(event: KeyboardEvent): void {
		onInputKeydown?.(event);
	}

	function clearValue(): void {
		value = '';
		dispatch('input', { value: '' });
		dispatch('clear', { value: '' });
		inputElement?.focus();
	}
</script>

<div class={wrapperClass}>
	{#if showLeadingIcon}
		{#if leadingVisual}
			<div class={iconClass}>
				{@render leadingVisual()}
			</div>
		{:else}
			<IconSearch class={iconClass} />
		{/if}
	{/if}
	<label class="sr-only" for={id}>{label}</label>
	<input
		{...inputProps}
		{id}
		{type}
		{placeholder}
		{autocomplete}
		{disabled}
		bind:this={inputElement}
		class={`${inputClass} search-input-no-native-clear appearance-none`}
		value={getValueText()}
		oninput={handleInput}
		onkeydown={handleKeydown}
	/>
	{#if showClearButton && !disabled && hasValue()}
		<button
			type="button"
			tabindex="-1"
			class={`border-0 bg-transparent p-0 leading-none ${clearButtonClass}`}
			aria-label={clearAriaLabel}
			onclick={clearValue}
		>
			{#if clearVisual}
				{@render clearVisual()}
				{#if clearButtonMode === 'icon-text'}
					<span class="sr-only">{clearButtonText}</span>
				{/if}
			{:else if clearButtonMode === 'text'}
				<span class={clearTextClass}>{clearButtonText}</span>
			{:else if clearButtonMode === 'icon-text'}
				<span class="inline-flex items-center gap-1">
					<IconX class={clearIconClass} />
					<span class={clearTextClass}>{clearButtonText}</span>
				</span>
			{:else}
				<IconX class={clearIconClass} />
			{/if}
		</button>
	{/if}
</div>

<style>
	:global(input.search-input-no-native-clear::-webkit-search-decoration),
	:global(input.search-input-no-native-clear::-webkit-search-cancel-button),
	:global(input.search-input-no-native-clear::-webkit-search-results-button),
	:global(input.search-input-no-native-clear::-webkit-search-results-decoration) {
		-webkit-appearance: none;
		appearance: none;
		display: none;
	}

	:global(input.search-input-no-native-clear::-ms-clear),
	:global(input.search-input-no-native-clear::-ms-reveal) {
		display: none;
		width: 0;
		height: 0;
	}
</style>
