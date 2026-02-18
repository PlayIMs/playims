<script lang="ts">
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconX from '@tabler/icons-svelte/icons/x';
	import { createEventDispatcher } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
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
		clearAriaLabel?: string;
	}

	let {
		id,
		label,
		value = '',
		placeholder = 'Search',
		disabled = false,
		type = 'text',
		autocomplete = 'off',
		wrapperClass = 'relative',
		iconClass = 'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950',
		inputClass = 'input-secondary pl-10 pr-10 py-1 text-sm disabled:cursor-not-allowed',
		clearButtonClass = 'absolute right-2 top-1/2 -translate-y-1/2 text-neutral-950 hover:text-secondary-900 cursor-pointer',
		clearIconClass = 'w-4 h-4',
		clearAriaLabel = 'Clear search'
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		input: { value: string };
		clear: { value: '' };
	}>();

	function getValueText(): string {
		return String(value ?? '');
	}

	function handleInput(event: Event): void {
		const next = (event.currentTarget as HTMLInputElement).value;
		dispatch('input', { value: next });
	}

	function clearValue(): void {
		dispatch('input', { value: '' });
		dispatch('clear', { value: '' });
	}
</script>

<div class={wrapperClass}>
	<IconSearch class={iconClass} />
	<label class="sr-only" for={id}>{label}</label>
	<input
		{id}
		{type}
		{placeholder}
		{autocomplete}
		{disabled}
		class={`${inputClass} search-input-no-native-clear appearance-none`}
		value={getValueText()}
		oninput={handleInput}
	/>
	{#if getValueText().trim().length > 0}
		<button
			type="button"
			class={`border-0 bg-transparent p-0 leading-none ${clearButtonClass}`}
			aria-label={clearAriaLabel}
			onclick={clearValue}
		>
			<IconX class={clearIconClass} />
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
